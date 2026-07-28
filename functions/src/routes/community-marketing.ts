import { Router, Request, Response, NextFunction } from "express";
import Busboy from "busboy";
import crypto from "crypto";
import { z } from "zod";
import { db, storage } from "../lib/firebase";
import { logAdminAction, diffFields } from "../lib/admin-audit";
import { storageMediaUrl } from "../lib/storage-urls";
import {
  SHARE_LINKS_COLLECTION,
  newShareId,
  shareUrl,
  type ShareLinkData,
} from "../lib/share-links";

/**
 * Marketing & promotional assets for a community — sponsorship packages,
 * media kits, posters, one-pagers.
 *
 * Mounted by routes/community.ts at
 * `/communities/:communityId/marketing-assets`, so every handler here is
 * already scoped to one community and guarded by `requireCommunityAdmin`.
 *
 * Two deliberate choices:
 *
 *  - Files are stored under `communities/{communityId}/marketing/...` and
 *    served via a PERMANENT Firebase download-token URL, minted once at upload
 *    time and kept in the Firestore record. That is the point of the feature:
 *    an organizer copies the link and emails it to a prospective sponsor, who
 *    has no Tail'ed account. Token URLs bypass storage.rules (which is why no
 *    rule change is needed for the new path) — so treat every uploaded asset
 *    as "public to anyone holding the link", exactly like a Drive share link.
 *    Deleting the asset revokes it, because the object is deleted with it.
 *
 *  - Metadata lives in a `marketingAssets` subcollection rather than an array
 *    on the community document, so per-asset writes don't rewrite (and race
 *    on) the whole community doc, and the list can grow without bloating every
 *    read of the community.
 */

const router = Router({ mergeParams: true });

/** Buckets an organizer picks from; kept short so the filter stays scannable. */
export const MARKETING_ASSET_KINDS = [
  "sponsorship-package",
  "media-kit",
  "brand-assets",
  "poster",
  "one-pager",
  "other",
] as const;

type MarketingAssetKind = (typeof MARKETING_ASSET_KINDS)[number];

/**
 * Sponsorship decks are the heaviest thing organizers upload; 25MB covers a
 * design-heavy PDF export while staying well inside the Cloud Functions
 * request limit (32MB) that the whole multipart body has to fit in.
 */
const MAX_ASSET_BYTES = 25 * 1024 * 1024;

/** A per-community ceiling, so one community can't fill the bucket. */
const MAX_ASSETS_PER_COMMUNITY = 40;

/** Per-recipient links are cheap, but the list still has to stay readable. */
const MAX_LINKS_PER_ASSET = 50;

/**
 * Allowlist rather than a `application/*` prefix check: these files are handed
 * to third parties from a tailed.ca-adjacent URL, so executables, archives and
 * HTML (which would be served inline and could host script) stay out.
 */
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_TYPES_LABEL = "PDF, images, Word, PowerPoint or Excel files";

const assetMetadataSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional(),
  kind: z.enum(MARKETING_ASSET_KINDS).optional(),
});

const shareLinkSchema = z.object({
  /** Who this link is for — a company name, not an email address. */
  label: z.string().trim().min(1).max(80),
});

const assetUpdateSchema = assetMetadataSchema.partial().refine(
  (value) => Object.values(value).some((v) => v !== undefined),
  { message: "Nothing to update" }
);

type CommunityContext = {
  id: string;
  data: FirebaseFirestore.DocumentData;
  /** True when a platform admin is acting on a community they don't run. */
  actingAsPlatformAdmin: boolean;
};

const communityContext = (res: Response): CommunityContext =>
  res.locals.community as CommunityContext;

/**
 * Middleware: only community admins (or platform admins, who can manage any
 * community) may see or touch marketing assets. Mirrors the bypass rule used
 * by PATCH /communities/:communityId — the bypass is audit-logged on writes.
 */
const requireCommunityAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const communityId = req.params.communityId;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const communityDoc = await db.collection("communities").doc(communityId).get();
    const communityData = communityDoc.data();

    if (!communityDoc.exists || !communityData) {
      res.status(404).json({ error: "Community not found" });
      return;
    }

    const admins: string[] = Array.isArray(communityData.admins)
      ? communityData.admins
      : [];
    const isCommunityAdmin = admins.includes(userId);
    const isPlatformAdmin = req.user?.platformAdmin === true;

    if (!isCommunityAdmin && !isPlatformAdmin) {
      res
        .status(403)
        .json({ error: "Only community admins can manage marketing files" });
      return;
    }

    res.locals.community = {
      id: communityDoc.id,
      data: communityData,
      actingAsPlatformAdmin: isPlatformAdmin && !isCommunityAdmin,
    } satisfies CommunityContext;

    next();
  } catch (error: any) {
    console.error("Error resolving community for marketing assets:", error);
    res.status(500).json({
      error: "Failed to load community",
      details: error.message,
    });
  }
};

const assetsCollection = (communityId: string) =>
  db.collection("communities").doc(communityId).collection("marketingAssets");

/** Firestore Timestamp | Date | string -> ISO string the client can revive. */
const toIso = (value: any): string | null => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
};

/** One share link as the admin UI sees it. */
const serializeLink = (
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
) => {
  const data = doc.data() ?? {};
  return {
    shareId: doc.id,
    label: data.label ?? null,
    url: shareUrl(doc.id),
    viewCount: typeof data.viewCount === "number" ? data.viewCount : 0,
    downloadCount: typeof data.downloadCount === "number" ? data.downloadCount : 0,
    lastViewedAt: toIso(data.lastViewedAt),
    lastDownloadedAt: toIso(data.lastDownloadedAt),
    revokedAt: toIso(data.revokedAt),
    createdAt: toIso(data.createdAt),
  };
};

type SerializedLink = ReturnType<typeof serializeLink>;

