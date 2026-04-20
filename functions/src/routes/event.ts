import { Router, Request, Response } from "express";
import { db, storage } from "../lib/firebase";
import { sendCommunityWelcomeEmail } from "../lib/email-service";
import { upsertStudentUser } from "../lib/user-management";
import { z } from "zod";
import Busboy from "busboy";

const router = Router();

const eventBaseSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  startDate: z.string().min(1),
  startTime: z.string().min(1),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  mode: z.enum(["Online", "In Person", "Hybrid"]),
  location: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  hostType: z.enum(["community", "custom"]).optional(),
  customHostName: z.string().optional(),
  category: z.string().min(1),
  city: z.string().optional(),
  isPaid: z.boolean().default(false),
  registrationLink: z.string().url().optional().or(z.literal("")),
  digitalLink: z.string().url().optional().or(z.literal("")),
  status: z.enum(["draft", "published", "cancelled"]).default("published"),
  schedule: z.string().optional(),
  helpSearch: z.array(
    z.object({
      status: z.boolean(),
      value: z.string(),
    })
  ).optional(),
});


const createEventSchema = eventBaseSchema.extend({
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/),
  communityId: z.string().optional(),
});

/**
 * Helper: Upload images to Firebase Storage for events
 * Returns public URLs for uploaded files
 */
