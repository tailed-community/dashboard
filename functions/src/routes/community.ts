import { Router, Request, Response } from "express";
import { db, storage, requirePlatformAdmin } from "../lib/firebase";
import { sendCommunityWelcomeEmail } from "../lib/email-service";
import { getPreferredLocaleForUid } from "../lib/locale";
import { upsertStudentUser } from "../lib/user-management";
import { z } from "zod";
import { frontendUrl } from "../lib/env";
import { richTextField } from "../lib/rich-text";
import { logAdminAction, diffFields } from "../lib/admin-audit";
import { transferOwnershipSchema, resolveTargetUser } from "../lib/admin-ownership";
import marketingAssetsRouter from "./community-marketing";
import Busboy from "busboy";

const router = Router();

// Marketing / promotional files (sponsorship packages, media kits, posters).
// Lives in its own module because it owns a subcollection and its own upload
// pipeline; every handler in it is admin-guarded independently.
router.use("/:communityId/marketing-assets", marketingAssetsRouter);

// Communities created before moderation shipped have no `status` field.
// Legacy rule: a missing status is treated as "approved" everywhere.
type CommunityStatus = "pending" | "approved" | "rejected";

const getEffectiveCommunityStatus = (
  data: FirebaseFirestore.DocumentData | undefined
): CommunityStatus => {
  const status = data?.status;
  return status === "pending" || status === "rejected" ? status : "approved";
};

const isPlatformAdmin = (req: Request): boolean => req.user?.platformAdmin === true;

const reviewCommunitySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(2000).optional(),
});

// Validation schema for community creation
const createCommunitySchema = z.object({
  name: z.string().min(3).max(100),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  shortDescription: z.string().min(10).max(200),
  description: richTextField,
  category: z.string().min(1),
  websiteUrl: z.string().url().optional(),
  discordUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  instagramUrl: z.string().url().optional(),
});

// Validation schema for community update
const updateCommunitySchema = z.object({
  name: z.string().min(3).max(100).optional(),
  shortDescription: z.string().min(10).max(200).optional(),
  description: richTextField.optional(),
  category: z.string().min(1).optional(),
  websiteUrl: z.string().url().optional(),
  discordUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  instagramUrl: z.string().url().optional(),
});

/**
 * GET /communities
 * Get all communities with optional filtering
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, search, limit = "50" } = req.query;

    let query: FirebaseFirestore.Query = db.collection("communities");

    // Filter by category if provided
    if (category && typeof category === "string") {
      query = query.where("category", "==", category);
    }

    // Order by member count (most popular first)
    query = query.orderBy("memberCount", "desc");

    // Limit results
    const limitNum = parseInt(limit as string, 10);
    if (limitNum > 0 && limitNum <= 100) {
      query = query.limit(limitNum);
    }

    const snapshot = await query.get();
    let communities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Public listing only ever surfaces approved communities. Filtered
    // in-memory (not via a Firestore where-clause) so legacy docs with no
    // `status` field — treated as approved — aren't excluded.
    communities = communities.filter(
      (community: any) => getEffectiveCommunityStatus(community) === "approved"
    );

    // Apply client-side search filter if provided
    if (search && typeof search === "string") {
      const searchLower = search.toLowerCase();
      communities = communities.filter((community: any) =>
        community.name?.toLowerCase().includes(searchLower) ||
        community.shortDescription?.toLowerCase().includes(searchLower)
      );
    }

    return res.status(200).json({
      success: true,
      communities,
      count: communities.length,
    });
  } catch (error: any) {
    console.error("Error fetching communities:", error);
    return res.status(500).json({
      error: "Failed to fetch communities",
      details: error.message,
    });
  }
});

/**
 * GET /communities/mine
 * Get communities where the current user is an admin, regardless of
 * moderation status. Declared before /:identifier so "mine" isn't
 * swallowed by the param route.
 */
router.get("/mine", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const snapshot = await db
      .collection("communities")
      .where("admins", "array-contains", userId)
      .get();

    const communities = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        slug: data.slug,
        status: getEffectiveCommunityStatus(data),
        logo: data.logo ?? null,
        category: data.category ?? null,
        memberCount: data.memberCount ?? 0,
      };
    });

    return res.status(200).json({
      success: true,
      communities,
    });
  } catch (error: any) {
    console.error("Error fetching my communities:", error);
    return res.status(500).json({
      error: "Failed to fetch communities",
      details: error.message,
    });
  }
});

