/**
 * Onboarding email drip engine (spec 08 §3.6 / §7).
 *
 * A daily `onSchedule` scan of `profiles` that, per user, decides whether to
 * send ONE onboarding email based on per-user Firestore state
 * (`profiles/{uid}.onboardingEmails`). It reuses the jobs-digest cron shape:
 * batched pagination over the collection, bounded concurrency, and an atomic
 * per-user state write after a successful send.
 *
 * All send-gating lives in the pure `selectOnboardingStep` (lib/onboarding-
 * sequence.ts) so it can be unit-tested without credentials. Over-sending is
 * the failure mode we guard against — see that module for the ordered guards.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldPath, type Timestamp } from "firebase-admin/firestore";
import { db } from "../lib/firebase";
import { buildSignInLink } from "../lib/auth-links";
import { normalizeLocale, type Locale } from "../lib/locale";
import {
  DAY_MS,
  selectOnboardingStep,
  type ProfileSignals,
  type OnboardingSequenceState,
  type StepId,
} from "../lib/onboarding-sequence";
import {
  sendOnboardingWelcomeEmail,
  sendOnboardingProfileEmail,
  sendOnboardingCommunityEmail,
  sendOnboardingEventEmail,
  sendOnboardingValuesEmail,
  sendOnboardingSelfIdEmail,
} from "../lib/email-service";

const PROFILES_COLLECTION = "profiles";
const PROFILE_BATCH_SIZE = 300;
const SEND_CONCURRENCY = 5;

/** step id → sender. Each sender honors the dev console.log short-circuit. */
const SENDERS: Record<
  StepId,
  (
    email: string,
    firstName: string,
    ctaUrl: string,
    locale: Locale
  ) => Promise<unknown>
> = {
  welcome: sendOnboardingWelcomeEmail,
  profile: sendOnboardingProfileEmail,
  community: sendOnboardingCommunityEmail,
  event: sendOnboardingEventEmail,
  values: sendOnboardingValuesEmail,
  selfid: sendOnboardingSelfIdEmail,
};

interface ProfileRow {
  id: string;
  email: string | null;
  firstName: string;
  createdAtMs: number | null;
  state: OnboardingSequenceState;
  signals: ProfileSignals;
  /** communication language (spec 08 §5.1); defaults to "en". */
  locale: Locale;
}

function toEpochMs(value: Timestamp | Date | null | undefined): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const ts = value as Timestamp;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return null;
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/** Projects a raw profile doc into the fields the sequence logic needs. */
function toProfileRow(id: string, data: Record<string, any>): ProfileRow {
  const rawState = (data.onboardingEmails ?? {}) as Record<string, any>;
  const state: OnboardingSequenceState = {
    sentSteps: Array.isArray(rawState.sentSteps)
      ? rawState.sentSteps.filter((s: unknown): s is string => typeof s === "string")
      : [],
    lastSentAtMs: toEpochMs(rawState.lastSentAt),
    stopped: rawState.stopped === true,
  };

  const hasRequiredSet =
    nonEmptyString(data.firstName) &&
    nonEmptyString(data.school) &&
    nonEmptyString(data.program) &&
    nonEmptyString(data.graduationYear);

  const signals: ProfileSignals = {
    firstName: typeof data.firstName === "string" ? data.firstName : "",
    hasRequiredSet,
    hasResume: nonEmptyString(data.resume?.url) || nonEmptyString(data.resume?.id),
    hasCommunity: nonEmptyArray(data.communities),
    hasEvent: nonEmptyArray(data.events),
    hasValues: data.workplaceValues != null,
    hasSelfId: data.demographicSurveyCompletedAt != null,
  };

  return {
    id,
    email: nonEmptyString(data.email) ? (data.email as string).trim() : null,
    firstName: signals.firstName,
    createdAtMs: toEpochMs(data.createdAt),
    state,
    signals,
    locale: normalizeLocale(data.preferredLanguage),
  };
}