const uploadEventImages = (
  req: Request,
  userId: string
): Promise<{ fields: any; files: { [key: string]: string } }> => {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers as any });
    const fields: any = {};
    const files: { [key: string]: string } = {};
    const fileUploads: Promise<void>[] = [];

    busboy.on("field", (fieldname, val) => {
      // Parse numbers
      if (fieldname === "capacity") {
        fields[fieldname] = parseInt(val, 10);
      } else if (fieldname === "isPaid") {
        // Parse boolean from FormData string
        fields[fieldname] = val === "true";
      } else if (fieldname === "removeScheduleImage") {
        fields[fieldname] = val === "true";
      } else {
        fields[fieldname] = val;
      }
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
      const filepath = `events/${userId}/${fieldname}-${timestamp}-${sanitizedFilename}`;
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
 * Helper: Create event in database
 * Handles validation, slug checking, community updates, and profile updates
 */
const createEventInDB = async (
  eventData: any,
  userId: string,
  heroImageUrl: string | null = null,
  scheduleImageUrl: string | null = null
): Promise<string> => {
  // Validate required fields
  const validationResult = createEventSchema.safeParse(eventData);
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
    .collection("events")
    .where("slug", "==", validatedData.slug)
    .limit(1)
    .get();

  if (!existingSlug.empty) {
    throw {
      status: 400,
      error: "Event slug already exists",
    };
  }

  // If communityId is provided, verify it exists and increment event count
  if (validatedData.communityId) {
    const communityDoc = await db.collection("communities").doc(validatedData.communityId).get();
    if (!communityDoc.exists) {
      throw {
        status: 400,
        error: "Community not found",
      };
    }

    // Increment community event count
    await db.collection("communities").doc(validatedData.communityId).update({
      eventCount: (communityDoc.data()?.eventCount || 0) + 1,
      updatedAt: new Date(),
    });
  }

  // Create event document
  const eventRef = await db.collection("events").add({
    ...validatedData,
    heroImage: heroImageUrl,
    scheduleImage: scheduleImageUrl,
    createdBy: userId,
    attendees: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Update creator's profile
  const profileRef = db.collection("profiles").doc(userId);
  const profileDoc = await profileRef.get();
  
  if (profileDoc.exists) {
    const profileData = profileDoc.data();
    const events = profileData?.events || [];
    await profileRef.update({
      events: [...events, eventRef.id],
      updatedAt: new Date(),
    });
  }

  return eventRef.id;
};

/**
 * Helper: Resolve an event document by ID or slug
 * Returns the document snapshot or null if not found
 */
const resolveEvent = async (
  identifier: string
): Promise<FirebaseFirestore.DocumentSnapshot | null> => {
  // Try by document ID first
  const byId = await db.collection("events").doc(identifier).get();
  if (byId.exists) return byId;

  // Fall back to slug lookup
  const bySlug = await db
    .collection("events")
    .where("slug", "==", identifier)
    .limit(1)
    .get();

  return bySlug.empty ? null : bySlug.docs[0];
};

const awardBaseSchema = z.object({
  type: z.enum(["main_place", "special"]),
  place: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
  title: z.string().min(1).max(120),
  prizeDescription: z.string().max(200).optional(),
  recipientIds: z.array(z.string().min(1)).min(1).optional(),
});

const createAwardSchema = awardBaseSchema;

const updateAwardSchema = awardBaseSchema.partial();

const updateEventSchema = eventBaseSchema
  .partial()
  .extend({
    location: z.string().min(1).max(500).optional(), // override
    winners: z.array(z.object({ id: z.string() })).optional(),
    awards: z.array(createAwardSchema).optional(),
    organizer: z.array(z.object({ id: z.string() })).optional(),
    stand: z.array(z.object({ id: z.string() })).optional(),
    removeScheduleImage: z.boolean().optional(),
  });

const safeDeleteStorageFile = async (filePath?: string): Promise<void> => {
  if (!filePath) return;

  try {
    await storage.bucket().file(filePath).delete({ ignoreNotFound: true });
  } catch (error) {
    console.error("Failed to delete storage file:", filePath, error);
  }
};

/**
 * GET /events
 * Get all events with optional filtering
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { 
      status, 
      communityId, 
      category, 
      city, 
      upcoming, 
      limit = "50" 
    } = req.query;

    let query: FirebaseFirestore.Query = db.collection("events");

    // Filter by status
    if (status && typeof status === "string") {
      query = query.where("status", "==", status);
    }

    // Filter by communityId
    if (communityId && typeof communityId === "string") {
      query = query.where("communityId", "==", communityId);
    }

    // Filter by category
    if (category && typeof category === "string") {
      query = query.where("category", "==", category);
    }

    // Filter by city
    if (city && typeof city === "string") {
      query = query.where("city", "==", city);
    }

    // Filter by upcoming/past events
    if (upcoming === "true") {
      query = query.where("startDate", ">=", new Date().toISOString().split('T')[0]);
      query = query.orderBy("startDate", "asc");
    } else {
      query = query.orderBy("startDate", "desc");
    }

    // Limit results
    const limitNum = parseInt(limit as string, 10);
    if (limitNum > 0 && limitNum <= 100) {
      query = query.limit(limitNum);
    }

    const snapshot = await query.get();
    const events = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error: any) {
    console.error("Error fetching events:", error);
    return res.status(500).json({
      error: "Failed to fetch events",
      details: error.message,
    });
  }
});

/**
 * GET /events/:identifier
 * Get a single event by ID or slug
 * Includes populated community data if event is hosted by a community
 */
router.get("/:identifier", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    let eventDoc;
    
    // Try fetching by ID first
    eventDoc = await db.collection("events").doc(identifier).get();
    
    // If not found by ID, try by slug
    if (!eventDoc.exists) {
      const slugQuery = await db
        .collection("events")
        .where("slug", "==", identifier)
        .limit(1)
        .get();

      if (!slugQuery.empty) {
        eventDoc = slugQuery.docs[0];
      }
    }

    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    const eventData: any = {
      id: eventDoc.id,
      ...eventDoc.data(),
    };

    // Populate community data and check canEdit
    let canEdit = false;

    // Check if user is the event creator
    if (req.user?.uid && eventData.createdBy === req.user.uid) {
      canEdit = true;
    }

    if (eventData.communityId) {
      const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
      if (communityDoc.exists) {
        const communityData = communityDoc.data();
        eventData.community = {
          id: communityDoc.id,
          name: communityData?.name,
          slug: communityData?.slug,
          logo: communityData?.logo,
          logoUrl: communityData?.logoUrl,
          shortDescription: communityData?.shortDescription,
        };

        // Check if user is a community admin
        if (!canEdit && req.user?.uid) {
          const admins = communityData?.admins || [];
          canEdit = admins.includes(req.user.uid);
        }
      }
    }

    eventData.canEdit = canEdit;

    return res.status(200).json({
      success: true,
      event: eventData,
    });
  } catch (error: any) {
    console.error("Error fetching event:", error);
    return res.status(500).json({
      error: "Failed to fetch event",
      details: error.message,
    });
  }
});

/**
 * POST /events/:eventId/awards
 * Add a new award to an event for community admins
 */
router.post("/:eventId/awards", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc) {
      return res.status(404).json({ error: "Event not found" });
    }

    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    if (!eventData.communityId) {
      return res.status(400).json({ error: "Awards can only be added to community events" });
    }

    const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    const admins = communityData?.admins || [];
    if (!admins.includes(userId)) {
      return res.status(403).json({ error: "Only community admins can add awards" });
    }

    const validationResult = createAwardSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const awardData = validationResult.data;
    const awardRef = await db
      .collection("events")
      .doc(eventDoc.id)
      .collection("awards")
      .add({
        ...awardData,
        eventId: eventDoc.id,
        communityId: eventData.communityId,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return res.status(201).json({
      success: true,
      message: "Award created successfully",
      award: {
        id: awardRef.id,
        ...awardData,
        eventId: eventDoc.id,
        communityId: eventData.communityId,
        createdBy: userId,
      },
    });
  } catch (error: any) {
    console.error("Error creating award:", error);
    return res.status(500).json({
      error: "Failed to create award",
      details: error.message,
    });
  }
});

/**
 * PATCH /events/:eventId/awards/:awardId
 * Update an award for community admins
 */
router.patch("/:eventId/awards/:awardId", async (req: Request, res: Response) => {
  try {
    const { eventId, awardId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc) {
      return res.status(404).json({ error: "Event not found" });
    }

    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    if (!eventData.communityId) {
      return res.status(400).json({ error: "Awards can only be updated for community events" });
    }

    const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    const admins = communityData?.admins || [];
    if (!admins.includes(userId)) {
      return res.status(403).json({ error: "Only community admins can update awards" });
    }

    const validationResult = updateAwardSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const awardRef = db
      .collection("events")
      .doc(eventDoc.id)
      .collection("awards")
      .doc(awardId);

    const awardDoc = await awardRef.get();
    if (!awardDoc.exists) {
      return res.status(404).json({ error: "Award not found" });
    }

    const awardData = validationResult.data;
    await awardRef.update({
      ...awardData,
      updatedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Award updated successfully",
      award: {
        id: awardDoc.id,
        ...awardDoc.data(),
        ...awardData,
        updatedAt: new Date(),
      },
    });
  } catch (error: any) {
    console.error("Error updating award:", error);
    return res.status(500).json({
      error: "Failed to update award",
      details: error.message,
    });
  }
});

/**
 * GET /events/:eventId/awards
 * Get all awards for an event
 */
router.get("/:eventId/awards", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.uid;

    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc) {
      return res.status(404).json({ error: "Event not found" });
    }

    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    const awardsSnapshot = await db
      .collection("events")
      .doc(eventDoc.id)
      .collection("awards")
      .orderBy("createdAt", "desc")
      .get();

    if (eventData.communityId && userId) {
      const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
      const admins = communityDoc.data()?.admins || [];
      const canView = eventData.createdBy === userId || admins.includes(userId);

      if (!canView) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (eventData.communityId && !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const awards = awardsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      awards,
      count: awards.length,
    });
  } catch (error: any) {
    console.error("Error fetching awards:", error);
    return res.status(500).json({
      error: "Failed to fetch awards",
      details: error.message,
    });
  }
});