/**
 * GET /communities/moderation/pending
 * Platform-admin only: all communities awaiting review, oldest first.
 * Declared before /:identifier so "moderation" isn't swallowed by the
 * param route.
 */
router.get("/moderation/pending", requirePlatformAdmin(), async (req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection("communities")
      .where("status", "==", "pending")
      .orderBy("createdAt", "asc")
      .get();

    const communities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      communities,
    });
  } catch (error: any) {
    console.error("Error fetching pending communities:", error);
    return res.status(500).json({
      error: "Failed to fetch pending communities",
      details: error.message,
    });
  }
});

/**
 * GET /communities/admin/all
 * Platform-admin only: browse every community regardless of status, so an
 * admin can find an already-approved community that needs a data fix. The
 * moderation queue only surfaces pending items.
 *
 * Supports ?q= (name/slug substring), ?status= and ?limit=. Searched in
 * memory because Firestore has no substring operator and this is an
 * admin-only screen over a small collection.
 *
 * Declared before /:identifier so "admin" isn't swallowed by the param route.
 */
router.get("/admin/all", requirePlatformAdmin(), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || "100", 10) || 100, 500);
    const q = ((req.query.q as string) || "").trim().toLowerCase();
    const statusFilter = (req.query.status as string) || "";

    const snapshot = await db.collection("communities").limit(1000).get();

    let communities = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        status: getEffectiveCommunityStatus(data),
      };
    });

    if (statusFilter) {
      communities = communities.filter((c) => c.status === statusFilter);
    }
    if (q) {
      communities = communities.filter((c: any) => {
        const haystack = [c.name, c.slug, c.category]
          .filter((v) => typeof v === "string")
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    communities.sort((a: any, b: any) => (b.memberCount ?? 0) - (a.memberCount ?? 0));

    const total = communities.length;
    communities = communities.slice(0, limit);

    return res.status(200).json({
      success: true,
      communities,
      count: communities.length,
      total,
      truncated: total > communities.length,
    });
  } catch (error: any) {
    console.error("Error fetching communities for admin:", error);
    return res.status(500).json({
      error: "Failed to fetch communities",
      details: error.message,
    });
  }
});

/**
 * GET /communities/:identifier
 * Get a single community by ID or slug
 */
router.get("/:identifier", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    let communityDoc;

    // Try fetching by ID first
    communityDoc = await db.collection("communities").doc(identifier).get();

    // If not found by ID, try by slug
    if (!communityDoc.exists) {
      const slugQuery = await db
        .collection("communities")
        .where("slug", "==", identifier)
        .limit(1)
        .get();

      if (!slugQuery.empty) {
        communityDoc = slugQuery.docs[0];
      }
    }

    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const rawData = communityDoc.data() || {};
    const effectiveStatus = getEffectiveCommunityStatus(rawData);

    if (effectiveStatus !== "approved") {
      const userId = req.user?.uid;
      const admins = Array.isArray(rawData.admins) ? rawData.admins : [];
      const isAuthorized =
        !!userId &&
        (admins.includes(userId) || rawData.createdBy === userId || isPlatformAdmin(req));

      if (!isAuthorized) {
        return res.status(404).json({ error: "Community not found" });
      }
    }

    const requesterId = req.user?.uid;
    const communityAdmins = Array.isArray(rawData.admins) ? rawData.admins : [];
    const isCommunityAdmin = !!requesterId && communityAdmins.includes(requesterId);

    const communityData = {
      id: communityDoc.id,
      ...rawData,
      status: effectiveStatus,
      // Mirrors `canEdit` on GET /events/:identifier so the client can render
      // the manage/edit affordance from one flag instead of re-deriving
      // permissions from the admins array.
      canEdit: isCommunityAdmin || isPlatformAdmin(req),
      editingAsPlatformAdmin: isPlatformAdmin(req) && !isCommunityAdmin,
    };

    return res.status(200).json({
      success: true,
      community: communityData,
    });
  } catch (error: any) {
    console.error("Error fetching community:", error);
    return res.status(500).json({
      error: "Failed to fetch community",
      details: error.message,
    });
  }
});

