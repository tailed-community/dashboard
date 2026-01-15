import { Router, Request, Response } from "express";
import { db, storage } from "../lib/firebase";
import { sendCommunityWelcomeEmail } from "../lib/email-service";
import { upsertStudentUser } from "../lib/user-management";
import { z } from "zod";
import Busboy from "busboy";

const router = Router();

// Validation schema for event creation
const createEventSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().min(10).max(5000),
  datetime: z.string(), // ISO date string
  location: z.string().min(1).max(500),
  capacity: z.number().int().positive().optional(),
  communityId: z.string().optional(),
  category: z.string().min(1),
  city: z.string().optional(),
  status: z.enum(["draft", "published", "cancelled"]).default("published"),
});

// Validation schema for event update
const updateEventSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  datetime: z.string().optional(),
  location: z.string().min(1).max(500).optional(),
  capacity: z.number().int().positive().optional(),
  category: z.string().min(1).optional(),
  city: z.string().optional(),
  status: z.enum(["draft", "published", "cancelled"]).optional(),
});

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
      query = query.where("datetime", ">=", new Date());
      query = query.orderBy("datetime", "asc");
    } else {
      query = query.orderBy("datetime", "desc");
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

    const eventData = {
      id: eventDoc.id,
      ...eventDoc.data(),
    };

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
 * POST /events
 * Create a new event (with file upload support)
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const contentType = req.headers["content-type"] || "";
    
    // Handle multipart form data (with file uploads)
    if (contentType.includes("multipart/form-data")) {
      const busboy = Busboy({ headers: req.headers as any });
      const fields: any = {};
      const fileUploads: Promise<string>[] = [];

      busboy.on("field", (fieldname, val) => {
        // Parse numbers
        if (fieldname === "capacity") {
          fields[fieldname] = parseInt(val, 10);
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

        const uploadPromise = new Promise<string>((resolve, reject) => {
          file.pipe(blobStream);
          
          blobStream.on("error", (err) => {
            console.error(`Upload error for ${fieldname}:`, err);
            reject(err);
          });

          blobStream.on("finish", async () => {
            try {
              await blob.makePublic();
              const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${filepath}`;
              fields[fieldname] = publicUrl;
              resolve(publicUrl);
            } catch (err) {
              reject(err);
            }
          });
        });

        fileUploads.push(uploadPromise);
      });

      busboy.on("finish", async () => {
        try {
          // Wait for all file uploads to complete
          await Promise.all(fileUploads);

          // Validate required fields
          const validationResult = createEventSchema.safeParse(fields);
          if (!validationResult.success) {
            return res.status(400).json({
              error: "Invalid request data",
              details: validationResult.error.errors,
            });
          }

          const eventData = validationResult.data;

          // Check if slug is unique
          const existingSlug = await db
            .collection("events")
            .where("slug", "==", eventData.slug)
            .limit(1)
            .get();

          if (!existingSlug.empty) {
            return res.status(400).json({ error: "Event slug already exists" });
          }

          // If communityId is provided, verify it exists and increment event count
          if (eventData.communityId) {
            const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
            if (!communityDoc.exists) {
              return res.status(400).json({ error: "Community not found" });
            }

            // Increment community event count
            await db.collection("communities").doc(eventData.communityId).update({
              eventCount: (communityDoc.data()?.eventCount || 0) + 1,
              updatedAt: new Date(),
            });
          }

          // Create event
          const eventRef = await db.collection("events").add({
            ...eventData,
            datetime: new Date(eventData.datetime),
            heroImage: fields.heroImage || null,
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

          return res.status(201).json({
            success: true,
            message: "Event created successfully",
            eventId: eventRef.id,
          });
        } catch (error: any) {
          console.error("Error creating event:", error);
          return res.status(500).json({
            error: "Failed to create event",
            details: error.message,
          });
        }
      });

      req.pipe(busboy);
      return; // Explicitly return to satisfy TypeScript
    } else {
      // Handle regular JSON request (no file uploads)
      const validationResult = createEventSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request data",
          details: validationResult.error.errors,
        });
      }

      const eventData = validationResult.data;

      // Check if slug is unique
      const existingSlug = await db
        .collection("events")
        .where("slug", "==", eventData.slug)
        .limit(1)
        .get();

      if (!existingSlug.empty) {
        return res.status(400).json({ error: "Event slug already exists" });
      }

      // If communityId is provided, verify it exists
      if (eventData.communityId) {
        const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
        if (!communityDoc.exists) {
          return res.status(400).json({ error: "Community not found" });
        }

        // Increment community event count
        await db.collection("communities").doc(eventData.communityId).update({
          eventCount: (communityDoc.data()?.eventCount || 0) + 1,
          updatedAt: new Date(),
        });
      }

      // Create event
      const eventRef = await db.collection("events").add({
        ...eventData,
        datetime: new Date(eventData.datetime),
        heroImage: null,
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

      return res.status(201).json({
        success: true,
        message: "Event created successfully",
        eventId: eventRef.id,
      });
    }
  } catch (error: any) {
    console.error("Error creating event:", error);
    return res.status(500).json({
      error: "Failed to create event",
      details: error.message,
    });
  }
});

/**
 * PATCH /events/:eventId
 * Update an event
 */
router.patch("/:eventId", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate request body
    const validationResult = updateEventSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const updates = validationResult.data;

    // Get event and verify user is the creator or community creator
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    // Check if user is event creator
    let isAuthorized = eventData.createdBy === userId;

    // If event has a community, check if user is community creator
    if (!isAuthorized && eventData.communityId) {
      const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
      const communityData = communityDoc.data();
      isAuthorized = communityData?.createdBy === userId;
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Only event or community creators can update event details" });
    }

    // Prepare update object
    const updateObj: any = {
      ...updates,
      updatedAt: new Date(),
    };

    // Convert datetime string to Date if provided
    if (updates.datetime) {
      updateObj.datetime = new Date(updates.datetime);
    }

    // Update event
    await db.collection("events").doc(eventId).update(updateObj);

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

    // Get event and verify user is the creator or community creator
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    // Check if user is event creator
    let isAuthorized = eventData.createdBy === userId;

    // If event has a community, check if user is community creator
    if (!isAuthorized && eventData.communityId) {
      const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
      const communityData = communityDoc.data();
      isAuthorized = communityData?.createdBy === userId;
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Only event or community creators can delete events" });
    }

    // Soft delete by setting status to cancelled
    await db.collection("events").doc(eventId).update({
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
const attendeeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

const importAttendeesSchema = z.object({
  attendees: z.array(attendeeSchema).min(1).max(500), // Limit to 500 per batch
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

    // Get event and verify it exists
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

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

    // Verify user is the community creator
    if (communityData.createdBy !== userId) {
      return res.status(403).json({ error: "Only community creators can import attendees" });
    }

    const results = {
      created: [] as string[],
      existing: [] as string[],
      registered: [] as string[],
      errors: [] as { email: string; error: string }[],
    };

    // Process each attendee
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
          
          const updatedEvents = events.includes(eventId)
            ? events
            : [...events, eventId];

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
          .doc(eventId)
          .collection("registrations")
          .where("userId", "==", upsertResult.userRecord.uid)
          .limit(1)
          .get();

        if (existingRegistration.empty) {
          // Create registration
          await db
            .collection("events")
            .doc(eventId)
            .collection("registrations")
            .add({
              userId: upsertResult.userRecord.uid,
              eventId,
              email: emailLower,
              firstName: attendee.firstName || "",
              lastName: attendee.lastName || "",
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
      .doc(eventId)
      .collection("registrations")
      .get();

    await db.collection("events").doc(eventId).update({
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

    // Get event
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    const eventData = eventDoc.data();
    if (!eventData) {
      return res.status(404).json({ error: "Event data not found" });
    }

    // Verify user has access (community creator or event creator)
    if (eventData.communityId) {
      const communityDoc = await db.collection("communities").doc(eventData.communityId).get();
      const communityData = communityDoc.data();
      if (communityData && communityData.createdBy !== userId && eventData.createdBy !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (eventData.createdBy !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get registrations
    const registrationsSnapshot = await db
      .collection("events")
      .doc(eventId)
      .collection("registrations")
      .orderBy("registeredAt", "desc")
      .get();

    const attendees = registrationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      attendees,
      count: attendees.length,
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
