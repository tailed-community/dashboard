/**
 * Pure onboarding-drip sequence logic (spec 08 §3.6 / §7).
 *
 * This module is deliberately FREE of firebase-admin / nodemailer imports so
 * the send-gating can be unit-tested without credentials (mirrors how the
 * jobs-digest dry-run imports the pure `matchJobsToSubscription`). The
 * scheduled function (`scheduled/onboarding-emails.ts`) owns all I/O — reading
 * profiles, sending mail, and writing state — and consumes `selectOnboardingStep`
 * to decide, per user per daily run, whether ONE email goes out and which.
 *
 * SEND-GATING IS THE CONTRACT. Over-sending is the failure mode we design
 * against, so every guard below is conservative: when in doubt, send nothing.
 */
import { DateTime } from "luxon";

export const TIME_ZONE = "America/Toronto";
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Minimum spacing between two onboarding emails: ">= ~3 days" (spec §3.6).
 * A 6h tolerance absorbs Cloud Scheduler drift so the intended day-3 / day-7 /
 * … send is not bumped to the next day, while any two-runs-apart (~24h /
 * ~48h) send stays comfortably blocked. Welcome (the first email) is exempt
 * from this rule because it has no previous `lastSentAt`.
 */
export const MIN_SEND_SPACING_MS = 3 * DAY_MS - 6 * 60 * 60 * 1000;

export type StepId =
  | "welcome"
  | "profile"
  | "community"
  | "event"
  | "values"
  | "selfid";

/**
 * Done/undone signals derived live from `profiles/{uid}` — never from stored
 * "step done" flags (spec §5). `sentStepsCount` lets `welcome` fire only as the
 * very first email in the sequence.
 */
export interface ProfileSignals {
  firstName: string;
  /** required set: firstName && school && program && graduationYear */
  hasRequiredSet: boolean;
  hasResume: boolean;
  /** communities[] non-empty */
  hasCommunity: boolean;
  /** events[] non-empty (an event registration exists) */
  hasEvent: boolean;
  /** workplaceValues present */
  hasValues: boolean;
  /** demographicSurveyCompletedAt present */
  hasSelfId: boolean;
}

export interface OnboardingSequenceState {
  /** step ids already sent, e.g. ["welcome","profile"] */
  sentSteps: string[];
  /** epoch ms of the previous onboarding email, or null if none sent */
  lastSentAtMs: number | null;
  /** manual/loose halt for cold non-engagers (spec Open-Q6) */
  stopped: boolean;
}

export interface OnboardingStepMeta {
  id: StepId;
  /** earliest day-since-signup this step may send */
  earliestDay: number;
  /** sensitive survey steps (values / self-id): late, soft, at-most-once */
  sensitive: boolean;
  /** in-app path the single CTA deep-links to (via buildSignInLink) */
  redirectPath: string;
  /** true when the action this step nudges is still OUTSTANDING */
  isOutstanding: (signals: ProfileSignals, sentStepsCount: number) => boolean;
}

/**
 * The 6-step sequence in PRIORITY ORDER (earliest wins = highest value).
 * A step sends only if its action is still undone AND its day has arrived.
 */
export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  {
    id: "welcome",
    earliestDay: 0,
    sensitive: false,
    redirectPath: "/account",
    // "always (if never sent any)": only ever the first email in the sequence.
    isOutstanding: (_signals, sentStepsCount) => sentStepsCount === 0,
  },
  {
    id: "profile",
    earliestDay: 3,
    sensitive: false,
    redirectPath: "/account",
    // required set incomplete OR no resume.
    isOutstanding: (s) => !s.hasRequiredSet || !s.hasResume,
  },
  {
    id: "community",
    earliestDay: 7,
    sensitive: false,
    redirectPath: "/communities",
    isOutstanding: (s) => !s.hasCommunity,
  },
  {
    id: "event",
    earliestDay: 10,
    sensitive: false,
    redirectPath: "/events",
    isOutstanding: (s) => !s.hasEvent,
  },
  {
    id: "values",
    earliestDay: 14,
    sensitive: true,
    redirectPath: "/account/survey/values",
    isOutstanding: (s) => !s.hasValues,
  },
  {
    id: "selfid",
    earliestDay: 18,
    sensitive: true,
    redirectPath: "/account/survey/self-id",
    isOutstanding: (s) => !s.hasSelfId,
  },
];

/** Whether two epoch-ms instants fall on the same calendar day in Toronto. */
export function isSameTorontoDay(aMs: number, bMs: number): boolean {
  const a = DateTime.fromMillis(aMs, { zone: TIME_ZONE }).toISODate();
  const b = DateTime.fromMillis(bMs, { zone: TIME_ZONE }).toISODate();
  return a === b;
}

export interface SelectionInput {
  createdAtMs: number | null;
  nowMs: number;
  state: OnboardingSequenceState;
  signals: ProfileSignals;
}

/**
 * The single source of truth for "does this user get an onboarding email today,
 * and which one?". Returns the chosen step's metadata, or null to send nothing.
 *
 * Guards, in order (all enforced — ACs 14–15):
 *   1. `stopped` → nothing.
 *   2. no `createdAt` → nothing (can't place them in the timeline).
 *   3. `lastSentAt` is TODAY (America/Toronto) → nothing. Never two the same day.
 *   4. spacing: < ~3 days since `lastSentAt` → nothing. Welcome is exempt
 *      (it has no `lastSentAt`, being the first send).
 *   5. among steps that are (a) not already in `sentSteps`, (b) whose
 *      `earliestDay <= daysSinceSignup`, and (c) whose action is still
 *      outstanding, pick the EARLIEST in the ordered list (highest value).
 *
 * Because a step lands in `sentSteps` after one send, the sensitive steps
 * (`values`, `selfid`) are naturally at-most-once, and — via `earliestDay`
 * 14/18 — never fire early.
 */
export function selectOnboardingStep(
  input: SelectionInput
): OnboardingStepMeta | null {
  const { createdAtMs, nowMs, state, signals } = input;

  // (1) hard stop for cold non-engagers.
  if (state.stopped) return null;

  // (2) no signup timestamp → we cannot compute days-since-signup, so skip.
  if (createdAtMs == null) return null;

  // (3) never two onboarding emails on the same Toronto calendar day.
  if (state.lastSentAtMs != null && isSameTorontoDay(state.lastSentAtMs, nowMs)) {
    return null;
  }

  // (4) spacing: require >= ~3 days since the previous email. Welcome is the
  //     first send (lastSentAtMs == null) and is exempt from this rule.
  if (
    state.lastSentAtMs != null &&
    nowMs - state.lastSentAtMs < MIN_SEND_SPACING_MS
  ) {
    return null;
  }

  const daysSinceSignup = Math.floor((nowMs - createdAtMs) / DAY_MS);
  const sentStepsCount = state.sentSteps.length;

  // (5) earliest eligible step wins.
  for (const step of ONBOARDING_STEPS) {
    if (state.sentSteps.includes(step.id)) continue; // already sent (=> at-most-once)
    if (daysSinceSignup < step.earliestDay) continue; // not due yet (sensitive never early)
    if (!step.isOutstanding(signals, sentStepsCount)) continue; // action done => suppress
    return step;
  }

  return null;
}