/**
 * Helper: Upload images to Firebase Storage
 * Returns public URLs for uploaded files
 */
const uploadImages = (
  req: Request,
  userId: string
): Promise<{ fields: any; files: { [key: string]: string } }> => {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers as any });
    const fields: any = {};
    const files: { [key: string]: string } = {};
    const fileUploads: Promise<void>[] = [];

    busboy.on("field", (fieldname, val) => {
      fields[fieldname] = val;
    });

    busboy.on("file", (fieldname, file, info) => {
      const { filename, mimeType } = info;
      
      // Validate file type (images only)
      if (!mimeType.startsWith("image/")) {
        file.resume();
        return;
      }

      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filepath = `communities/${userId}/${fieldname}-${timestamp}-${sanitizedFilename}`;
      const blob = storage.bucket().file(filepath);
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: mimeType,
          metadata: {
            uploadedBy: userId,
            fieldname,
          },
        },
      });

      const uploadPromise = new Promise<void>((resolve, reject) => {
        file.pipe(blobStream);
        
        blobStream.on("error", (err) => {
          console.error(`Upload error for ${fieldname}:`, err);
          reject(err);
        });

        blobStream.on("finish", async () => {
          try {
            // Store the file path for client-side Firebase SDK access
            files[fieldname] = filepath;
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });

      fileUploads.push(uploadPromise);
    });

    busboy.on("finish", async () => {
      try {
        await Promise.all(fileUploads);
        resolve({ fields, files });
      } catch (error) {
        reject(error);
      }
    });

    busboy.on("error", (error) => {
      reject(error);
    });

    // Use req.rawBody for Firebase Functions (production), pipe for local dev
    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  });
};

/**
 * Helper: Create community in database
 * Handles validation, slug checking, and profile updates
 */
const createCommunityInDB = async (
  communityData: any,
  userId: string,
  logoUrl: string | null = null,
  bannerUrl: string | null = null
): Promise<{ id: string; data: FirebaseFirestore.DocumentData }> => {
  // Validate required fields
  const validationResult = createCommunitySchema.safeParse(communityData);
  if (!validationResult.success) {
    throw {
      status: 400,
      error: "Invalid request data",
      details: validationResult.error.errors,
    };
  }

  const validatedData = validationResult.data;

  // Check if slug is unique
  const existingSlug = await db
    .collection("communities")
    .where("slug", "==", validatedData.slug)
    .limit(1)
    .get();

  if (!existingSlug.empty) {
    throw {
      status: 400,
      error: "Community slug already exists",
    };
  }

  // New communities require platform-admin review before they're publicly
  // listed or can host events.
  const newCommunityData = {
    ...validatedData,
    logo: logoUrl,
    banner: bannerUrl,
    status: "pending" as const,
    createdBy: userId,
    admins: [userId],
    members: [userId],
    memberCount: 1,
    eventCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Create community document
  const communityRef = await db.collection("communities").add(newCommunityData);

  // Update creator's profile
  const profileRef = db.collection("profiles").doc(userId);
  const profileDoc = await profileRef.get();

  if (profileDoc.exists) {
    const profileData = profileDoc.data();
    const communities = profileData?.communities || [];
    await profileRef.update({
      communities: [...communities, communityRef.id],
      updatedAt: new Date(),
    });
  }

  return { id: communityRef.id, data: newCommunityData };
};

/**
 * POST /communities
 * Create a new community (with optional logo/banner upload)
 * Always uses multipart/form-data (files are optional)
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Always process as multipart (files are optional)
    const { fields, files } = await uploadImages(req, userId);

    // Create community with optional file URLs
    const { id: communityId, data: communityData } = await createCommunityInDB(
      fields,
      userId,
      files.logo || null,
      files.banner || null
    );

    return res.status(201).json({
      success: true,
      message: "Community created successfully",
      communityId,
      community: { id: communityId, ...communityData },
    });
  } catch (error: any) {
    console.error("Error creating community:", error);
    
    if (error.status) {
      return res.status(error.status).json({
        error: error.error,
        details: error.details,
      });
    }
    
    return res.status(500).json({
      error: "Failed to create community",
      details: error.message,
    });
  }
});

/**
 * POST /communities/:communityId/join
 * Join a community
 */
router.post("/:communityId/join", async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const communityRef = db.collection("communities").doc(communityId);
    const communityDoc = await communityRef.get();

    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    const members = communityData?.members || [];

    // Check if already a member
    if (members.includes(userId)) {
      return res.status(400).json({ error: "Already a member of this community" });
    }

    // Add user to community members
    await communityRef.update({
      members: [...members, userId],
      memberCount: members.length + 1,
      updatedAt: new Date(),
    });

    // Update user's profile
    const profileRef = db.collection("profiles").doc(userId);
    const profileDoc = await profileRef.get();

    if (profileDoc.exists) {
      const profileData = profileDoc.data();
      const communities = profileData?.communities || [];
      await profileRef.update({
        communities: [...communities, communityId],
        updatedAt: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Successfully joined community",
    });
  } catch (error: any) {
    console.error("Error joining community:", error);
    return res.status(500).json({
      error: "Failed to join community",
      details: error.message,
    });
  }
});

