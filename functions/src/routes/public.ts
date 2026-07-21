import { Router, Request, Response } from "express";
import { db } from "../lib/firebase";
import { DateTime } from "luxon";

const router = Router();

// Mirrors the moderationStatus legacy rule in routes/event.ts: events
// created before moderation shipped have no `moderationStatus` field and
// are treated as approved. These public surfaces must never leak
// pending/rejected (independent-host) events.
const isApprovedEvent = (data: FirebaseFirestore.DocumentData | undefined): boolean => {
  const status = data?.moderationStatus;
  return status !== "pending" && status !== "rejected";
};

// Mirrors the status legacy rule in routes/community.ts: communities
// created before moderation shipped have no `status` field and are
// treated as approved.
const isApprovedCommunity = (data: FirebaseFirestore.DocumentData | undefined): boolean => {
  const status = data?.status;
  return status !== "pending" && status !== "rejected";
};

/**
 * GET /public/featured
 * Get featured event and top community for landing page
 */
router.get("/featured", async (req: Request, res: Response) => {
  try {
    // Get featured/upcoming event (next published event). Pull a small batch
    // (rather than just the single soonest one) so we can prefer the first
    // one that actually has a hero image — an imageless event fails the
    // frontend's featurability gate and would otherwise empty that column.
    const eventsSnapshot = await db
      .collection("events")
      .where("status", "==", "published")
      .where("startDate", ">=", DateTime.now().toISODate())
      .orderBy("startDate", "asc")
      .limit(10)
      .get();

    const eventDocs = eventsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as any))
      .filter((evt) => isApprovedEvent(evt));
    const featuredEvent =
      eventDocs.find((evt) => Boolean(evt.heroImage)) ?? eventDocs[0] ?? null;

    // Get top communities (by member count). Pull a small batch and prefer
    // the first one that passes the frontend's featurability gate (enough
    // members, has a logo/banner, has a description) rather than blindly
    // returning whichever has the most members — a gate-failing community
    // would otherwise empty that column.
    const communitiesSnapshot = await db
      .collection("communities")
      .orderBy("memberCount", "desc")
      .limit(10)
      .get();

    const communityDocs = communitiesSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as any))
      .filter((c) => isApprovedCommunity(c));
    const topCommunity =
      communityDocs.find(
        (c) =>
          (c.memberCount ?? 0) >= 25 &&
          Boolean(c.logo || c.banner) &&
          Boolean(c.shortDescription && String(c.shortDescription).trim().length > 0)
      ) ?? communityDocs[0] ?? null;

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
 * Get events, communities, and companies for explore page
 */