const serializeAsset = (
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
  links: SerializedLink[] = []
) => {
  const data = doc.data() ?? {};
  const active = links.filter((link) => !link.revokedAt);

  return {
    id: doc.id,
    title: data.title ?? "",
    description: data.description ?? "",
    kind: (data.kind ?? "other") as MarketingAssetKind,
    fileName: data.fileName ?? "",
    contentType: data.contentType ?? "",
    size: typeof data.size === "number" ? data.size : 0,
    // The raw Storage URL. Kept for the admin's own "Download" button; the
    // link handed to sponsors is `shareUrl` below, which is trackable and
    // revocable.
    downloadUrl: data.downloadUrl ?? null,
    shareUrl: data.defaultShareId ? shareUrl(data.defaultShareId) : null,
    links,
    // Totals across every link, revoked ones included — a download that
    // already happened still happened.
    viewCount: links.reduce((total, link) => total + link.viewCount, 0),
    downloadCount: links.reduce((total, link) => total + link.downloadCount, 0),
    activeLinkCount: active.length,
    uploadedBy: data.uploadedBy ?? null,
    uploadedByEmail: data.uploadedByEmail ?? null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
};

/**
 * Creates a share link for an asset.
 *
 * `label` is the recipient this link is for ("Desjardins"), or null for the
 * default link every asset gets at upload.
 */
const createShareLink = async (
  communityId: string,
  assetId: string,
  createdBy: string,
  label: string | null
): Promise<string> => {
  const shareId = newShareId();

  const linkData: ShareLinkData = {
    kind: "marketing-asset",
    communityId,
    assetId,
    label,
    createdBy,
    createdAt: new Date(),
    revokedAt: null,
    viewCount: 0,
    downloadCount: 0,
    lastViewedAt: null,
    lastDownloadedAt: null,
  };

  await db.collection(SHARE_LINKS_COLLECTION).doc(shareId).set(linkData);
  return shareId;
};

/** Every share link for a community, grouped by the asset it points at. */
const linksByAsset = async (
  communityId: string
): Promise<Map<string, SerializedLink[]>> => {
  const snapshot = await db
    .collection(SHARE_LINKS_COLLECTION)
    .where("communityId", "==", communityId)
    .get();

  const grouped = new Map<string, SerializedLink[]>();

  for (const doc of snapshot.docs) {
    const assetId = doc.data().assetId;
    if (!assetId) continue;
    const link = serializeLink(doc);
    const existing = grouped.get(assetId);
    if (existing) existing.push(link);
    else grouped.set(assetId, [link]);
  }

  // Default link (no label) first, then newest.
  for (const links of grouped.values()) {
    links.sort((a, b) => {
      if (!a.label && b.label) return -1;
      if (a.label && !b.label) return 1;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
  }

  return grouped;
};

type ParsedUpload = {
  fields: Record<string, string>;
  file?: { buffer: Buffer; fileName: string; contentType: string };
  /** Set when the single accepted file blew past MAX_ASSET_BYTES. */
  tooLarge: boolean;
  /** Set when a file was offered with a content type we don't accept. */
  rejectedContentType?: string;
};

/**
 * Reads the multipart body: at most one file (field name `file`) plus the text
 * fields. Rejected and oversized files are drained rather than buffered, so a
 * bad upload never holds 25MB+ of memory.
 */
const parseUpload = (req: Request): Promise<ParsedUpload> =>
  new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers as any,
      limits: { fileSize: MAX_ASSET_BYTES, files: 1, fields: 10 },
    });

    const result: ParsedUpload = { fields: {}, tooLarge: false };
    let settled = false;

    busboy.on("field", (fieldname, value) => {
      result.fields[fieldname] = value;
    });

    busboy.on("file", (fieldname, file, info) => {
      const { filename, mimeType } = info;

      if (fieldname !== "file" || !ALLOWED_CONTENT_TYPES.has(mimeType)) {
        if (fieldname === "file") result.rejectedContentType = mimeType;
        file.resume();
        return;
      }

      const chunks: Buffer[] = [];
      let truncated = false;

      file.on("limit", () => {
        truncated = true;
        result.tooLarge = true;
      });
      file.on("data", (chunk: Buffer) => {
        if (!truncated) chunks.push(chunk);
      });
      file.on("end", () => {
        if (truncated) return; // leave result.file unset; POST 413s
        result.file = {
          buffer: Buffer.concat(chunks),
          fileName: filename || "file",
          contentType: mimeType,
        };
      });
      file.on("error", (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      });
    });

    busboy.on("finish", () => {
      if (settled) return;
      settled = true;
      resolve(result);
    });

    busboy.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    // Firebase Functions buffers the body onto req.rawBody and the stream is
    // already consumed; a plain node/express dev server still streams it.
    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  });

/** Keeps the original name recognizable while making it safe as an object name. */
const sanitizeFileName = (name: string): string => {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+/, "");
  return (cleaned || "file").slice(0, 80);
};

/**
 * GET /communities/:communityId/marketing-assets
 * List every marketing asset, newest first, with its share links and stats.
 */
router.get("/", requireCommunityAdmin, async (req: Request, res: Response) => {
  try {
    const { id: communityId } = communityContext(res);
    const userId = req.user?.uid as string;

    const [snapshot, grouped] = await Promise.all([
      assetsCollection(communityId).orderBy("createdAt", "desc").get(),
      linksByAsset(communityId),
    ]);

    // Assets uploaded before share links existed have no default link. Mint
    // one on first read rather than shipping a migration for a table this
    // small — the alternative is a row whose "Copy link" button does nothing.
    const backfilled = snapshot.docs.filter((doc) => !doc.data()?.defaultShareId);
    if (backfilled.length > 0) {
      await Promise.all(
        backfilled.map(async (doc) => {
          const shareId = await createShareLink(communityId, doc.id, userId, null);
          await doc.ref.update({ defaultShareId: shareId });
          const linkDoc = await db
            .collection(SHARE_LINKS_COLLECTION)
            .doc(shareId)
            .get();
          grouped.set(doc.id, [
            serializeLink(linkDoc),
            ...(grouped.get(doc.id) ?? []),
          ]);
        })
      );
    }

    const assets = await Promise.all(
      snapshot.docs.map(async (doc) => {
        // Re-read only the docs we just touched, so `defaultShareId` is
        // present in the response that triggered the backfill.
        const fresh = backfilled.some((b) => b.id === doc.id)
          ? await doc.ref.get()
          : doc;
        return serializeAsset(fresh, grouped.get(doc.id) ?? []);
      })
    );

    return res.status(200).json({
      success: true,
      assets,
      limits: {
        maxBytes: MAX_ASSET_BYTES,
        maxAssets: MAX_ASSETS_PER_COMMUNITY,
      },
    });
  } catch (error: any) {
    console.error("Error listing marketing assets:", error);
    return res.status(500).json({
      error: "Failed to load marketing files",
      details: error.message,
    });
  }
});