/**
 * POST /communities/:communityId/leave
 * Leave a community
 */
router.post("/:communityId/leave", async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const communityRef = db.collection("communities").doc(communityId);
    const communityDoc = await communityRef.get();

    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    const members = communityData?.members || [];
    const admins = communityData?.admins || [];

    // Check if user is an admin
    if (admins.includes(userId)) {
      return res.status(400).json({ error: "Community admins cannot leave the community. Please transfer admin role first." });
    }

    // Check if user is a member
    if (!members.includes(userId)) {
      return res.status(400).json({ error: "Not a member of this community" });
    }

    // Remove user from community members
    const updatedMembers = members.filter((id: string) => id !== userId);
    await communityRef.update({
      members: updatedMembers,
      memberCount: updatedMembers.length,
      updatedAt: new Date(),
    });

    // Update user's profile
    const profileRef = db.collection("profiles").doc(userId);
    const profileDoc = await profileRef.get();

    if (profileDoc.exists) {
      const profileData = profileDoc.data();
      const communities = profileData?.communities || [];
      await profileRef.update({
        communities: communities.filter((id: string) => id !== communityId),
        updatedAt: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Successfully left community",
    });
  } catch (error: any) {
    console.error("Error leaving community:", error);
    return res.status(500).json({
      error: "Failed to leave community",
      details: error.message,
    });
  }
});

/**
 * PATCH /communities/:communityId
 * Update community information (admin only)
 * Supports both application/json (text fields only) and
 * multipart/form-data (optional logo / banner image uploads)
 */
router.patch("/:communityId", async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get community and verify user is an admin before doing any expensive work
    const communityDoc = await db.collection("communities").doc(communityId).get();
    const communityData = communityDoc.data();
    if (!communityDoc.exists || !communityData) {
      return res.status(404).json({ error: "Community not found" });
    }

    // Platform admins can edit any community so they can correct bad data
    // without being a member of it. The bypass is audit-logged below.
    const admins = communityData.admins || [];
    const actingAsPlatformAdmin = isPlatformAdmin(req) && !admins.includes(userId);
    if (!admins.includes(userId) && !actingAsPlatformAdmin) {
      return res.status(403).json({ error: "Only community admins can update community details" });
    }

    // Parse request — multipart/form-data (with optional images) or plain JSON
    let fields: any;
    let newLogoPatch: string | null = null;
    let newBannerPath: string | null = null;
    const contentType = req.headers["content-type"] || "";

    if (contentType.includes("multipart/form-data")) {
      const result = await uploadImages(req, userId);
      fields = result.fields;
      if (result.files.logo) newLogoPatch = result.files.logo;
      if (result.files.banner) newBannerPath = result.files.banner;
    } else {
      fields = req.body;
    }

    // Validate text fields
    const validationResult = updateCommunitySchema.safeParse(fields);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const updates = validationResult.data;

    const updateObj = {
      ...updates,
      ...(newLogoPatch && { logo: newLogoPatch }),
      ...(newBannerPath && { banner: newBannerPath }),
      updatedAt: new Date(),
    };

    await db.collection("communities").doc(communityId).update(updateObj);

    if (actingAsPlatformAdmin) {
      await logAdminAction(req, {
        action: "update",
        resourceType: "community",
        resourceId: communityId,
        resourceName: communityData.name,
        changes: diffFields(communityData, updateObj),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Community updated successfully",
      ...(newLogoPatch && { logo: newLogoPatch }),
      ...(newBannerPath && { banner: newBannerPath }),
    });

  } catch (error: any) {
    console.error("Error updating community:", error);
    return res.status(500).json({
      error: "Failed to update community",
      details: error.message,
    });
  }
});