/**
 * DELETE /events/:eventId/awards/:awardId
 * Delete an award for community admins
 */
router.delete("/:eventId/awards/:awardId", async (req: Request, res: Response) => {
  try {
    const { eventId, awardId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc) {
      return res.status(404).json({ error: "Event not found" });
    }

    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    if (!eventData.communityId) {
      return res.status(400).json({ error: "Awards can only be deleted for community events" });
    }

    const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    const admins = communityData?.admins || [];
    if (!admins.includes(userId)) {
      return res.status(403).json({ error: "Only community admins can delete awards" });
    }

    const awardRef = db
      .collection("events")
      .doc(eventDoc.id)
      .collection("awards")
      .doc(awardId);

    const awardDoc = await awardRef.get();
    if (!awardDoc.exists) {
      return res.status(404).json({ error: "Award not found" });
    }

    await awardRef.delete();

    return res.status(200).json({
      success: true,
      message: "Award deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting award:", error);
    return res.status(500).json({
      error: "Failed to delete award",
      details: error.message,
    });
  }
});

/**
 * POST /events
 * Create a new event (with optional heroImage and scheduleImage uploads)
 * Always uses multipart/form-data (files are optional)
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Always process as multipart (files are optional)
    const { fields, files } = await uploadEventImages(req, userId);

    // Create event with optional file URL
    const eventId = await createEventInDB(
      fields,
      userId,
      files.heroImage || null,
      files.scheduleImage || null
    );

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      eventId,
    });
  } catch (error: any) {
    console.error("Error creating event:", error);
    
    if (error.status) {
      return res.status(error.status).json({
        error: error.error,
        details: error.details,
      });
    }
    
    return res.status(500).json({
      error: "Failed to create event",
      details: error.message,
    });
  }
});

/**
 * PATCH /events/:eventId
 * Update an event (supports both JSON and multipart/form-data for hero/schedule images)
 */
router.patch("/:eventId", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch event first for authorization check (by ID or slug)
    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc) {
      return res.status(404).json({ error: "Event not found" });
    }

    const resolvedEventId = eventDoc.id;
    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    // Check authorization: event creator or community admin
    let isAuthorized = eventData.createdBy === userId;
    if (!isAuthorized && eventData.communityId) {
      const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
      const admins = communityDoc.data()?.admins || [];
      isAuthorized = admins.includes(userId);
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Only event creators or community admins can update event details" });
    }

    // Parse request body — multipart/form-data or JSON
    let fields: any;
    let newHeroImagePath: string | null = null;
    let newScheduleImagePath: string | null = null;
    const contentType = req.headers["content-type"] || "";

    if (contentType.includes("multipart/form-data")) {
      const result = await uploadEventImages(req, userId);
      fields = result.fields;
      if (result.files.heroImage) {
        newHeroImagePath = result.files.heroImage;
      }
      if (result.files.scheduleImage) {
        newScheduleImagePath = result.files.scheduleImage;
      }
    } else {
      fields = req.body;
    }

    // Coerce FormData string types to expected JS types
    if (typeof fields.capacity === "string") {
      fields.capacity = fields.capacity ? parseInt(fields.capacity, 10) : undefined;
    }
    if (typeof fields.isPaid === "string") {
      fields.isPaid = fields.isPaid === "true";
    }
    if (typeof fields.removeScheduleImage === "string") {
      fields.removeScheduleImage = fields.removeScheduleImage === "true";
    }

    // Validate fields
    const validationResult = updateEventSchema.safeParse(fields);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const updates = validationResult.data;
    const shouldRemoveScheduleImage = Boolean(updates.removeScheduleImage);

    const updateObj: any = {
      ...updates,
      updatedAt: new Date(),
    };

    delete updateObj.removeScheduleImage;

    if (newHeroImagePath) {
      updateObj.heroImage = newHeroImagePath;
    }

    if (newScheduleImagePath) {
      updateObj.scheduleImage = newScheduleImagePath;
      if (eventData.scheduleImage && eventData.scheduleImage !== newScheduleImagePath) {
        await safeDeleteStorageFile(eventData.scheduleImage);
      }
    } else if (shouldRemoveScheduleImage) {
      updateObj.scheduleImage = null;
      if (eventData.scheduleImage) {
        await safeDeleteStorageFile(eventData.scheduleImage);
      }
    }

    await db.collection("events").doc(resolvedEventId).update(updateObj);

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
    });

  } catch (error: any) {
    console.error("Error updating event:", error);
    return res.status(500).json({
      error: "Failed to update event",
      details: error.message,
    });
  }
});

