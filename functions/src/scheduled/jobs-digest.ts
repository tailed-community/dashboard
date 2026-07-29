import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldPath, type Timestamp } from "firebase-admin/firestore";
import { db } from "../lib/firebase";
import { fetchDigestJobs, type DigestJob } from "../lib/jobs-feed";
import {
  isDigestDue,
  matchJobsToSubscription,
  type DigestSubscriptionLike,
} from "../lib/digest-matching";
import { sendJobsDigestEmail } from "../lib/email-service";
import { buildUnsubscribeUrl } from "../lib/links";
import { getPreferredLocaleForUid, type Locale } from "../lib/locale";

const SUBSCRIPTIONS_COLLECTION = "jobAlertSubscriptions";
const DIGEST_RUNS_COLLECTION = "digestRuns";
const SUBSCRIPTION_BATCH_SIZE = 300;
const MAX_JOBS_PER_EMAIL = 12;
const SEND_CONCURRENCY = 5;
/** Never-sent subscriptions get at most a 7-day backlog, to avoid dumping ~11k jobs in one email. */
const NEVER_SENT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

interface JobAlertSubscriptionDoc extends DigestSubscriptionLike {
  id: string;
  email: string;
  active: boolean;
  unsubscribeToken: string;
  createdAt: Timestamp | Date | null;
  lastSentJobDate: number | null;
  /** Cadence chosen by the subscriber. Legacy docs without it are daily. */
  frequency: "daily" | "weekly";
  /** When this subscription last received a digest — the weekly cadence gate. */
  lastSentAt: Timestamp | Date | null;
  /** owning profile uid (null for anonymous captures) — used to resolve locale. */
  userId: string | null;
}

function toEpochMs(value: Timestamp | Date | null | undefined): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const maybeTimestamp = value as Timestamp;
  if (typeof maybeTimestamp.toMillis === "function") {
    return maybeTimestamp.toMillis();
  }
  return 0;
}

/**
 * Watermark = last sent job's `date_added` (epoch ms), else — for a
 * subscription that has never sent — `max(createdAt, now - 7 days)` so the
 * first-ever digest doesn't dump the entire historical backlog.
 */
function computeWatermark(sub: JobAlertSubscriptionDoc, now: number): number {
  if (typeof sub.lastSentJobDate === "number") {
    return sub.lastSentJobDate;
  }
  const createdAtMs = toEpochMs(sub.createdAt);
  return Math.max(createdAtMs, now - NEVER_SENT_LOOKBACK_MS);
}

/** Cadence gate for one subscription — see `isDigestDue` for the rule. */
function isDue(sub: JobAlertSubscriptionDoc, now: number): boolean {
  return isDigestDue(sub.frequency, toEpochMs(sub.lastSentAt) || null, now);
}

async function fetchActiveSubscriptions(): Promise<JobAlertSubscriptionDoc[]> {
  const subs: JobAlertSubscriptionDoc[] = [];
  let lastDocId: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  for (;;) {
    let query = db
      .collection(SUBSCRIPTIONS_COLLECTION)
      .where("active", "==", true)
      .orderBy(FieldPath.documentId())
      .limit(SUBSCRIPTION_BATCH_SIZE);

    if (lastDocId) {
      query = query.startAfter(lastDocId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      subs.push({
        id: doc.id,
        email: data.email,
        query: data.query ?? null,
        jobType: data.jobType ?? null,
        locations: data.locations ?? null,
        active: data.active,
        unsubscribeToken: data.unsubscribeToken,
        createdAt: data.createdAt ?? null,
        lastSentJobDate: typeof data.lastSentJobDate === "number" ? data.lastSentJobDate : null,
        frequency: data.frequency === "weekly" ? "weekly" : "daily",
        lastSentAt: data.lastSentAt ?? null,
        userId: typeof data.userId === "string" ? data.userId : null,
      });
    }

    lastDocId = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < SUBSCRIPTION_BATCH_SIZE) break;
  }

  return subs;
}

/** Hand-rolled bounded concurrency runner (no new deps, per spec). */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  }
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => next()));
}

export interface RunJobsDigestOptions {
  dryRun?: boolean;
}

export interface RunJobsDigestSummary {
  subscribers: number;
  emailsSent: number;
  skippedNoMatches: number;
  /** Weekly subscriptions whose next send isn't due yet in this run. */
  skippedNotDue: number;
  errors: number;
}

/**
 * Runs one pass of the jobs digest: fetches the feed once, then for every
 * active subscription that is due in this run (see `isDue` — daily always,
 * weekly once a week) computes new matches since its watermark, caps at 12,
 * sends (unless dryRun), and advances the watermark on success only.
 * Exported as a plain function so it's directly callable from the dry-run
 * script without going through the Cloud Scheduler trigger.
 */
