import { Router, Request, Response } from "express";
import { db } from "../lib/firebase";
import { frontendUrl } from "../lib/env";
import { storageMediaUrl } from "../lib/storage-urls";
import {
  SHARE_LINKS_COLLECTION,
  recordShareEvent,
  shareDownloadUrl,
} from "../lib/share-links";

/**
 * Public share routes — no auth, the share id IS the credential.
 *
 *   GET /s/:shareId   branded landing page for one marketing asset
 *   GET /f/:shareId   302 to the file itself
 *
 * Reached through the Firebase Hosting rewrites in firebase.json, so a sponsor
 * sees `community.tailed.ca/s/...` rather than a bucket URL. Both routes are
 * rendered server-side: it keeps the page instant, gives link previews real
 * Open Graph tags, and — the point of the exercise — means every open is
 * logged by our own code instead of by an analytics script an ad blocker or a
 * corporate network can drop.
 */

const router = Router();

/** Local copy — email-service.ts keeps its own private one. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatBytes = (bytes: number): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileTypeLabel = (contentType: string): string => {
  if (contentType === "application/pdf") return "PDF";
  if (contentType.startsWith("image/")) return "Image";
  if (contentType.includes("presentation") || contentType.includes("powerpoint"))
    return "Slides";
  if (contentType.includes("sheet") || contentType.includes("excel"))
    return "Spreadsheet";
  if (contentType.includes("word")) return "Document";
  return "File";
};

/* --------------------------------- Layout -------------------------------- */

