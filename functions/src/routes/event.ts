import { Router, Request, Response } from "express";
import { DateTime } from "luxon";
import { db, storage } from "../lib/firebase";
import { sendCommunityWelcomeEmail, sendEventApprovalEmail } from "../lib/email-service";
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
  requiresApproval: z.boolean().default(false),
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
      } else if (fieldname === "requiresApproval") {
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

interface ResolvedEventContext {
  eventDoc: FirebaseFirestore.DocumentSnapshot;
  resolvedEventId: string;
  eventData: FirebaseFirestore.DocumentData;
}

interface CommunityContext {
  communityId: string;
  communityData: FirebaseFirestore.DocumentData;
  admins: string[];
}

const requireUserId = (req: Request, res: Response): string | null => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return userId;
};

const loadEventContext = async (
  res: Response,
  identifier: string
): Promise<ResolvedEventContext | null> => {
  const eventDoc = await resolveEvent(identifier);
  if (!eventDoc) {
    res.status(404).json({ error: "Event not found" });
    return null;
  }

  const eventData = eventDoc.data();
  if (!eventData) {
    res.status(404).json({ error: "Event data not found" });
    return null;
  }

  return {
    eventDoc,
    resolvedEventId: eventDoc.id,
    eventData,
  };
};

const requireCommunityContext = async (
  res: Response,
  eventData: FirebaseFirestore.DocumentData,
  missingCommunityMessage: string
): Promise<CommunityContext | null> => {
  const communityId =
    typeof eventData.communityId === "string" ? eventData.communityId : null;

  if (!communityId) {
    res.status(400).json({ error: missingCommunityMessage });
    return null;
  }

  const communityDoc = await db.collection("communities").doc(communityId).get();
  if (!communityDoc.exists) {
    console.warn(`Community ${communityId} not found; treating as no-admins`);
    return {
      communityId,
      communityData: {},
      admins: [],
    };
  }

  const communityData = communityDoc.data() || {};
  const admins = Array.isArray(communityData.admins) ? communityData.admins : [];

  return {
    communityId,
    communityData,
    admins,
  };
};

const ensureCommunityAdmin = (
  res: Response,
  userId: string,
  admins: string[],
  forbiddenMessage: string
): boolean => {
  if (!admins.includes(userId)) {
    res.status(403).json({ error: forbiddenMessage });
    return false;
  }

  return true;
};

const ensureEventCreatorOrCommunityAdmin = async (
  res: Response,
  userId: string,
  eventData: FirebaseFirestore.DocumentData,
  forbiddenMessage: string
): Promise<boolean> => {
  if (eventData.createdBy === userId) {
    return true;
  }

  if (eventData.communityId) {
    const communityContext = await requireCommunityContext(
      res,
      eventData,
      "Event is not associated with a community"
    );
    if (!communityContext) return false;

    if (communityContext.admins.includes(userId)) {
      return true;
    }
  }

  res.status(403).json({ error: forbiddenMessage });
  return false;
};