export async function runJobsDigest(
  options: RunJobsDigestOptions = {}
): Promise<RunJobsDigestSummary> {
  const dryRun = options.dryRun ?? process.env.DIGEST_DRY_RUN === "true";
  const now = Date.now();

  const summary: RunJobsDigestSummary = {
    subscribers: 0,
    emailsSent: 0,
    skippedNoMatches: 0,
    skippedNotDue: 0,
    errors: 0,
  };

  let jobs: DigestJob[];
  try {
    jobs = await fetchDigestJobs();
  } catch (error) {
    console.error("jobs-digest: failed to fetch jobs feed, aborting run", error);
    return summary;
  }

  const subscriptions = await fetchActiveSubscriptions();
  summary.subscribers = subscriptions.length;

  // Cache profile→locale reads across the run: several subscriptions can share
  // one owning uid, and we never want to re-read the same profile doc. Keyed by
  // uid; anonymous captures (no userId) skip the lookup and default to "en".
  const localeCache = new Map<string, Promise<Locale>>();
  const resolveLocale = (uid: string | null): Promise<Locale> => {
    if (!uid) return Promise.resolve("en");
    let cached = localeCache.get(uid);
    if (!cached) {
      cached = getPreferredLocaleForUid(uid);
      localeCache.set(uid, cached);
    }
    return cached;
  };

  await runWithConcurrency(subscriptions, SEND_CONCURRENCY, async (sub) => {
    try {
      // Cadence gate first — a weekly subscriber that isn't due yet must not
      // have its watermark advanced, or the roles it skipped today would never
      // appear in the digest it does receive.
      if (!isDue(sub, now)) {
        summary.skippedNotDue += 1;
        return;
      }

      const watermark = computeWatermark(sub, now);
      const candidates = jobs.filter((job) => job.dateAddedMs > watermark);
      const matched = matchJobsToSubscription(candidates, sub);

      if (matched.length === 0) {
        summary.skippedNoMatches += 1;
        return;
      }

      const toSend = matched.slice(0, MAX_JOBS_PER_EMAIL);
      // Watermark advances past all of `matched`, not just `toSend`: when more than
      // MAX_JOBS_PER_EMAIL jobs match in one run, the newest 12 are emailed and the
      // watermark still jumps to the newest match. The older overflow is intentionally
      // not carried forward to the next digest (spec'd tradeoff) — those jobs simply
      // remain visible on the site.
      const newWatermark = toSend.reduce((max, job) => Math.max(max, job.dateAddedMs), watermark);

      if (dryRun) {
        console.log("jobs-digest[dry-run] would send", {
          subscriptionId: sub.id,
          email: sub.email,
          frequency: sub.frequency,
          query: sub.query,
          jobType: sub.jobType,
          locations: sub.locations,
          matchCount: matched.length,
          sendCount: toSend.length,
        });
        return;
      }

      const unsubscribeUrl = buildUnsubscribeUrl(sub.unsubscribeToken);
      const locale = await resolveLocale(sub.userId);
      await sendJobsDigestEmail(sub.email, toSend, {
        query: sub.query,
        unsubscribeUrl,
        totalMatchCount: matched.length,
        locale,
        frequency: sub.frequency,
      });

      // Atomically advance the subscription watermark AND record the batch
      // history (digestRuns) in a single WriteBatch so a partial failure can't
      // leave the watermark moved without a corresponding run record.
      const sentAt = new Date();
      const subscriptionRef = db.collection(SUBSCRIPTIONS_COLLECTION).doc(sub.id);
      const runRef = subscriptionRef.collection(DIGEST_RUNS_COLLECTION).doc();

      const batch = db.batch();
      batch.update(subscriptionRef, {
        lastSentAt: sentAt,
        lastSentJobDate: newWatermark,
      });
      batch.set(runRef, {
        sentAt,
        jobIds: toSend.map((job) => job.id),
        jobCount: toSend.length,
        matchedCount: matched.length,
        watermarkBefore: sub.lastSentJobDate,
        watermarkAfter: newWatermark,
      });
      await batch.commit();

      summary.emailsSent += 1;
    } catch (error) {
      summary.errors += 1;
      console.error("jobs-digest: failed to process subscription", sub.id, error);
    }
  });

  console.log("jobs-digest: run complete", summary);
  return summary;
}

export const jobsDigest = onSchedule(
  {
    schedule: "every day 07:30",
    timeZone: "America/Toronto",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    await runJobsDigest();
  }
);