/**
 * POST /communities/:communityId/marketing-assets
 * Upload one file plus its metadata (multipart/form-data).
 */
router.post("/", requireCommunityAdmin, async (req: Request, res: Response) => {
  try {
    const community = communityContext(res);
    const userId = req.user?.uid as string;

    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({
        error: "Upload must be sent as multipart/form-data",
      });
    }

    const parsed = await parseUpload(req);

    if (parsed.tooLarge) {
      return res.status(413).json({
        error: `That file is larger than ${Math.round(
          MAX_ASSET_BYTES / (1024 * 1024)
        )}MB`,
      });
    }

    if (parsed.rejectedContentType) {
      return res.status(415).json({
        error: `Unsupported file type. Upload ${ALLOWED_TYPES_LABEL}.`,
      });
    }

    if (!parsed.file || parsed.file.buffer.length === 0) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const validation = assetMetadataSchema.safeParse({
      title: parsed.fields.title,
      description: parsed.fields.description || undefined,
      kind: parsed.fields.kind || undefined,
    });

    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validation.error.errors,
      });
    }

    const existing = await assetsCollection(community.id).count().get();
    if (existing.data().count >= MAX_ASSETS_PER_COMMUNITY) {
      return res.status(409).json({
        error: `This community already has the maximum of ${MAX_ASSETS_PER_COMMUNITY} marketing files. Delete one to add another.`,
      });
    }

    const assetRef = assetsCollection(community.id).doc();
    const safeName = sanitizeFileName(parsed.file.fileName);
    const storagePath = `communities/${community.id}/marketing/${assetRef.id}-${safeName}`;
    const token = crypto.randomUUID();

    await storage
      .bucket()
      .file(storagePath)
      .save(parsed.file.buffer, {
        metadata: {
          contentType: parsed.file.contentType,
          // Content-Disposition keeps a shared link from rendering an SVG (or
          // anything else) inline in the sponsor's browser.
          contentDisposition: `attachment; filename="${safeName}"`,
          metadata: {
            firebaseStorageDownloadTokens: token,
            uploadedBy: userId,
            communityId: community.id,
          },
        },
      });

    // Every asset ships with one unlabeled share link, so "Copy link" works
    // the moment the upload finishes.
    const defaultShareId = await createShareLink(
      community.id,
      assetRef.id,
      userId,
      null
    );

    const now = new Date();
    const assetData = {
      title: validation.data.title,
      description: validation.data.description ?? "",
      kind: validation.data.kind ?? ("other" as MarketingAssetKind),
      fileName: parsed.file.fileName,
      contentType: parsed.file.contentType,
      size: parsed.file.buffer.length,
      storagePath,
      downloadUrl: storageMediaUrl(storagePath, token),
      defaultShareId,
      uploadedBy: userId,
      uploadedByEmail: req.user?.email ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await assetRef.set(assetData);

    if (community.actingAsPlatformAdmin) {
      await logAdminAction(req, {
        action: "update",
        resourceType: "community",
        resourceId: community.id,
        resourceName: community.data.name,
        changes: [
          {
            field: `marketingAssets/${assetRef.id}`,
            before: null,
            after: `added "${assetData.title}" (${assetData.fileName})`,
          },
        ],
      });
    }

    const [created, defaultLink] = await Promise.all([
      assetRef.get(),
      db.collection(SHARE_LINKS_COLLECTION).doc(defaultShareId).get(),
    ]);

    return res.status(201).json({
      success: true,
      message: "Marketing file uploaded",
      asset: serializeAsset(created, [serializeLink(defaultLink)]),
    });
  } catch (error: any) {
    console.error("Error uploading marketing asset:", error);
    return res.status(500).json({
      error: "Failed to upload marketing file",
      details: error.message,
    });
  }
});