router.get("/explore", async (req: Request, res: Response) => {
  try {
    const { 
      eventLimit = "12", 
      communityLimit = "12",
    } = req.query;

    // Get upcoming events
    const eventsSnapshot = await db
      .collection("events")
      .where("status", "==", "published")
      .where("startDate", ">=", DateTime.now().toISODate())
      .orderBy("startDate", "asc")
      .limit(parseInt(eventLimit as string, 10))
      .get();

    const events = eventsSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((event) => isApprovedEvent(event));

    // Get communities (sorted by member count)
    const communitiesSnapshot = await db
      .collection("communities")
      .orderBy("memberCount", "desc")
      .limit(parseInt(communityLimit as string, 10))
      .get();

    const communities = communitiesSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((community) => isApprovedCommunity(community));

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
    let communities = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((community) => isApprovedCommunity(community));

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

    const rawCommunityData = communityDoc.data() || {};

    if (!isApprovedCommunity(rawCommunityData)) {
      const userId = req.user?.uid;
      const admins = Array.isArray(rawCommunityData.admins) ? rawCommunityData.admins : [];
      const isAuthorized =
        !!userId &&
        (admins.includes(userId) ||
          rawCommunityData.createdBy === userId ||
          req.user?.platformAdmin === true);

      if (!isAuthorized) {
        return res.status(404).json({ error: "Community not found" });
      }
    }

    const communityData = {
      id: communityDoc.id,
      ...rawCommunityData,
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
      query = query.where("startDate", ">=", DateTime.now().toISODate());
      query = query.orderBy("startDate", "asc");
    } else {
      query = query.where("startDate", "<", DateTime.now().toISODate());
      query = query.orderBy("startDate", "desc");
    }

    const limitNum = parseInt(limit as string, 10);
    if (limitNum > 0 && limitNum <= 100) {
      query = query.limit(limitNum);
    }

    const snapshot = await query.get();
    const events = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((event) => isApprovedEvent(event));

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

    const rawData = eventDoc.data() || {};

    if (!isApprovedEvent(rawData)) {
      const userId = req.user?.uid;
      let isAuthorized = !!userId && (rawData.createdBy === userId || req.user?.platformAdmin === true);

      if (!isAuthorized && userId && rawData.communityId) {
        const communityDoc = await db.collection("communities").doc(rawData.communityId).get();
        const admins = communityDoc.data()?.admins || [];
        isAuthorized = admins.includes(userId);
      }

      if (!isAuthorized) {
        return res.status(404).json({ error: "Event not found" });
      }
    }

    // Mirror the `canEdit` flag from the authed GET /events/:identifier so the
    // public detail page can render an edit affordance for whoever is allowed
    // to use it. Deriving this client-side from `createdBy` alone would miss
    // community admins, who can edit their community's events without having
    // created them.
    const requesterId = req.user?.uid;
    const requesterIsPlatformAdmin = req.user?.platformAdmin === true;
    let canEdit = requesterIsPlatformAdmin || (!!requesterId && rawData.createdBy === requesterId);

    if (!canEdit && requesterId && rawData.communityId) {
      const communityDoc = await db.collection("communities").doc(rawData.communityId).get();
      const admins = communityDoc.data()?.admins || [];
      canEdit = admins.includes(requesterId);
    }

    const eventData = {
      id: eventDoc.id,
      ...rawData,
      canEdit,
      editingAsPlatformAdmin: requesterIsPlatformAdmin && rawData.createdBy !== requesterId,
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
 * GET /public/companies
 * Get all companies (public access)
 */
router.get("/companies", async (req: Request, res: Response) => {
  try {
    const { industry, search, limit = "50" } = req.query;

    let query: FirebaseFirestore.Query = db.collection("organizations");

    if (industry && typeof industry === "string") {
      query = query.where("industry", "==", industry);
    }

    // Order by a field that exists (you can adjust based on your needs)
    // For now, we'll just get them without specific ordering
    const limitNum = parseInt(limit as string, 10);
    if (limitNum > 0 && limitNum <= 100) {
      query = query.limit(limitNum);
    }

    const snapshot = await query.get();
    let companies = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Apply client-side search filter if provided
    if (search && typeof search === "string") {
      const searchLower = search.toLowerCase();
      companies = companies.filter((company: any) =>
        company.name?.toLowerCase().includes(searchLower) ||
        company.description?.toLowerCase().includes(searchLower)
      );
    }

    return res.status(200).json({
      success: true,
      companies,
      count: companies.length,
    });
  } catch (error: any) {
    console.error("Error fetching companies:", error);
    return res.status(500).json({
      error: "Failed to fetch companies",
      details: error.message,
    });
  }
});

/**
 * GET /public/companies/:identifier
 * Get a single company (public access)
 */
router.get("/companies/:identifier", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    let companyDoc;
    
    companyDoc = await db.collection("organizations").doc(identifier).get();
    
    if (!companyDoc.exists) {
      const slugQuery = await db
        .collection("organizations")
        .where("slug", "==", identifier)
        .limit(1)
        .get();

      if (!slugQuery.empty) {
        companyDoc = slugQuery.docs[0];
      }
    }

    if (!companyDoc.exists) {
      return res.status(404).json({ error: "Company not found" });
    }

    const companyData = {
      id: companyDoc.id,
      ...companyDoc.data(),
    };

    // Optionally, fetch related jobs for this company
    const jobsSnapshot = await db
      .collection("jobs")
      .where("organizationId", "==", companyDoc.id)
      .where("status", "==", "Active")
      .orderBy("postingDate", "desc")
      .limit(10)
      .get();

    const jobs = jobsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      company: {
        ...companyData,
        jobs,
      },
    });
  } catch (error: any) {
    console.error("Error fetching company:", error);
    return res.status(500).json({
      error: "Failed to fetch company",
      details: error.message,
    });
  }
});

export default router;