/**
 * GET /communities/:communityId/events
 * Get all events for a community
 */
router.get("/:communityId/events", async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get community and verify user is the creator
    const communityDoc = await db.collection("communities").doc(communityId).get();
    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    if (!communityData) {
      return res.status(404).json({ error: "Community data not found" });
    }

    // Verify user is a community admin
    const admins = communityData.admins || [];
    if (!admins.includes(userId) && !isPlatformAdmin(req)) {
      return res.status(403).json({ error: "Only community admins can view all community events" });
    }

    // Get events
    const eventsSnapshot = await db
      .collection("events")
      .where("communityId", "==", communityId)
      .orderBy("startDate", "desc")
      .get();

    const events = eventsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      events,
      count: events.length,
    });

  } catch (error: any) {
    console.error("Error fetching community events:", error);
    return res.status(500).json({
      error: "Failed to fetch community events",
      details: error.message,
    });
  }
});

/**
 * GET /communities/:communityId/members
 * Get community members with limited profile fields (only public info)
 */
router.get("/:communityId/members", async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get community and verify user is the creator
    const communityDoc = await db.collection("communities").doc(communityId).get();
    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    if (!communityData) {
      return res.status(404).json({ error: "Community data not found" });
    }

    // Verify user is a community admin
    const admins = communityData.admins || [];
    if (!admins.includes(userId) && !isPlatformAdmin(req)) {
      return res.status(403).json({ error: "Only community admins can view members" });
    }

    const memberIds = communityData.members || [];
    
    if (memberIds.length === 0) {
      return res.status(200).json({ success: true, members: [], count: 0 });
    }

    // Fetch members in batches (Firestore 'in' limit is 10)
    const batchSize = 10;
    const members: any[] = [];

    for (let i = 0; i < memberIds.length; i += batchSize) {
      const batch = memberIds.slice(i, i + batchSize);
      const profilesSnapshot = await db
        .collection("profiles")
        .where("userId", "in", batch)
        .get();

      profilesSnapshot.forEach((doc) => {
        const data = doc.data();
        // Only return specific public fields
        members.push({
          userId: doc.id,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          school: data.school || "",
          program: data.program || "",
          graduationYear: data.graduationYear || 0,
          initials: data.initials || "",
          createdAt: data.createdAt,
          // Excluded sensitive fields:
          // - phone, resume, appliedJobs
          // - linkedinUrl, portfolioUrl
          // - devpostUsername, githubUsername, skills
        });
      });
    }

    return res.status(200).json({
      success: true,
      members,
      count: members.length,
    });

  } catch (error: any) {
    console.error("Error fetching community members:", error);
    return res.status(500).json({
      error: "Failed to fetch community members",
      details: error.message,
    });
  }
});

/**
 * POST /communities/:communityId/import-members
 * Bulk import members to a community (creator only)
 * Creates user accounts if they don't exist and adds them to the community
 */
