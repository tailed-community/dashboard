import { Router, Request, Response } from "express";
import { db } from "../lib/firebase";

const router = Router();

/**
 * GET /public/featured
 * Get featured event and top community for landing page
 */
router.get("/featured", async (req: Request, res: Response) => {
  try {
    // Get featured/upcoming event (next published event)
    const eventsSnapshot = await db
      .collection("events")
      .where("status", "==", "published")
      .where("datetime", ">=", new Date())
      .orderBy("datetime", "asc")
      .limit(1)
      .get();

    const featuredEvent = eventsSnapshot.empty
      ? null
      : { id: eventsSnapshot.docs[0].id, ...eventsSnapshot.docs[0].data() };

    // Get top community (by member count)
    const communitiesSnapshot = await db
      .collection("communities")
      .orderBy("memberCount", "desc")
      .limit(1)
      .get();

    const topCommunity = communitiesSnapshot.empty
      ? null
      : { id: communitiesSnapshot.docs[0].id, ...communitiesSnapshot.docs[0].data() };

    return res.status(200).json({
      success: true,
      featuredEvent,
      topCommunity,
    });
  } catch (error: any) {
    console.error("Error fetching featured content:", error);
    return res.status(500).json({
      error: "Failed to fetch featured content",
      details: error.message,
    });
  }
});

/**
 * GET /public/explore
 * Get events and communities for explore page
 */
router.get("/explore", async (req: Request, res: Response) => {
  try {
    const { eventLimit = "12", communityLimit = "12" } = req.query;

    // Get upcoming events
    const eventsSnapshot = await db
      .collection("events")
      .where("status", "==", "published")
      .where("datetime", ">=", new Date())
      .orderBy("datetime", "asc")
      .limit(parseInt(eventLimit as string, 10))
      .get();

    const events = eventsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get communities (sorted by member count)
    const communitiesSnapshot = await db
      .collection("communities")
      .orderBy("memberCount", "desc")
      .limit(parseInt(communityLimit as string, 10))
      .get();

    const communities = communitiesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      events,
      communities,
      counts: {
        events: events.length,
        communities: communities.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching explore content:", error);
    return res.status(500).json({
      error: "Failed to fetch explore content",
      details: error.message,
    });
  }
});

/**
 * GET /public/communities
 * Get all communities (public access)
 */
router.get("/communities", async (req: Request, res: Response) => {
  try {
    const { category, search, limit = "50" } = req.query;

    let query: FirebaseFirestore.Query = db.collection("communities");

    if (category && typeof category === "string") {
      query = query.where("category", "==", category);
    }

    query = query.orderBy("memberCount", "desc");

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
 * GET /public/communities/:identifier
 * Get a single community (public access)
 */
router.get("/communities/:identifier", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    let communityDoc;
    
    communityDoc = await db.collection("communities").doc(identifier).get();
    
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
 * GET /public/events
 * Get all events (public access)
 */
router.get("/events", async (req: Request, res: Response) => {
  try {
    const { 
      status = "published", 
      communityId, 
      category, 
      city, 
      upcoming, 
      limit = "50" 
    } = req.query;

    let query: FirebaseFirestore.Query = db.collection("events");

    if (status && typeof status === "string") {
      query = query.where("status", "==", status);
    }

    if (communityId && typeof communityId === "string") {
      query = query.where("communityId", "==", communityId);
    }

    if (category && typeof category === "string") {
      query = query.where("category", "==", category);
    }

    if (city && typeof city === "string") {
      query = query.where("city", "==", city);
    }

    if (upcoming === "true") {
      query = query.where("datetime", ">=", new Date());
      query = query.orderBy("datetime", "asc");
    } else {
      query = query.orderBy("datetime", "desc");
    }

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
 * GET /public/events/:identifier
 * Get a single event (public access)
 */
router.get("/events/:identifier", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    let eventDoc;
    
    eventDoc = await db.collection("events").doc(identifier).get();
    
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

export default router;