/**
 * PATCH /communities/:communityId/marketing-assets/:assetId
 * Rename / re-describe / re-categorize an asset. The file itself is immutable;
 * replacing it means uploading a new one and deleting the old.
 */
router.patch(
  "/:assetId",
  requireCommunityAdmin,
  async (req: Request, res: Response) => {
    try {
      const community = communityContext(res);
      const { assetId } = req.params;

      const validation = assetUpdateSchema.safeParse(req.body ?? {});
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request data",
          details: validation.error.errors,
        });
      }

      const assetRef = assetsCollection(community.id).doc(assetId);
      const assetDoc = await assetRef.get();
      const assetData = assetDoc.data();

      if (!assetDoc.exists || !assetData) {
        return res.status(404).json({ error: "Marketing file not found" });
      }

      const updates = {
        ...(validation.data.title !== undefined && { title: validation.data.title }),
        ...(validation.data.description !== undefined && {
          description: validation.data.description,
        }),
        ...(validation.data.kind !== undefined && { kind: validation.data.kind }),
        updatedAt: new Date(),
      };

      await assetRef.update(updates);

      if (community.actingAsPlatformAdmin) {
        await logAdminAction(req, {
          action: "update",
          resourceType: "community",
          resourceId: community.id,
          resourceName: community.data.name,
          changes: diffFields(assetData, updates).map((change) => ({
            ...change,
            field: `marketingAssets/${assetId}.${change.field}`,
          })),
        });
      }

      const [updated, links] = await Promise.all([
        assetRef.get(),
        linksByAsset(community.id),
      ]);

      return res.status(200).json({
        success: true,
        message: "Marketing file updated",
        asset: serializeAsset(updated, links.get(assetId) ?? []),
      });
    } catch (error: any) {
      console.error("Error updating marketing asset:", error);
      return res.status(500).json({
        error: "Failed to update marketing file",
        details: error.message,
      });
    }
  }
);

/**
 * DELETE /communities/:communityId/marketing-assets/:assetId
 * Removes the Storage object (which revokes any link already shared) and the
 * metadata record.
 */
router.delete(
  "/:assetId",
  requireCommunityAdmin,
  async (req: Request, res: Response) => {
    try {
      const community = communityContext(res);
      const { assetId } = req.params;

      const assetRef = assetsCollection(community.id).doc(assetId);
      const assetDoc = await assetRef.get();
      const assetData = assetDoc.data();

      if (!assetDoc.exists || !assetData) {
        return res.status(404).json({ error: "Marketing file not found" });
      }

      if (assetData.storagePath) {
        try {
          await storage
            .bucket()
            .file(assetData.storagePath)
            .delete({ ignoreNotFound: true });
        } catch (storageError) {
          // A missing object must not strand the Firestore record — that would
          // leave an undeletable row pointing at nothing.
          console.error(
            `Failed to delete marketing object ${assetData.storagePath}:`,
            storageError
          );
        }
      }

      // Share links live in a top-level collection, so they don't disappear
      // with the asset — and a link left pointing at a deleted asset would
      // keep serving 404s forever. recursiveDelete also clears each link's
      // `events` subcollection, which a plain delete would orphan.
      const linkDocs = await db
        .collection(SHARE_LINKS_COLLECTION)
        .where("assetId", "==", assetId)
        .where("communityId", "==", community.id)
        .get();
      await Promise.all(linkDocs.docs.map((doc) => db.recursiveDelete(doc.ref)));

      await assetRef.delete();

      if (community.actingAsPlatformAdmin) {
        await logAdminAction(req, {
          action: "delete",
          resourceType: "community",
          resourceId: community.id,
          resourceName: community.data.name,
          changes: [
            {
              field: `marketingAssets/${assetId}`,
              before: `"${assetData.title}" (${assetData.fileName})`,
              after: null,
            },
          ],
        });
      }

      return res.status(200).json({
        success: true,
        message: "Marketing file deleted",
      });
    } catch (error: any) {
      console.error("Error deleting marketing asset:", error);
      return res.status(500).json({
        error: "Failed to delete marketing file",
        details: error.message,
      });
    }
  }
);