/**
 * DELETE /events/:eventId
 * Delete an event (soft delete by setting status to cancelled)
 */
router.delete("/:eventId", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get event and verify user is the creator or community creator (by ID or slug)
    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc) {
      return res.status(404).json({ error: "Event not found" });
    }

    const resolvedEventId = eventDoc.id;
    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    // Check if user is event creator
    let isAuthorized = eventData.createdBy === userId;

    // If event has a community, check if user is community admin
    if (!isAuthorized && eventData.communityId) {
      const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
      const communityData = communityDoc.data();
      const admins = communityData?.admins || [];
      isAuthorized = admins.includes(userId);
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Only event creators or community admins can delete events" });
    }

    // Soft delete by setting status to cancelled
    await db.collection("events").doc(resolvedEventId).update({
      status: "cancelled",
      updatedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Event cancelled successfully",
    });

  } catch (error: any) {
    console.error("Error deleting event:", error);
    return res.status(500).json({
      error: "Failed to delete event",
      details: error.message,
    });
  }
});

// Validation schema for attendee import
const importAttendeeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(["mentor", "judge", "participant"]).default("participant"),
  status: z.enum([
    "pending",
    "confirmed",
    "rejected",
    "cancelled",
    "waitlisted",
    "attended",
    "no-show",
  ]).default("confirmed"),
});

