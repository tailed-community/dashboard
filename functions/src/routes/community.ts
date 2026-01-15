import { Router, Request, Response } from "express";
import { db, storage } from "../lib/firebase";
import { upsertStudentUser } from "../lib/user-management";
import { z } from "zod";
import Busboy from "busboy";

const router = Router();

// Validation schema for community creation
const createCommunitySchema = z.object({
  name: z.string().min(3).max(100),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  shortDescription: z.string().min(10).max(200),
  description: z.string().min(10).max(5000),
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
  description: z.string().min(10).max(5000).optional(),
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

    const communityData = {
      id: communityDoc.id,
      ...communityDoc.data(),
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

    req.pipe(busboy);
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
): Promise<string> => {
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

  // Create community document
  const communityRef = await db.collection("communities").add({
    ...validatedData,
    logo: logoUrl,
    banner: bannerUrl,
    createdBy: userId,
    members: [userId],
    memberCount: 1,
    eventCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

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

  return communityRef.id;
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
    const communityId = await createCommunityInDB(
      fields,
      userId,
      files.logo || null,
      files.banner || null
    );

    return res.status(201).json({
      success: true,
      message: "Community created successfully",
      communityId,
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

    // Check if user is the creator
    if (communityData?.createdBy === userId) {
      return res.status(400).json({ error: "Community creators cannot leave their own community" });
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
 * Update community information (creator only)
 */
router.patch("/:communityId", async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate request body
    const validationResult = updateCommunitySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const updates = validationResult.data;

    // Get community and verify user is the creator
    const communityDoc = await db.collection("communities").doc(communityId).get();
    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    if (!communityData) {
      return res.status(404).json({ error: "Community data not found" });
    }

    // Verify user is the community creator
    if (communityData.createdBy !== userId) {
      return res.status(403).json({ error: "Only community creators can update community details" });
    }

    // Update community
    await db.collection("communities").doc(communityId).update({
      ...updates,
      updatedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Community updated successfully",
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

    // Verify user is the community creator
    if (communityData.createdBy !== userId) {
      return res.status(403).json({ error: "Only community creators can view all community events" });
    }

    // Get events
    const eventsSnapshot = await db
      .collection("events")
      .where("communityId", "==", communityId)
      .orderBy("datetime", "desc")
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

    // Verify user is the community creator
    if (communityData.createdBy !== userId) {
      return res.status(403).json({ error: "Only community creators can view members" });
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

    // Verify user is the community creator
    if (communityData.createdBy !== userId) {
      return res.status(403).json({ error: "Only community creators can import members" });
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

export default router;