async function fetchProfiles(): Promise<ProfileRow[]> {
  const rows: ProfileRow[] = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  for (;;) {
    let query = db
      .collection(PROFILES_COLLECTION)
      .orderBy(FieldPath.documentId())
      .limit(PROFILE_BATCH_SIZE);

    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      rows.push(toProfileRow(doc.id, doc.data() || {}));
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < PROFILE_BATCH_SIZE) break;
  }

  return rows;
}

/** Hand-rolled bounded concurrency runner (mirrors jobs-digest, no new deps). */
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

export interface RunOnboardingEmailsOptions {
  dryRun?: boolean;
}

export interface RunOnboardingEmailsSummary {
  profiles: number;
  emailsSent: number;
  skipped: number;
  errors: number;
  byStep: Record<string, number>;
}

/**
 * Runs one pass of the onboarding drip: paginates `profiles`, and for each
 * user selects at most ONE outstanding step (respecting spacing + state),
 * sends it (unless dryRun), then appends the step id to `sentSteps` and sets
 * `lastSentAt`. Exported plainly so the dry-run script can call it directly.
 */
export async function runOnboardingEmails(
  options: RunOnboardingEmailsOptions = {}
): Promise<RunOnboardingEmailsSummary> {
  const dryRun = options.dryRun ?? process.env.ONBOARDING_DRY_RUN === "true";
  const nowMs = Date.now();

  const summary: RunOnboardingEmailsSummary = {
    profiles: 0,
    emailsSent: 0,
    skipped: 0,
    errors: 0,
    byStep: {},
  };

  const profiles = await fetchProfiles();
  summary.profiles = profiles.length;

  await runWithConcurrency(profiles, SEND_CONCURRENCY, async (row) => {
    try {
      const step = selectOnboardingStep({
        createdAtMs: row.createdAtMs,
        nowMs,
        state: row.state,
        signals: row.signals,
      });

      if (!step) {
        summary.skipped += 1;
        return;
      }

      if (!row.email) {
        // Selected a step but we have no address to send to — never send blind.
        summary.skipped += 1;
        console.warn("onboarding-emails: profile has no email, skipping", row.id);
        return;
      }

      const daysSinceSignup =
        row.createdAtMs != null
          ? Math.floor((nowMs - row.createdAtMs) / DAY_MS)
          : null;

      if (dryRun) {
        console.log("onboarding-emails[dry-run] would send", {
          profileId: row.id,
          email: row.email,
          step: step.id,
          sensitive: step.sensitive,
          daysSinceSignup,
          alreadySent: row.state.sentSteps,
        });
        summary.byStep[step.id] = (summary.byStep[step.id] ?? 0) + 1;
        return;
      }

      const ctaUrl = await buildSignInLink(row.email, step.redirectPath);
      await SENDERS[step.id](row.email, row.firstName, ctaUrl, row.locale);

      // Atomically append the step id and stamp lastSentAt. `set(..., {merge:true})`
      // deep-merges the onboardingEmails map: sentSteps (array) is replaced with
      // the new full array, lastSentAt is updated, and any existing `stopped`
      // flag is preserved. Written via WriteBatch to mirror the digest pattern.
      const sentAt = new Date();
      const profileRef = db.collection(PROFILES_COLLECTION).doc(row.id);
      const batch = db.batch();
      batch.set(
        profileRef,
        {
          onboardingEmails: {
            sentSteps: [...row.state.sentSteps, step.id],
            lastSentAt: sentAt,
          },
        },
        { merge: true }
      );
      await batch.commit();

      summary.emailsSent += 1;
      summary.byStep[step.id] = (summary.byStep[step.id] ?? 0) + 1;
    } catch (error) {
      summary.errors += 1;
      console.error("onboarding-emails: failed to process profile", row.id, error);
    }
  });

  console.log("onboarding-emails: run complete", summary);
  return summary;
}

/**
 * Daily scan at 08:00 America/Toronto (30 min after the jobs digest, so the two
 * never contend). Sends at most one onboarding email per user per day.
 */
export const onboardingEmails = onSchedule(
  {
    schedule: "every day 08:00",
    timeZone: "America/Toronto",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    await runOnboardingEmails();
  }
);