/**
 * POST /communities/:communityId/marketing-assets/:assetId/links
 * Mint a per-recipient share link.
 *
 * One link per company you send to means the stats read "Desjardins opened it
 * twice, never downloaded" instead of an anonymous total. It attributes the
 * OUTREACH, not the person: links get forwarded inside an organization, so a
 * second open may be a different reader.
 */
router.post(
  "/:assetId/links",
  requireCommunityAdmin,
  async (req: Request, res: Response) => {
    try {
      const community = communityContext(res);
      const userId = req.user?.uid as string;
      const { assetId } = req.params;

      const validation = shareLinkSchema.safeParse(req.body ?? {});
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request data",
          details: validation.error.errors,
        });
      }

      const assetDoc = await assetsCollection(community.id).doc(assetId).get();
      if (!assetDoc.exists) {
        return res.status(404).json({ error: "Marketing file not found" });
      }

      const existing = await db
        .collection(SHARE_LINKS_COLLECTION)
        .where("assetId", "==", assetId)
        .where("communityId", "==", community.id)
        .count()
        .get();

      if (existing.data().count >= MAX_LINKS_PER_ASSET) {
        return res.status(409).json({
          error: `This file already has ${MAX_LINKS_PER_ASSET} share links. Revoke one to create another.`,
        });
      }

      const shareId = await createShareLink(
        community.id,
        assetId,
        userId,
        validation.data.label
      );
      const linkDoc = await db.collection(SHARE_LINKS_COLLECTION).doc(shareId).get();

      return res.status(201).json({
        success: true,
        message: "Share link created",
        link: serializeLink(linkDoc),
      });
    } catch (error: any) {
      console.error("Error creating share link:", error);
      return res.status(500).json({
        error: "Failed to create share link",
        details: error.message,
      });
    }
  }
);

/**
 * POST /communities/:communityId/marketing-assets/:assetId/links/:shareId/revoke
 *
 * Revokes rather than deletes: the link stops resolving (410), but its view and
 * download history survives — which is the whole reason the link existed.
 */
router.post(
  "/:assetId/links/:shareId/revoke",
  requireCommunityAdmin,
  async (req: Request, res: Response) => {
    try {
      const community = communityContext(res);
      const { assetId, shareId } = req.params;

      const linkRef = db.collection(SHARE_LINKS_COLLECTION).doc(shareId);
      const linkDoc = await linkRef.get();
      const linkData = linkDoc.data();

      // Check ownership explicitly: the share id is a top-level key, so
      // without this any community admin could revoke any other community's
      // link by guessing... or by pasting one they were sent.
      if (
        !linkDoc.exists ||
        !linkData ||
        linkData.communityId !== community.id ||
        linkData.assetId !== assetId
      ) {
        return res.status(404).json({ error: "Share link not found" });
      }

      if (linkData.revokedAt) {
        return res.status(409).json({ error: "That link is already revoked" });
      }

      await linkRef.update({ revokedAt: new Date() });
      const updated = await linkRef.get();

      return res.status(200).json({
        success: true,
        message: "Share link revoked",
        link: serializeLink(updated),
      });
    } catch (error: any) {
      console.error("Error revoking share link:", error);
      return res.status(500).json({
        error: "Failed to revoke share link",
        details: error.message,
      });
    }
  }
);

export default router;