const PALETTE = {
  surface: "#FFFBF0",
  card: "#FFFFFF",
  ink: "#2B2118",
  inkMuted: "#6B5D4F",
  grass: "#2E7D02",
  grassDeep: "#1F5C01",
  border: "rgba(43, 33, 24, 0.10)",
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const page = ({
  title,
  description,
  body,
  imageUrl,
  status,
}: {
  title: string;
  description: string;
  body: string;
  imageUrl?: string | null;
  status?: number;
}): { status: number; html: string } => ({
  status: status ?? 200,
  html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<!-- Shared links are pasted into Slack, LinkedIn and email; without these the
     preview card is blank. noindex because a share id is meant to be private. -->
<meta name="robots" content="noindex, nofollow" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />` : ""}
<meta name="twitter:card" content="summary" />
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 20px; min-height: 100vh;
    background: ${PALETTE.surface}; color: ${PALETTE.ink};
    font-family: ${FONT}; line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 560px; margin: 0 auto; }
  .card {
    background: ${PALETTE.card}; border: 1px solid ${PALETTE.border};
    border-radius: 24px; padding: 32px; box-shadow: 0 8px 24px rgba(43,33,24,0.06);
  }
  .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
  .logo-wrap { position: relative; width: 52px; height: 52px; flex-shrink: 0; }
  .logo, .logo-fallback {
    position: absolute; inset: 0; width: 52px; height: 52px;
    border-radius: 14px; object-fit: cover; border: 1px solid ${PALETTE.border};
  }
  .logo-fallback {
    display: flex; align-items: center; justify-content: center;
    background: ${PALETTE.surface}; color: ${PALETTE.grass};
    font-size: 24px; font-weight: 800;
  }
  .brand-name { font-size: 15px; font-weight: 700; }
  .brand-kicker {
    font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: ${PALETTE.inkMuted};
  }
  h1 { font-size: 26px; line-height: 1.25; font-weight: 800; margin: 0 0 12px; }
  .desc { color: ${PALETTE.inkMuted}; margin: 0 0 24px; white-space: pre-wrap; }
  .meta {
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
    font-size: 12px; font-weight: 600; color: ${PALETTE.inkMuted}; margin-bottom: 28px;
  }
  .chip {
    background: ${PALETTE.surface}; border: 1px solid ${PALETTE.border};
    border-radius: 999px; padding: 5px 12px;
  }
  .cta {
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; padding: 16px 28px; border-radius: 999px;
    background: ${PALETTE.grass}; color: #fff; font-size: 16px; font-weight: 700;
    text-decoration: none; border: none; cursor: pointer;
    box-shadow: 0 4px 12px rgba(46,125,2,0.25);
  }
  .cta:hover { background: ${PALETTE.grassDeep}; }
  .foot {
    margin-top: 24px; text-align: center;
    font-size: 12px; color: ${PALETTE.inkMuted};
  }
  .foot a { color: ${PALETTE.inkMuted}; }
  @media (prefers-color-scheme: dark) {
    /* The page is deliberately light in both schemes: it stands in for a
       printed one-pager, and a half-inverted brand sheet looks broken. */
    body { background: ${PALETTE.surface}; color: ${PALETTE.ink}; }
  }
</style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`,
});

const errorPage = (heading: string, message: string, status: number) =>
  page({
    title: heading,
    description: message,
    status,
    body: `<div class="card">
      <h1>${escapeHtml(heading)}</h1>
      <p class="desc">${escapeHtml(message)}</p>
      <a class="cta" href="${escapeHtml(frontendUrl())}">Go to Tail'ed</a>
    </div>`,
  });

const send = (
  res: Response,
  rendered: { status: number; html: string }
): void => {
  // Firebase Hosting will happily cache a function response; caching either of
  // these would mean an open that never reaches us.
  res.set("Cache-Control", "no-store");
  res.status(rendered.status).type("html").send(rendered.html);
};

/* -------------------------------- Resolution ------------------------------ */

type ResolvedShare = {
  shareId: string;
  link: FirebaseFirestore.DocumentData;
  asset: FirebaseFirestore.DocumentData;
  community: FirebaseFirestore.DocumentData | null;
};

type ShareFailure = { failure: "not-found" | "revoked" };

const resolveShare = async (
  shareId: string
): Promise<ResolvedShare | ShareFailure> => {
  const linkDoc = await db.collection(SHARE_LINKS_COLLECTION).doc(shareId).get();
  const link = linkDoc.data();

  if (!linkDoc.exists || !link) return { failure: "not-found" };
  if (link.revokedAt) return { failure: "revoked" };

  const assetDoc = await db
    .collection("communities")
    .doc(link.communityId)
    .collection("marketingAssets")
    .doc(link.assetId)
    .get();
  const asset = assetDoc.data();

  // The asset was deleted but the link outlived it — same story for the
  // visitor as a link that never existed.
  if (!assetDoc.exists || !asset) return { failure: "not-found" };

  const communityDoc = await db
    .collection("communities")
    .doc(link.communityId)
    .get();

  return { shareId, link, asset, community: communityDoc.data() ?? null };
};

const isFailure = (
  result: ResolvedShare | ShareFailure
): result is ShareFailure => "failure" in result;

const NOT_FOUND = () =>
  errorPage(
    "This link isn't available",
    "It may have been revoked by the community, or the file was removed. Ask whoever sent it for a fresh link.",
    404
  );

const REVOKED = () =>
  errorPage(
    "This link has been turned off",
    "The community revoked this share link. Get in touch with them for an up-to-date copy.",
    410
  );

/* --------------------------------- Routes -------------------------------- */

/**
 * GET /s/:shareId — the branded landing page.
 */
router.get("/s/:shareId", async (req: Request, res: Response) => {
  try {
    const resolved = await resolveShare(req.params.shareId);

    if (isFailure(resolved)) {
      send(res, resolved.failure === "revoked" ? REVOKED() : NOT_FOUND());
      return;
    }

    const { asset, community } = resolved;
    await recordShareEvent(req.params.shareId, "view", req);

    const communityName = community?.name ?? "A Tail'ed community";
    const logoUrl = community?.logo ? storageMediaUrl(community.logo) : null;
    const title = asset.title || asset.fileName || "Shared file";
    const size = formatBytes(asset.size ?? 0);

    // The initial always renders underneath; the logo sits on top and hides
    // itself if the object is missing or renamed. Layering it this way keeps
    // every piece of user-controlled text in a text node — an onerror handler
    // that rebuilt the fallback would put an escaped community name inside a
    // JS string literal, where HTML entity decoding runs before JS parsing.
    const initial = escapeHtml(communityName.charAt(0).toUpperCase());
    const logoMarkup = `<div class="logo-wrap">
      <div class="logo-fallback">${initial}</div>
      ${
        logoUrl
          ? `<img class="logo" src="${escapeHtml(
              logoUrl
            )}" alt="" onerror="this.style.display='none'" />`
          : ""
      }
    </div>`;

    send(
      res,
      page({
        title: `${title} — ${communityName}`,
        description:
          asset.description || `${communityName} shared "${title}" with you.`,
        imageUrl: logoUrl,
        body: `<div class="card">
          <div class="brand">
            ${logoMarkup}
            <div>
              <div class="brand-kicker">Shared by</div>
              <div class="brand-name">${escapeHtml(communityName)}</div>
            </div>
          </div>
          <h1>${escapeHtml(title)}</h1>
          ${
            asset.description
              ? `<p class="desc">${escapeHtml(asset.description)}</p>`
              : ""
          }
          <div class="meta">
            <span class="chip">${escapeHtml(
              fileTypeLabel(asset.contentType ?? "")
            )}</span>
            ${size ? `<span class="chip">${escapeHtml(size)}</span>` : ""}
          </div>
          <a class="cta" href="${escapeHtml(
            shareDownloadUrl(req.params.shareId)
          )}">Download</a>
        </div>
        <p class="foot">Shared via <a href="${escapeHtml(
          frontendUrl()
        )}">Tail'ed</a></p>`,
      })
    );
  } catch (error) {
    console.error("Error rendering share page:", error);
    send(
      res,
      errorPage(
        "Something went wrong",
        "We couldn't load this file right now. Please try again in a moment.",
        500
      )
    );
  }
});

/**
 * GET /f/:shareId — hands over the file itself.
 *
 * A 302 to the Storage token URL rather than a proxy: the bytes come straight
 * from GCS (no function egress, no 25MB-through-the-function), and we still
 * see — and log — every request.
 */
router.get("/f/:shareId", async (req: Request, res: Response) => {
  try {
    const resolved = await resolveShare(req.params.shareId);

    if (isFailure(resolved)) {
      send(res, resolved.failure === "revoked" ? REVOKED() : NOT_FOUND());
      return;
    }

    if (!resolved.asset.downloadUrl) {
      send(
        res,
        errorPage(
          "This file isn't available",
          "The file is missing from storage. Ask the community to re-upload it.",
          404
        )
      );
      return;
    }

    await recordShareEvent(req.params.shareId, "download", req);

    res.set("Cache-Control", "no-store");
    res.redirect(302, resolved.asset.downloadUrl);
  } catch (error) {
    console.error("Error resolving share download:", error);
    send(
      res,
      errorPage(
        "Something went wrong",
        "We couldn't start this download. Please try again in a moment.",
        500
      )
    );
  }
});

export default router;