router.post("/:communityId/import-members", async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate request body
    const importMembersSchema = z.object({
      members: z.array(z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      })).min(1).max(500),
      sendNotifications: z.boolean().default(false),
    });

    const validationResult = importMembersSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const { members } = validationResult.data;

    // Get community and verify user is the creator
    const communityDoc = await db.collection("communities").doc(communityId).get();
    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    if (!communityData) {
      return res.status(404).json({ error: "Community data not found" });
    }

    // Verify user is a community admin
    const admins = communityData.admins || [];
    if (!admins.includes(userId) && !isPlatformAdmin(req)) {
      return res.status(403).json({ error: "Only community admins can import members" });
    }

    const results = {
      created: [] as string[],
      existing: [] as string[],
      added: [] as string[],
      alreadyMembers: [] as string[],
      errors: [] as { email: string; error: string }[],
    };

    const currentMembers = communityData.members || [];
    const newMemberIds: string[] = [];

    for (const member of members) {
      try {
        // Use centralized upsert function
        const upsertResult = await upsertStudentUser({
          email: member.email,
          firstName: member.firstName,
          lastName: member.lastName,
        });

        if (upsertResult.error || !upsertResult.userRecord) {
          results.errors.push({
            email: member.email,
            error: upsertResult.error || "Failed to process user",
          });
          continue;
        }

        const emailLower = member.email.toLowerCase();
        
        if (upsertResult.wasCreated) {
          results.created.push(emailLower);
          
          // Send welcome email to new users
          try {
            const loginLink = `${frontendUrl()}/login`;
            const locale = await getPreferredLocaleForUid(
              upsertResult.userRecord.uid
            );
            await sendCommunityWelcomeEmail(
              emailLower,
              member.firstName || emailLower.split("@")[0],
              communityData.name || 'Community',
              'the community', // No specific event
              loginLink,
              locale
            );
          } catch (emailError) {
            console.error(`Failed to send welcome email to ${emailLower}:`, emailError);
            // Don't fail the import if email fails
          }
        } else {
          results.existing.push(emailLower);
        }

        // Check if already a member
        if (currentMembers.includes(upsertResult.userRecord.uid)) {
          results.alreadyMembers.push(emailLower);
          continue;
        }

        // Add to community members list
        newMemberIds.push(upsertResult.userRecord.uid);
        results.added.push(emailLower);

        // Update user's profile to include this community
        const profileRef = db.collection("profiles").doc(upsertResult.userRecord.uid);
        const profileDoc = await profileRef.get();
        
        if (profileDoc.exists) {
          const profileData = profileDoc.data();
          const userCommunities = profileData?.communities || [];
          if (!userCommunities.includes(communityId)) {
            await profileRef.update({
              communities: [...userCommunities, communityId],
              updatedAt: new Date(),
            });
          }
        }

        // TODO: Send welcome email if sendNotifications is true
      } catch (error: any) {
        console.error(`Error processing member ${member.email}:`, error);
        results.errors.push({
          email: member.email,
          error: error.message || "Unknown error",
        });
      }
    }

    // Update community members array and count
    if (newMemberIds.length > 0) {
      const updatedMembers = [...currentMembers, ...newMemberIds];
      await db.collection("communities").doc(communityId).update({
        members: updatedMembers,
        memberCount: updatedMembers.length,
        updatedAt: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${results.added.length} members`,
      results,
    });

  } catch (error: any) {
    console.error("Error importing members:", error);
    return res.status(500).json({
      error: "Failed to import members",
      details: error.message,
    });
  }
});

/**
 * POST /communities/:communityId/admins
 * Add a new admin to the community (admin only)
 */
router.post("/:communityId/admins", async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate request body
    const addAdminSchema = z.object({
      userId: z.string().min(1),
    });

    const validationResult = addAdminSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const { userId: newAdminId } = validationResult.data;

    // Get community and verify user is an admin
    const communityDoc = await db.collection("communities").doc(communityId).get();
    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    if (!communityData) {
      return res.status(404).json({ error: "Community data not found" });
    }

    const admins = communityData.admins || [];
    const members = communityData.members || [];

    // Verify requester is a community admin
    if (!admins.includes(userId) && !isPlatformAdmin(req)) {
      return res.status(403).json({ error: "Only community admins can add new admins" });
    }

    // Check if target user is a member
    if (!members.includes(newAdminId)) {
      return res.status(400).json({ error: "User must be a community member to become an admin" });
    }

    // Check if already an admin
    if (admins.includes(newAdminId)) {
      return res.status(400).json({ error: "User is already an admin" });
    }

    // Add to admins array
    const adminsAfterAdd = [...admins, newAdminId];
    await db.collection("communities").doc(communityId).update({
      admins: adminsAfterAdd,
      updatedAt: new Date(),
    });

    if (!admins.includes(userId)) {
      await logAdminAction(req, {
        action: "update",
        resourceType: "community",
        resourceId: communityId,
        resourceName: communityData.name,
        changes: [{ field: "admins", before: admins, after: adminsAfterAdd }],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Admin added successfully",
    });

  } catch (error: any) {
    console.error("Error adding admin:", error);
    return res.status(500).json({
      error: "Failed to add admin",
      details: error.message,
    });
  }
});

/**
 * DELETE /communities/:communityId/admins/:adminId
 * Remove an admin from the community (admin only)
 * Ensures at least one admin remains
 */
router.delete("/:communityId/admins/:adminId", async (req: Request, res: Response) => {
  try {
    const { communityId, adminId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get community and verify user is an admin
    const communityDoc = await db.collection("communities").doc(communityId).get();
    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    if (!communityData) {
      return res.status(404).json({ error: "Community data not found" });
    }

    const admins = communityData.admins || [];

    // Verify requester is a community admin
    if (!admins.includes(userId) && !isPlatformAdmin(req)) {
      return res.status(403).json({ error: "Only community admins can remove admins" });
    }

    // Check if target is an admin
    if (!admins.includes(adminId)) {
      return res.status(400).json({ error: "User is not an admin" });
    }

    // Ensure at least one admin remains
    if (admins.length <= 1) {
      return res.status(400).json({ error: "Cannot remove the last admin. At least one admin must remain." });
    }

    // Remove from admins array
    const updatedAdmins = admins.filter((id: string) => id !== adminId);
    await db.collection("communities").doc(communityId).update({
      admins: updatedAdmins,
      updatedAt: new Date(),
    });

    // Revoking someone's admin seat from outside the community is exactly the
    // kind of privileged action the audit trail exists for.
    if (!admins.includes(userId)) {
      await logAdminAction(req, {
        action: "update",
        resourceType: "community",
        resourceId: communityId,
        resourceName: communityData.name,
        changes: [{ field: "admins", before: admins, after: updatedAdmins }],
        reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Admin removed successfully",
    });

  } catch (error: any) {
    console.error("Error removing admin:", error);
    return res.status(500).json({
      error: "Failed to remove admin",
      details: error.message,
    });
  }
});

/**
 * GET /communities/:communityId/admins
 * Get list of community admins with their profile info (admin only)
 */
router.get("/:communityId/admins", async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get community and verify user is an admin
    const communityDoc = await db.collection("communities").doc(communityId).get();
    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    if (!communityData) {
      return res.status(404).json({ error: "Community data not found" });
    }

    const admins = communityData.admins || [];

    // Verify user is a community admin
    if (!admins.includes(userId) && !isPlatformAdmin(req)) {
      return res.status(403).json({ error: "Only community admins can view admin list" });
    }

    if (admins.length === 0) {
      return res.status(200).json({ success: true, admins: [], count: 0 });
    }

    // Fetch admin profiles in batches (Firestore 'in' limit is 10)
    const batchSize = 10;
    const adminProfiles: any[] = [];

    for (let i = 0; i < admins.length; i += batchSize) {
      const batch = admins.slice(i, i + batchSize);
      const profilesSnapshot = await db
        .collection("profiles")
        .where("userId", "in", batch)
        .get();

      profilesSnapshot.forEach((doc) => {
        const data = doc.data();
        adminProfiles.push({
          userId: doc.id,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          initials: data.initials || "",
        });
      });
    }

    return res.status(200).json({
      success: true,
      admins: adminProfiles,
      count: adminProfiles.length,
    });

  } catch (error: any) {
    console.error("Error fetching admins:", error);
    return res.status(500).json({
      error: "Failed to fetch admins",
      details: error.message,
    });
  }
});

/**
 * POST /communities/:communityId/review
 * Platform-admin only: approve or reject a pending (or previously reviewed)
 * community.
 */
router.post(
  "/:communityId/review",
  requirePlatformAdmin(),
  async (req: Request, res: Response) => {
    try {
      const { communityId } = req.params;
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const validationResult = reviewCommunitySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request data",
          details: validationResult.error.errors,
        });
      }

      const { action, reason } = validationResult.data;

      const communityRef = db.collection("communities").doc(communityId);
      const communityDoc = await communityRef.get();
      if (!communityDoc.exists) {
        return res.status(404).json({ error: "Community not found" });
      }

      const status: CommunityStatus = action === "approve" ? "approved" : "rejected";
      const updates = {
        status,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNote: reason ?? null,
        updatedAt: new Date(),
      };

      await communityRef.update(updates);

      return res.status(200).json({
        success: true,
        community: {
          id: communityDoc.id,
          ...communityDoc.data(),
          ...updates,
        },
      });
    } catch (error: any) {
      console.error("Error reviewing community:", error);
      return res.status(500).json({
        error: "Failed to review community",
        details: error.message,
      });
    }
  }
);

/**
 * POST /communities/:communityId/transfer-ownership
 * Platform-admin only: reassign `createdBy` to another user and ensure that
 * user is both an admin and a member.
 *
 * Used when a community's founder graduates or abandons the account. The
 * previous owner keeps their admin seat — removing it is a separate,
 * deliberate action via DELETE /:communityId/admins/:adminId.
 */
router.post(
  "/:communityId/transfer-ownership",
  requirePlatformAdmin(),
  async (req: Request, res: Response) => {
    try {
      const { communityId } = req.params;

      const validationResult = transferOwnershipSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request data",
          details: validationResult.error.errors,
        });
      }

      const communityRef = db.collection("communities").doc(communityId);
      const communityDoc = await communityRef.get();
      const communityData = communityDoc.data();
      if (!communityDoc.exists || !communityData) {
        return res.status(404).json({ error: "Community not found" });
      }

      const newOwner = await resolveTargetUser(res, validationResult.data);
      if (!newOwner) return null;

      if (newOwner.uid === communityData.createdBy) {
        return res.status(400).json({ error: "That user already owns this community" });
      }

      const admins: string[] = Array.isArray(communityData.admins) ? communityData.admins : [];
      const members: string[] = Array.isArray(communityData.members) ? communityData.members : [];

      const nextAdmins = admins.includes(newOwner.uid) ? admins : [...admins, newOwner.uid];
      const nextMembers = members.includes(newOwner.uid) ? members : [...members, newOwner.uid];

      await communityRef.update({
        createdBy: newOwner.uid,
        admins: nextAdmins,
        members: nextMembers,
        memberCount: nextMembers.length,
        updatedAt: new Date(),
      });

      await logAdminAction(req, {
        action: "transfer_ownership",
        resourceType: "community",
        resourceId: communityId,
        resourceName: communityData.name,
        changes: diffFields(communityData, {
          createdBy: newOwner.uid,
          admins: nextAdmins,
          members: nextMembers,
        }),
        reason: validationResult.data.reason,
      });

      return res.status(200).json({
        success: true,
        message: "Community ownership transferred",
        newOwner: { uid: newOwner.uid, email: newOwner.email ?? null },
      });
    } catch (error: any) {
      console.error("Error transferring community ownership:", error);
      return res.status(500).json({
        error: "Failed to transfer community ownership",
        details: error.message,
      });
    }
  }
);

/**
 * DELETE /communities/:communityId
 * Platform-admin only: soft take-down of a community.
 *
 * Mirrors DELETE /events/:eventId — the document is never destroyed, only
 * de-listed by flipping `status` to "rejected", which every public read path
 * already filters on. Restore by approving it again from the moderation
 * queue. Nothing is hard-deleted because a community owns member lists and
 * event references that would be orphaned by a real delete.
 */
router.delete(
  "/:communityId",
  requirePlatformAdmin(),
  async (req: Request, res: Response) => {
    try {
      const { communityId } = req.params;
      const userId = req.user?.uid;

      const communityRef = db.collection("communities").doc(communityId);
      const communityDoc = await communityRef.get();
      const communityData = communityDoc.data();
      if (!communityDoc.exists || !communityData) {
        return res.status(404).json({ error: "Community not found" });
      }

      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;

      await communityRef.update({
        status: "rejected",
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNote: reason ?? "Archived by platform admin",
        updatedAt: new Date(),
      });

      await logAdminAction(req, {
        action: "archive",
        resourceType: "community",
        resourceId: communityId,
        resourceName: communityData.name,
        changes: [
          {
            field: "status",
            before: getEffectiveCommunityStatus(communityData),
            after: "rejected",
          },
        ],
        reason,
      });

      return res.status(200).json({
        success: true,
        message: "Community archived successfully",
      });
    } catch (error: any) {
      console.error("Error archiving community:", error);
      return res.status(500).json({
        error: "Failed to archive community",
        details: error.message,
      });
    }
  }
);

export default router;