const awardBaseSchema = z.object({
  type: z.enum(["main_place", "special"]),
  place: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
  title: z.string().min(1).max(120),
  prizeDescription: z.string().max(200).optional(),
  recipientIds: z.array(z.string().min(1)).min(1).optional(),
});
const participantSchema = z.object({
  profileId: z.string(),
  id: z.string(),
  role: z.string(),
  status: z.enum([
    "pending",
    "confirmed",
    "rejected",
    "cancelled",
    "waitlisted",
    "attended",
    "no-show",
  ]),
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

    const eventContext = await loadEventContext(res, identifier);
    if (!eventContext) return null;

    const { eventDoc, eventData } = eventContext;

    const eventResponse: any = {
      id: eventDoc.id,
      ...eventData,
    };

    // Populate community data and check canEdit
    let canEdit = false;

    // Check if user is the event creator
    if (req.user?.uid && eventResponse.createdBy === req.user.uid) {
      canEdit = true;
    }

    if (eventResponse.communityId) {
      const communityDoc = await db.collection("communities").doc(eventResponse.communityId).get();
      if (communityDoc.exists) {
        const communityData = communityDoc.data();
        eventResponse.community = {
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

    eventResponse.canEdit = canEdit;

    return res.status(200).json({
      success: true,
      event: eventResponse,
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
    const userId = requireUserId(req, res);
    if (!userId) return null;

    const eventContext = await loadEventContext(res, eventId);
    if (!eventContext) return null;

    const { eventDoc, eventData } = eventContext;

    const communityContext = await requireCommunityContext(
      res,
      eventData,
      "Awards can only be added to community events"
    );
    if (!communityContext) return null;

    if (!ensureCommunityAdmin(res, userId, communityContext.admins, "Only community admins can add awards")) {
      return null;
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
        communityId: communityContext.communityId,
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
        communityId: communityContext.communityId,
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
    const userId = requireUserId(req, res);
    if (!userId) return null;

    const eventContext = await loadEventContext(res, eventId);
    if (!eventContext) return null;

    const { eventDoc, eventData } = eventContext;

    const communityContext = await requireCommunityContext(
      res,
      eventData,
      "Awards can only be updated for community events"
    );
    if (!communityContext) return null;

    if (!ensureCommunityAdmin(res, userId, communityContext.admins, "Only community admins can update awards")) {
      return null;
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

    const eventContext = await loadEventContext(res, eventId);
    if (!eventContext) return null;

    const { eventDoc, eventData } = eventContext;

    const awardsSnapshot = await db
      .collection("events")
      .doc(eventDoc.id)
      .collection("awards")
      .orderBy("createdAt", "desc")
      .get();

    if (eventData.communityId) {
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const communityContext = await requireCommunityContext(
        res,
        eventData,
        "Event is not associated with a community"
      );
      if (!communityContext) return null;

      const canView =
        eventData.createdBy === userId || communityContext.admins.includes(userId);
      if (!canView) {
        return res.status(403).json({ error: "Access denied" });
      }
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
    const userId = requireUserId(req, res);
    if (!userId) return null;

    const eventContext = await loadEventContext(res, eventId);
    if (!eventContext) return null;

    const { eventDoc, eventData } = eventContext;

    const communityContext = await requireCommunityContext(
      res,
      eventData,
      "Awards can only be deleted for community events"
    );
    if (!communityContext) return null;

    if (!ensureCommunityAdmin(res, userId, communityContext.admins, "Only community admins can delete awards")) {
      return null;
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
    const userId = requireUserId(req, res);
    if (!userId) return null;

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
 * POST /events/:eventId/registration-form
 * Create a default registration form schema for an event.
 * For now this creates the default form (name + email) that will be
 * autofilled from participant profile when they open the registration form.
 */
router.post("/:eventId/registration-form", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Resolve event (by id or slug)
    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc) {
      return res.status(404).json({ error: "Event not found" });
    }

    const resolvedEventId = eventDoc.id;
    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    // Only allow event creator or community admin to create the form
    let isAuthorized = eventData.createdBy === userId;
    if (!isAuthorized && eventData.communityId) {
      const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
      const admins = communityDoc.data()?.admins || [];
      isAuthorized = admins.includes(userId);
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Only event creators or community admins can create registration forms" });
    }

    // Default fields: First name, Last name and Email (autofill from profile)
    const defaultFields = [
      {
        question: "First name",
        label: "First name",
        type: "text",
        autofillSource: "profile.firstName",
        required: true,
      },
      {
        question: "Last name",
        label: "Last name",
        type: "text",
        autofillSource: "profile.lastName",
        required: true,
      },
      {
        question: "Email address",
        label: "Email",
        type: "email",
        autofillSource: "profile.email",
        required: true,
      },
    ];

    // Allow callers to provide a specific formId and/or an explicit fields array
    // If no fields provided, we create the default form. If no formId provided
    // the document id will be 'default' to preserve existing behaviour.
    const body = req.body || {};
    const requestedFormId = typeof body.formId === "string" && body.formId ? body.formId : "default";
    const providedFields = Array.isArray(body.fields) ? body.fields : null;

    const fieldsToSave = providedFields || defaultFields;

    // Use a single transaction to atomically create the form and update the event.
    // This prevents the form from being created without the event pointing to it.
    try {
      const eventRef = db.collection("events").doc(resolvedEventId);
      const formRef = eventRef.collection("registrationForms").doc(requestedFormId);

      await db.runTransaction(async (tx) => {
        const [evSnap, formSnap] = await Promise.all([tx.get(eventRef), tx.get(formRef)]);

        if (!evSnap.exists) {
          const e: any = new Error("Event not found when creating registration form");
          e.status = 404;
          throw e;
        }

        // Prevent overwriting an existing form document
        if (formSnap.exists) {
          const e: any = new Error("Registration form already exists");
          e.status = 409;
          throw e;
        }

        tx.set(formRef, {
          fields: fieldsToSave,
          createdAt: new Date(),
          createdBy: userId,
        });

        tx.update(eventRef, {
          registrationFormId: requestedFormId,
          updatedAt: new Date(),
        });
      });
    } catch (err: any) {
      console.error("Failed to create registration form transaction:", err);
      if ((err as any).status === 409) {
        return res.status(409).json({ error: "Registration form already exists" });
      }
      if ((err as any).status === 404) {
        return res.status(404).json({ error: "Event not found when creating registration form" });
      }
      return res.status(500).json({ error: "Failed to create registration form", details: err.message });
    }

    // Verification: re-fetch event and confirm registrationFormId was set
    try {
      const refreshedEvent = await db.collection("events").doc(resolvedEventId).get();
      const refreshedData = refreshedEvent.exists ? refreshedEvent.data() || {} : {};
      if (refreshedData.registrationFormId !== requestedFormId) {
        console.error("Post-transaction verification: registrationFormId not set on event", {
          eventId: resolvedEventId,
          expected: requestedFormId,
          actual: refreshedData.registrationFormId,
        });
      } else {
        console.info("Post-transaction verification: registrationFormId set on event", {
          eventId: resolvedEventId,
          formId: requestedFormId,
        });
      }
    } catch (verifyErr) {
      console.error("Failed to verify event after creating registration form:", verifyErr);
    }

    return res.status(201).json({
      success: true,
      message: "Registration form saved",
      formId: requestedFormId,
    });
  } catch (error: any) {
    console.error("Error creating registration form:", error);
    return res.status(500).json({ error: "Failed to create registration form", details: error.message });
  }
});

/**
 * GET /events/:eventId/registration-form
 * Return the default or custom registration form schema for an event
 */
router.get("/:eventId/registration-form", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc) return res.status(404).json({ error: "Event not found" });

    const resolvedEventId = eventDoc.id;

    // Deterministic priority:
    // 1) explicit ?formId
    // 2) event.registrationFormId
    // 3) 'default'
    // 4) hardcoded fallback

    const explicitFormId = typeof req.query.formId === "string" && req.query.formId ? req.query.formId : null;

    const eventData = eventDoc.data() || {};
    const eventDefinedFormId = typeof eventData.registrationFormId === "string" && eventData.registrationFormId ? eventData.registrationFormId : null;

    let tryOrder: (string | null)[] = [explicitFormId, eventDefinedFormId, "default"];

    // Iterate through priority list and return first existing form
    for (const id of tryOrder) {
      if (!id) continue;
      const formRef = db
        .collection("events")
        .doc(resolvedEventId)
        .collection("registrationForms")
        .doc(id);

      const formDoc = await formRef.get();
      if (formDoc.exists) {
        return res.status(200).json({ success: true, form: formDoc.data() || {}, formId: id });
      }
    }

    // Hardcoded fallback
    const fallback = {
      fields: [
        { question: "First name", label: "First name", type: "text", autofillSource: "profile.firstName", required: true },
        { question: "Last name", label: "Last name", type: "text", autofillSource: "profile.lastName", required: true },
        { question: "Email address", label: "Email", type: "email", autofillSource: "profile.email", required: true },
      ],
    };

    return res.status(200).json({ success: true, form: fallback, formId: "default" });
  } catch (error: any) {
    console.error("Error fetching registration form:", error);
    return res.status(500).json({ error: "Failed to fetch registration form", details: error.message });
  }
});

/**
 * PATCH /events/:eventId
 * Update an event (supports both JSON and multipart/form-data for hero/schedule images)
 */
router.patch("/:eventId", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = requireUserId(req, res);
    if (!userId) return null;

    const eventContext = await loadEventContext(res, eventId);
    if (!eventContext) return null;

    const { resolvedEventId, eventData } = eventContext;

    const isAuthorized = await ensureEventCreatorOrCommunityAdmin(
      res,
      userId,
      eventData,
      "Only event creators or community admins can update event details"
    );
    if (!isAuthorized) return null;

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
    const userId = requireUserId(req, res);
    if (!userId) return null;

    const eventContext = await loadEventContext(res, eventId);
    if (!eventContext) return null;

    const { resolvedEventId, eventData } = eventContext;

    const isAuthorized = await ensureEventCreatorOrCommunityAdmin(
      res,
      userId,
      eventData,
      "Only event creators or community admins can delete events"
    );
    if (!isAuthorized) return null;

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
    const userId = requireUserId(req, res);
    if (!userId) return null;

    // Validate request body
    const validationResult = importAttendeesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const { attendees } = validationResult.data;

    const eventContext = await loadEventContext(res, eventId);
    if (!eventContext) return null;

    const { resolvedEventId, eventData } = eventContext;

    const communityContext = await requireCommunityContext(
      res,
      eventData,
      "Event is not associated with a community"
    );
    if (!communityContext) return null;

    const { communityData, admins } = communityContext;
    if (!ensureCommunityAdmin(res, userId, admins, "Only community admins can import registrations")) {
      return null;
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
            const loginLink = `${process.env.FRONTEND_URL || 'https://community.tailed.ca'}/login`;
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
              communityId: eventData.communityId || null,
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
  // Email moved to formAnswers — optional at top-level
  email: z.string().email().optional(),
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

const getAnswerByLabels = (
  answers: Array<{ questionId?: string | null; label: string; value: unknown }>,
  labels: string[]
): string | undefined => {
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  const match = answers.find((answer) => {
    const questionId = typeof answer.questionId === "string" ? answer.questionId.toLowerCase() : "";
    const label = answer.label.toLowerCase();
    return normalizedLabels.includes(questionId) || normalizedLabels.includes(label);
  });

  if (!match || match.value === null || match.value === undefined) {
    return undefined;
  }

  const value = String(match.value).trim();
  return value.length > 0 ? value : undefined;
};

/**
 * POST /events/:eventId/join
 * Join an event and sync the event onto the user's profile
 * Requires the user to be logged in and to provide a role (mentor, judge, participant)
 */
router.post("/:eventId/join", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = requireUserId(req, res);
    if (!userId) return null;

    const eventContext = await loadEventContext(res, eventId);
    if (!eventContext) return null;

    const { resolvedEventId, eventData } = eventContext;

    if (eventData.status && eventData.status !== "published") {
      return res.status(400).json({ error: "Event is not open for joining" });
    }

    // Accept role, optional account info, optional form metadata and answers
    const joinSchema = z.object({
      role: z.string().min(1).max(50),
      answers: z
        .array(
          z.object({
            questionId: z.string().optional(),
            label: z.string().min(1),
            value: z.any(),
          })
        )
        .optional(),
    });

    const validationResult = joinSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const { role, answers } = validationResult.data;
    const normalizedAnswers = Array.isArray(answers)
      ? answers.map((a: any) => ({
        questionId: a.questionId || null,
        label: a.label,
        value: a.value,
      }))
      : [];

    if (eventData.communityId) {
      const communityContext = await requireCommunityContext(
        res,
        eventData,
        "Event is not associated with a community"
      );
      if (!communityContext) return null;
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
      const profileData = profileDoc.exists ? (profileDoc.data() || {}) : {};

      const extractedEmail = getAnswerByLabels(normalizedAnswers, ["email", "email address"]) || profileData.email || "";
      const extractedFirstName = getAnswerByLabels(normalizedAnswers, ["first name", "firstname", "first_name"]) || profileData.firstName || "";
      const extractedLastName = getAnswerByLabels(normalizedAnswers, ["last name", "lastname", "last_name"]) || profileData.lastName || "";
      const requiresApproval = Boolean(freshEventData.requiresApproval);
      const initialStatus = requiresApproval ? "pending" : "confirmed";

      const registrationsRef = eventRef.collection("registrations");
      const existingRegistrationQuery = registrationsRef
        .where("userId", "==", userId)
        .where("role", "==", role)
        .limit(1);
      const existingRegistrationSnapshot = await transaction.get(existingRegistrationQuery);

      if (!existingRegistrationSnapshot.empty) {
        return res.status(400).json({ error: "Already joined this event with this role" });
      }

      // Create attendee entry with only technical fields; personal PII is stored in formAnswers
      const attendeeEntry = createAttendeeSchema.parse({
        userId,
        email: extractedEmail || undefined,
        firstName: extractedFirstName || undefined,
        lastName: extractedLastName || undefined,
        role,
        status: initialStatus,
      });

      const registrationRef = registrationsRef.doc();

      transaction.set(registrationRef, {
        ...attendeeEntry,
        eventId: resolvedEventId,
        registeredAt: new Date(),
        registeredBy: userId,
        source: normalizedAnswers.length > 0 ? "form" : "self-join",
        communityId: eventData.communityId || null,
        formId: null,
        formLabel: null,
        formAnswers: normalizedAnswers,
        approvedAt: initialStatus === "confirmed" ? new Date() : null,
      });

      if (existingRegistrationSnapshot.empty && initialStatus === "confirmed") {
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
        status: initialStatus,
      };
    });

    if ("attendee" in result) {
      return res.status(200).json({
        success: true,
        message: result.status === "pending"
          ? "Request submitted for organizer approval"
          : "Successfully joined event",
        attendee: result.attendee,
        registrations: result.registrations,
        status: result.status,
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

    return res.status(200).json({
      success: true,
      message: "Successfully joined event",
      attendee: result.attendee,
      registrations: result.registrations,
    });
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
    const userId = requireUserId(req, res);
    if (!userId) return null;

    const eventContext = await loadEventContext(res, eventId);
    if (!eventContext) return null;

    const { resolvedEventId, eventData } = eventContext;

    const canAccess = await ensureEventCreatorOrCommunityAdmin(
      res,
      userId,
      eventData,
      "Access denied"
    );
    if (!canAccess) return null;

    // Query parameters: page, limit, q (search), status, sortBy, order
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim().toLowerCase() : null;
    const statusFilter = typeof req.query.status === "string" && req.query.status ? req.query.status : null;
    const sortBy = typeof req.query.sortBy === "string" && req.query.sortBy ? req.query.sortBy : "registeredAt";
    const order = (typeof req.query.order === "string" && req.query.order === "asc") ? "asc" : "desc";

    const registrationsRef = db.collection("events").doc(resolvedEventId).collection("registrations");

    // If no free-text search is requested and sorting is by registeredAt, do efficient query with offset.
    if (!q && (sortBy === "registeredAt" || !sortBy)) {
      let query: FirebaseFirestore.Query = registrationsRef;

      if (statusFilter) {
        query = query.where("status", "==", statusFilter);
      }

      query = query.orderBy("registeredAt", order as FirebaseFirestore.OrderByDirection).offset((page - 1) * limit).limit(limit);

      const snapshot = await query.get();
      const registrations = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Get total count for meta (note: this does a collection scan - consider a counter field for heavy loads)
      let total = 0;
      if (!statusFilter) {
        const allSnap = await registrationsRef.get();
        total = allSnap.size;
      } else {
        const statusSnap = await registrationsRef.where("status", "==", statusFilter).get();
        total = statusSnap.size;
      }

      return res.status(200).json({
        success: true,
        data: registrations,
        meta: {
          total,
          page,
          limit,
          hasMore: (page * limit) < total,
        },
      });
    }

    // Otherwise (search requested or sorting by other fields), fetch a reasonable cap and perform in-memory filtering/sorting.
    const CAP = 1000; // safety cap to avoid very large reads
    let snapshot = await registrationsRef.limit(CAP).get();
    let items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));

    if (statusFilter) {
      items = items.filter((it) => it.status === statusFilter);
    }

    if (q) {
      items = items.filter((it: any) => {
        const hay: string[] = [];
        if (it.email) hay.push(String(it.email).toLowerCase());
        if (it.firstName) hay.push(String(it.firstName).toLowerCase());
        if (it.lastName) hay.push(String(it.lastName).toLowerCase());
        if (Array.isArray(it.formAnswers)) {
          for (const a of it.formAnswers) {
            if (a && a.value) hay.push(String(a.value).toLowerCase());
            if (a && a.label) hay.push(String(a.label).toLowerCase());
          }
        }
        const haystack = hay.join(" ");
        return haystack.includes(q);
      });
    }

    // Sorting in-memory for supported fields
    const direction = order === "asc" ? 1 : -1;
    items.sort((a: any, b: any) => {
      if (sortBy === "firstName") {
        return direction * ((String(a.firstName || "").localeCompare(String(b.firstName || ""))));
      }
      if (sortBy === "lastName") {
        return direction * ((String(a.lastName || "").localeCompare(String(b.lastName || ""))));
      }
      if (sortBy === "status") {
        return direction * ((String(a.status || "").localeCompare(String(b.status || ""))));
      }
      // Default: registeredAt
      const ta = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
      const tb = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
      return direction * (ta - tb as any);
    });

    const total = items.length;
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);

    return res.status(200).json({
      success: true,
      data: paged,
      meta: { total, page, limit, hasMore: (start + paged.length) < total },
    });

  } catch (error: any) {
    console.error("Error fetching attendees:", error);
    return res.status(500).json({
      error: "Failed to fetch attendees",
      details: error.message,
    });
  }
});

/**
 * POST /events/:eventId/registrations/:registrationId/review
 * Review (approve/reject) a registration. Requires event creator or community admin.
 */
router.post("/:eventId/registrations/:registrationId/review", async (req: Request, res: Response) => {
  try {
    const { eventId, registrationId } = req.params;
    const userId = requireUserId(req, res);
    if (!userId) return;

    const eventContext = await loadEventContext(res, eventId);
    if (!eventContext) return;

    const { resolvedEventId, eventData } = eventContext;

    const canAccess = await ensureEventCreatorOrCommunityAdmin(
      res,
      userId,
      eventData,
      "Access denied"
    );
    if (!canAccess) return;

    const bodySchema = z.object({
      status: z.enum(["pending", "confirmed", "rejected", "cancelled", "waitlisted", "attended", "no-show"]),
      reviewNotes: z.string().optional().nullable(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request data", details: parsed.error.errors });
    }

    const { status, reviewNotes } = parsed.data;

    const regRef = db.collection("events").doc(resolvedEventId).collection("registrations").doc(registrationId);
    const regDoc = await regRef.get();
    if (!regDoc.exists) {
      return res.status(404).json({ error: "Registration not found" });
    }

    const regData = regDoc.data() || {};
    const previousStatus = regData.status;

    const updateObj: any = {
      status,
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
      updatedAt: new Date(),
    };

    if (status === "confirmed") {
      updateObj.approvedAt = new Date();
    }

    await regRef.update(updateObj);

    if (status === "confirmed" && regData.userId) {
      const profileRef = db.collection("profiles").doc(String(regData.userId));
      const profileDoc = await profileRef.get();
      const currentEvents = profileDoc.exists && Array.isArray(profileDoc.data()?.events)
        ? profileDoc.data()?.events
        : [];

      if (!currentEvents.includes(resolvedEventId)) {
        await profileRef.set(
          {
            events: [...currentEvents, resolvedEventId],
            updatedAt: new Date(),
          },
          { merge: true }
        );
      }
    }

    if (status === "confirmed" && previousStatus !== "confirmed" && regData.email) {
      try {
        const eventLink = `${process.env.WEB_APP_URL || "https://community.tailed.ca"}/events/${resolvedEventId}`;
        await sendEventApprovalEmail(
          String(regData.email),
          String(regData.firstName || "there"),
          String(eventData.title || "your event"),
          eventLink
        );
      } catch (emailError) {
        console.error("Failed to send approval email:", emailError);
      }
    }

    // Update event-level attendee count if status changed to/from a positive attending state
    try {
      const regs = await db.collection("events").doc(resolvedEventId).collection("registrations").get();
      await db.collection("events").doc(resolvedEventId).update({ attendees: regs.size, updatedAt: new Date() });
    } catch (e) {
      console.error("Failed to update event attendee count after review:", e);
    }

    // Optionally: write an activity/audit log
    try {
      await db.collection("events").doc(resolvedEventId).collection("activity").add({
        type: "registration.review",
        registrationId,
        status,
        reviewNotes: reviewNotes || null,
        performedBy: userId,
        performedAt: new Date(),
      });
    } catch (e) {
      console.error("Failed to write activity log for registration review:", e);
    }

    return res.status(200).json({ success: true, message: "Registration updated" });
  } catch (error: any) {
    console.error("Error reviewing registration:", error);
    return res.status(500).json({ error: "Failed to review registration", details: error.message });
  }
});

export default router;

/**
 * GET /events/:eventId/ics
 * Public endpoint that returns a minimal .ics file for the event
 */
router.get('/:eventId/ics', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    // Resolve event by ID or slug
    const eventDoc = await resolveEvent(eventId);
    if (!eventDoc || !eventDoc.exists) {
      return res.status(404).send('Event not found');
    }

    const eventData: any = { id: eventDoc.id, ...eventDoc.data() };

    // Build DTSTART / DTEND in UTC format YYYYMMDDTHHMMSSZ
    const startIso = `${eventData.startDate}T${eventData.startTime}`;
    const startDT = DateTime.fromISO(startIso);

    if (!startDT.isValid) {
      return res.status(500).send('Invalid event start date/time');
    }

    let endDT: DateTime;

    if (eventData.endDate && eventData.endTime) {
      const endIso = `${eventData.endDate}T${eventData.endTime}`;
      endDT = DateTime.fromISO(endIso);

      if (!endDT.isValid) {
        return res.status(500).send('Invalid event end date/time');
      }
    } else {
      return res.status(500).send('Missing event end date/time');
    }

    if (endDT < startDT) {
      return res.status(500).send('Event end time is before start time');
    }

    const dtStart = startDT.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
    const dtEnd = endDT.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
    const summary = (eventData.title || 'Event').toString().replace(/\r?\n/g, ' ');
    const description = (eventData.description || '').toString().replace(/\r?\n/g, '\\n').replace(/[,;]/g, '');
    const location = (eventData.location || eventData.digitalLink || '').toString().replace(/\r?\n/g, ' ');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tailed//EN',
      'BEGIN:VEVENT',
      `UID:${eventData.id}@tailed`,
      `SUMMARY:${summary}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      `URL:${process.env.FRONTEND_URL || 'https://app.tailed.ca'}/events/${eventData.id}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="${(eventData.title || 'event').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics"`);
    return res.status(200).send(ics);
  } catch (error: any) {
    console.error('Error generating ICS:', error);
    return res.status(500).send('Failed to generate calendar file');
  }
});