//validation schema for batch import of attendees
const importAttendeesSchema = z.object({
  attendees: z.array(importAttendeeSchema).min(1).max(500), // Limit to 500 per batch
  sendNotifications: z.boolean().default(false),
});

/**
 * POST /events/:eventId/import-attendees
 * Import a list of attendees for an event
 * Creates user accounts if they don't exist and registers them for the event
 */
router.post("/:eventId/import-attendees", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate request body
    const validationResult = importAttendeesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const { attendees } = validationResult.data;

    // Get event and verify it exists (by ID or slug)
    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc) {
      return res.status(404).json({ error: "Event not found" });
    }

    const resolvedEventId = eventDoc.id;
    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    // Get community and verify user is the creator
    if (!eventData.communityId) {
      return res.status(400).json({ error: "Event is not associated with a community" });
    }

    const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
    if (!communityDoc.exists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const communityData = communityDoc.data();
    if (!communityData) {
      return res.status(404).json({ error: "Community data not found" });
    }

    // Verify user is a community admin
    const admins = communityData.admins || [];
    if (!admins.includes(userId)) {
      return res.status(403).json({ error: "Only community admins can import registrations" });
    }

    const results = {
      created: [] as string[],
      existing: [] as string[],
      registered: [] as string[],
      errors: [] as { email: string; error: string }[],
    };

    // Process each registration request
    for (const attendee of attendees) {
      try {
        // Use centralized upsert function
        const upsertResult = await upsertStudentUser({
          email: attendee.email,
          firstName: attendee.firstName,
          lastName: attendee.lastName,
        });

        if (upsertResult.error || !upsertResult.userRecord) {
          results.errors.push({
            email: attendee.email,
            error: upsertResult.error || "Failed to process user",
          });
          continue;
        }

        const emailLower = attendee.email.toLowerCase();
        
        if (upsertResult.wasCreated) {
          results.created.push(emailLower);
          
          // Send welcome email to new users
          try {
            const loginLink = `${process.env.WEB_APP_URL || 'https://community.tailed.ca'}/login`;
            await sendCommunityWelcomeEmail(
              emailLower,
              attendee.firstName || emailLower.split("@")[0],
              communityData.name || 'Community',
              eventData.title || 'Event',
              loginLink
            );
          } catch (emailError) {
            console.error(`Failed to send welcome email to ${emailLower}:`, emailError);
            // Don't fail the import if email fails
          }
        } else {
          results.existing.push(emailLower);
        }

        // Update profile with community and event info
        const profileRef = db.collection("profiles").doc(upsertResult.userRecord.uid);
        const profileDoc = await profileRef.get();
        
        if (profileDoc.exists) {
          const profileData = profileDoc.data();
          const communities = profileData?.communities || [];
          const events = profileData?.events || [];

          const updatedCommunities = communities.includes(eventData.communityId)
            ? communities
            : [...communities, eventData.communityId];
          
          const updatedEvents = events.includes(resolvedEventId)
            ? events
            : [...events, resolvedEventId];

          // Only update if there are changes
          if (updatedCommunities.length !== communities.length || updatedEvents.length !== events.length) {
            await profileRef.update({
              communities: updatedCommunities,
              events: updatedEvents,
              updatedAt: new Date(),
            });
          }
        }

        // Add user to community members if not already a member
        if (eventData.communityId) {
          const communityRef = db.collection("communities").doc(eventData.communityId);
          const commDoc = await communityRef.get();
          const commData = commDoc.data();
          
          if (commData && !commData.members.includes(upsertResult.userRecord.uid)) {
            await communityRef.update({
              members: [...commData.members, upsertResult.userRecord.uid],
              memberCount: commData.memberCount + 1,
              updatedAt: new Date(),
            });
          }
        }

        // Check if already registered
        const existingRegistration = await db
          .collection("events")
          .doc(resolvedEventId)
          .collection("registrations")
          .where("userId", "==", upsertResult.userRecord.uid)
          .where("role", "==", attendee.role)
          .limit(1)
          .get();

        if (existingRegistration.empty) {
          // Create registration
          await db
            .collection("events")
            .doc(resolvedEventId)
            .collection("registrations")
            .add({
              userId: upsertResult.userRecord.uid,
              eventId: resolvedEventId,
              email: emailLower,
              firstName: attendee.firstName || "",
              lastName: attendee.lastName || "",
              role: attendee.role,
              status: attendee.status,
              registeredAt: new Date(),
              registeredBy: userId,
              source: "admin-import",
              communityId: eventData.communityId,
            });

          results.registered.push(emailLower);
        }

        // TODO: Send notification email if sendNotifications is true

      } catch (error: any) {
        console.error(`Error processing attendee ${attendee.email}:`, error);
        results.errors.push({
          email: attendee.email,
          error: error.message || "Unknown error",
        });
      }
    }

    // Update event attendee count
    const registrationsSnapshot = await db
      .collection("events")
      .doc(resolvedEventId)
      .collection("registrations")
      .get();

    await db.collection("events").doc(resolvedEventId).update({
      attendees: registrationsSnapshot.size,
      updatedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: `Processed ${attendees.length} attendees`,
      results,
    });

  } catch (error: any) {
    console.error("Error importing attendees:", error);
    return res.status(500).json({
      error: "Failed to import attendees",
      details: error.message,
    });
  }
});

const createAttendeeSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(["mentor", "judge", "participant"]).default("participant"),
  status: z.enum([
    "pending",
    "confirmed",
    "rejected",
    "cancelled",
    "waitlisted",
    "attended",
    "no-show",
  ]).default("pending"),
});

/**
 * POST /events/:eventId/join
 * Join an event and sync the event onto the user's profile
 * Requires the user to be logged in and to provide a role (mentor, judge, participant)
 */
router.post("/:eventId/join", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc) {
      return res.status(404).json({ error: "Event not found" });
    }

    const resolvedEventId = eventDoc.id;
    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    if (eventData.status && eventData.status !== "published") {
      return res.status(400).json({ error: "Event is not open for joining" });
    }

    const validationResult = z.object({
      role: z.string().min(1).max(50),
    }).safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const { role } = validationResult.data;

    if (eventData.communityId) {
      const communityDoc = await db
        .collection("communities")
        .doc(eventData.communityId)
        .get();

      if (!communityDoc.exists) {
        return res.status(404).json({ error: "Community not found" });
      }
    }

    const eventRef = db.collection("events").doc(resolvedEventId);
    const profileRef = db.collection("profiles").doc(userId);

    const result = await db.runTransaction(async (transaction) => {
      const [freshEventDoc, profileDoc] = await Promise.all([
        transaction.get(eventRef),
        transaction.get(profileRef),
      ]);

      if (!freshEventDoc.exists) {
        return res.status(400).json({ error: "Event not found" });
      }

      const freshEventData = freshEventDoc.data();
      if (!freshEventData) {
        return res.status(400).json({ error: "Event data not found" });
      }

      const profileEvents = profileDoc.exists && Array.isArray(profileDoc.data()?.events)
        ? profileDoc.data()?.events
        : [];

      const registrationsRef = eventRef.collection("registrations");
      const existingRegistrationQuery = registrationsRef
        .where("userId", "==", userId)
        .where("role", "==", role)
        .limit(1);
      const existingRegistrationSnapshot = await transaction.get(existingRegistrationQuery);

      if (!existingRegistrationSnapshot.empty) {
        return res.status(400).json({ error: "Already joined this event with this role" });
      }

      const attendeeEntry = createAttendeeSchema.parse({
        userId,
        email: profileDoc.data()?.email || "",
        firstName: profileDoc.data()?.firstName,
        lastName: profileDoc.data()?.lastName,
        role,
        status: "confirmed",
      });

      const registrationRef = registrationsRef.doc();

      transaction.set(registrationRef, {
        ...attendeeEntry,
        eventId: resolvedEventId,
        registeredAt: new Date(),
        registeredBy: userId,
        source: "self-join",
        communityId: eventData.communityId,
      });

      if (existingRegistrationSnapshot.empty) {
        transaction.set(
          profileRef,
          {
            events: [...profileEvents, resolvedEventId],
            updatedAt: new Date(),
          },
          { merge: true }
        );
      }

      return {
        attendee: attendeeEntry,
        registrations: 1,
        joined: true,
      };
    });

    if ("attendee" in result) {
      return res.status(200).json({
        success: true,
        message: "Successfully joined event",
        attendee: result.attendee,
        registrations: result.registrations,
      });
    }
    else{
      return res.status(500).json({
        error: "Failed to join event",
      });
    }
  } catch (error: any) {
    console.error("Error joining event:", error);

    if (error.status) {
      return res.status(error.status).json({
        error: error.error,
      });
    }

    return res.status(500).json({
      error: "Failed to join event",
      details: error.message,
    });
  }
});

/**
 * GET /events/:eventId/attendees
 * Get list of registered attendees for an event
 */
router.get("/:eventId/attendees", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get event (by ID or slug)
    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc) {
      return res.status(404).json({ error: "Event not found" });
    }

    const resolvedEventId = eventDoc.id;
    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    // Verify user has access (community admin or event creator)
    if (eventData.communityId) {
      const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
      const communityData = communityDoc.data();
      const admins = communityData?.admins || [];
      if (communityData && !admins.includes(userId) && eventData.createdBy !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (eventData.createdBy !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get registrations
    const registrationsSnapshot = await db
      .collection("events")
      .doc(resolvedEventId)
      .collection("registrations")
      .orderBy("registeredAt", "desc")
      .get();

    const registrations = registrationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      registrations,
      count: registrations.length,
    });

  } catch (error: any) {
    console.error("Error fetching attendees:", error);
    return res.status(500).json({
      error: "Failed to fetch attendees",
      details: error.message,
    });
  }
});

export default router;
