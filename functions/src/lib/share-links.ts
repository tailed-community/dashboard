import crypto from "crypto";
import type { Request } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase";
import { frontendUrl } from "./env";

/**
 * Share links — the branded, trackable URLs a community hands to a sponsor.
 *
 * A link is a top-level `shareLinks/{shareId}` document rather than a
 * subcollection under the asset, because `/s/:shareId` and `/f/:shareId` are
 * public routes with no community context: a doc-id lookup resolves in one
 * read with no index, where a collection-group query would need one.
 *
 * Every asset gets one unlabeled link at upload time. Additional links can be
 * minted per recipient ("Desjardins", "Hydro-Québec") so the stats answer
 * *which outreach* got opened. That is attribution by link, NOT identity —
 * decks get forwarded, so a second open may well be a different person.
 *
 * Privacy: these pages are hit by people who never signed up for anything, and
 * an IP is personal information under Law 25 / PIPEDA / GDPR. We therefore
 * store a salted hash of the IP — enough to tell two visits apart, not enough
 * to re-identify anyone — plus the user agent. No raw IP is ever written.
 */

export const SHARE_LINKS_COLLECTION = "shareLinks";

export type ShareLinkKind = "marketing-asset";
export type ShareEventType = "view" | "download";

export interface ShareLinkData {
  kind: ShareLinkKind;
  communityId: string;
  assetId: string;
  /** Recipient this link was minted for, or null for the default link. */
  label: string | null;
  createdBy: string;
  createdAt: Date;
  revokedAt: Date | null;
  viewCount: number;
  downloadCount: number;
  lastViewedAt: Date | null;
  lastDownloadedAt: Date | null;
}

/**
 * 16 random bytes as base64url — 22 URL-safe characters, ~128 bits. The id IS
 * the secret (there is no other access check on /s and /f), so it has to be
 * far beyond guessing, and short enough to sit in an email without wrapping.
 */
export const newShareId = (): string => crypto.randomBytes(16).toString("base64url");

export const shareUrl = (shareId: string): string =>
  `${frontendUrl()}/s/${shareId}`;

export const shareDownloadUrl = (shareId: string): string =>
  `${frontendUrl()}/f/${shareId}`;

/**
 * User agents that are automated fetchers, not humans.
 *
 * The honest ones (link previewers, crawlers, curl) identify themselves and
 * are caught here. Corporate mail scanners are the reason this matters —
 * Microsoft Safe Links, Proofpoint and Mimecast fetch every URL in an inbound
 * email — but the aggressive ones deliberately impersonate a real browser, so
 * treat this as noise reduction, not a guarantee. Anything matching still gets
 * an event row (with `isBot: true`); it just doesn't move the counters that
 * the organizer reads as "a human opened my deck".
 */
const BOT_USER_AGENT =
  /(bot\b|crawler|spider|slurp|preview|scanner|scanning|curl\/|wget\/|python-requests|node-fetch|axios\/|headless|phantomjs|slackbot|twitterbot|facebookexternalhit|whatsapp|telegrambot|discordbot|linkedinbot|bingpreview|safelinks|proofpoint|mimecast|barracuda|urldefense|skypeuripreview|google-read-aloud|apache-httpclient|okhttp)/i;

export const looksLikeBot = (userAgent: string | undefined): boolean =>
  !userAgent || BOT_USER_AGENT.test(userAgent);

/**
 * Client IP as seen through Firebase Hosting / Cloud Run, which append the
 * caller to `x-forwarded-for`. The first entry is the original client.
 */
const clientIp = (req: Request): string | null => {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(",")[0]?.trim();
  return first || req.socket?.remoteAddress || null;
};

/**
 * Salted SHA-256 of the IP, truncated to 16 hex chars.
 *
 * The salt makes the hash useless as a lookup table against the (small) IPv4
 * space; without one, a hashed IP is trivially reversible and no better than
 * storing the address. Set SHARE_IP_SALT per environment; the fallback keeps
 * local dev working but offers no real protection, so it must be set in
 * anything that sees real traffic.
 */
const hashIp = (ip: string | null): string | null => {
  if (!ip) return null;
  const salt = process.env.SHARE_IP_SALT || "tailed-share-links";
  return crypto
    .createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex")
    .slice(0, 16);
};

/**
 * Appends an event to `shareLinks/{shareId}/events` and, for human traffic,
 * bumps the link's counters.
 *
 * Awaited by the caller rather than fired and forgotten: the Cloud Run
 * instance can be frozen the moment the response is flushed, which would drop
 * a floating promise and silently lose the event.
 */
export const recordShareEvent = async (
  shareId: string,
  type: ShareEventType,
  req: Request
): Promise<void> => {
  try {
    const userAgent = req.headers["user-agent"];
    const isBot = looksLikeBot(userAgent);
    const now = new Date();
    const linkRef = db.collection(SHARE_LINKS_COLLECTION).doc(shareId);

    const writes: Promise<unknown>[] = [
      linkRef.collection("events").add({
        type,
        at: now,
        isBot,
        ipHash: hashIp(clientIp(req)),
        userAgent: userAgent ? String(userAgent).slice(0, 400) : null,
        referrer: req.headers.referer ? String(req.headers.referer).slice(0, 400) : null,
      }),
    ];

    if (!isBot) {
      writes.push(
        linkRef.update(
          type === "view"
            ? { viewCount: FieldValue.increment(1), lastViewedAt: now }
            : { downloadCount: FieldValue.increment(1), lastDownloadedAt: now }
        )
      );
    }

    await Promise.all(writes);
  } catch (error) {
    // Never let bookkeeping break the thing the visitor actually came for.
    console.error(`[share-links] failed to record ${type} for ${shareId}:`, error);
  }
};
