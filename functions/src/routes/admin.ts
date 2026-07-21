import { Router, Request, Response } from "express";
import { db, requirePlatformAdmin, auth } from "../lib/firebase";

const router = Router();

/**
 * Platform-admin-only routes that aren't scoped to a single resource type.
 * Resource-scoped admin endpoints (moderation queues, admin browse, ownership
 * transfer) live alongside their resource in routes/event.ts and
 * routes/community.ts.
 */

/**
 * GET /admin/audit-log
 * The record of every privileged write made via the platform-admin bypass.
 *
 * Supports ?resourceType=event|community, ?resourceId=, ?actorUid= and
 * ?limit=. Actor display names are resolved in one batched Auth lookup rather
 * than per row, so a page of 100 entries costs one extra call, not 100.
 */
router.get("/audit-log", requirePlatformAdmin(), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || "100", 10) || 100, 500);
    const resourceType = (req.query.resourceType as string) || "";
    const resourceId = (req.query.resourceId as string) || "";
    const actorUid = (req.query.actorUid as string) || "";

    let query: FirebaseFirestore.Query = db.collection("adminAuditLog");

    // Each equality filter combines with the createdAt sort, which Firestore
    // cannot serve from single-field indexes — every combination below has a
    // matching composite index declared in firestore.indexes.json.
    if (resourceType) query = query.where("resourceType", "==", resourceType);
    if (resourceId) query = query.where("resourceId", "==", resourceId);
    if (actorUid) query = query.where("actorUid", "==", actorUid);

    const snapshot = await query.orderBy("createdAt", "desc").limit(limit).get();

    const entries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Resolve actor display names in one batch. Missing users (deleted
    // accounts) simply don't get a name — the uid and email on the entry
    // remain the source of truth.
    const uids = [...new Set(entries.map((e: any) => e.actorUid).filter(Boolean))];
    const namesByUid: Record<string, string> = {};

    if (uids.length > 0) {
      try {
        const result = await auth.getUsers(uids.map((uid) => ({ uid: uid as string })));
        for (const user of result.users) {
          if (user.displayName) namesByUid[user.uid] = user.displayName;
        }
      } catch (error) {
        console.error("[admin] failed to resolve audit actor names", error);
      }
    }

    return res.status(200).json({
      success: true,
      entries: entries.map((entry: any) => ({
        ...entry,
        actorName: namesByUid[entry.actorUid] ?? null,
      })),
      count: entries.length,
    });
  } catch (error: any) {
    console.error("Error fetching admin audit log:", error);
    return res.status(500).json({
      error: "Failed to fetch audit log",
      details: error.message,
    });
  }
});

export default router;
