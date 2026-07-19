/**
 * Dry-run + lightweight test script for the onboarding email drip (spec 08 §7).
 *
 * Usage: `npm --prefix functions run onboarding:dry`
 *
 * Step 1 (always runs, no network/Firestore needed): inline unit tests against
 * the pure `selectOnboardingStep` — the send-gating that must never over-send.
 * Exits non-zero immediately if any assertion fails.
 *
 * Step 2 (best-effort): attempts a real dry run — `runOnboardingEmails({ dryRun:
 * true })` — which reads real `profiles`, logs who WOULD get which step, and
 * sends no email / writes no state. Skipped with a clear message when Firestore
 * credentials aren't available; it never fails the script (the unit tests are
 * the pass/fail signal).
 */
import {
  selectOnboardingStep,
  DAY_MS,
  type ProfileSignals,
  type OnboardingSequenceState,
} from "../lib/onboarding-sequence";

const NOW = Date.parse("2026-07-18T12:00:00-04:00"); // fixed Toronto noon

/** All actions outstanding by default (a brand-new profile). */
function signals(overrides: Partial<ProfileSignals> = {}): ProfileSignals {
  return {
    firstName: "Sam",
    hasRequiredSet: false,
    hasResume: false,
    hasCommunity: false,
    hasEvent: false,
    hasValues: false,
    hasSelfId: false,
    ...overrides,
  };
}

function state(overrides: Partial<OnboardingSequenceState> = {}): OnboardingSequenceState {
  return { sentSteps: [], lastSentAtMs: null, stopped: false, ...overrides };
}

function daysAgo(n: number): number {
  return NOW - n * DAY_MS;
}

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failures += 1;
    console.error(`  FAIL: ${message}`);
  }
}

function test(name: string, fn: () => void) {
  console.log(`- ${name}`);
  fn();
}

console.log("Running selectOnboardingStep gating tests...\n");

test("day 0 fresh signup gets welcome", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(0),
    nowMs: NOW,
    state: state(),
    signals: signals(),
  });
  assert(step?.id === "welcome", "expected welcome on day 0");
});

test("stopped => nothing", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(0),
    nowMs: NOW,
    state: state({ stopped: true }),
    signals: signals(),
  });
  assert(step === null, "expected no send when stopped");
});

test("missing createdAt => nothing", () => {
  const step = selectOnboardingStep({
    createdAtMs: null,
    nowMs: NOW,
    state: state(),
    signals: signals(),
  });
  assert(step === null, "expected no send without a signup timestamp");
});

test("never two the same day: lastSentAt earlier today => nothing", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(3),
    nowMs: NOW,
    // sent welcome 4 hours ago (same Toronto day) — spacing would also block,
    // but the same-day guard alone must stop it.
    state: state({ sentSteps: ["welcome"], lastSentAtMs: NOW - 4 * 60 * 60 * 1000 }),
    signals: signals(),
  });
  assert(step === null, "expected no second email on the same day");
});

test("spacing: only 2 days since last email => nothing even if a step is due", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(7),
    nowMs: NOW,
    state: state({ sentSteps: ["welcome"], lastSentAtMs: daysAgo(2) }),
    signals: signals(),
  });
  assert(step === null, "expected spacing (>=3d) to block a 2-day-later send");
});

test("spacing satisfied at day 3 => profile", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(3),
    nowMs: NOW,
    state: state({ sentSteps: ["welcome"], lastSentAtMs: daysAgo(3) }),
    signals: signals(),
  });
  assert(step?.id === "profile", "expected profile on day 3 after spacing");
});

test("profile suppressed when required set + resume already done => community if due", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(7),
    nowMs: NOW,
    state: state({ sentSteps: ["welcome"], lastSentAtMs: daysAgo(4) }),
    signals: signals({ hasRequiredSet: true, hasResume: true }),
  });
  assert(step?.id === "community", "expected profile skipped (done) and community chosen");
});

test("all functional actions done => nothing before sensitive days", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(11),
    nowMs: NOW,
    state: state({ sentSteps: ["welcome"], lastSentAtMs: daysAgo(4) }),
    signals: signals({
      hasRequiredSet: true,
      hasResume: true,
      hasCommunity: true,
      hasEvent: true,
    }),
  });
  assert(step === null, "expected nothing when all functional actions done and day < 14");
});

test("values (sensitive) NOT before day 14", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(13),
    nowMs: NOW,
    state: state({ sentSteps: ["welcome", "profile"], lastSentAtMs: daysAgo(5) }),
    signals: signals({
      hasRequiredSet: true,
      hasResume: true,
      hasCommunity: true,
      hasEvent: true,
    }),
  });
  assert(step === null, "expected no values email on day 13");
});

test("values sends on day 14 when workplaceValues absent", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(14),
    nowMs: NOW,
    state: state({ sentSteps: ["welcome", "profile"], lastSentAtMs: daysAgo(5) }),
    signals: signals({
      hasRequiredSet: true,
      hasResume: true,
      hasCommunity: true,
      hasEvent: true,
    }),
  });
  assert(step?.id === "values", "expected values on day 14");
});

test("values never re-sends once in sentSteps (at most once)", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(20),
    nowMs: NOW,
    state: state({
      sentSteps: ["welcome", "profile", "community", "event", "values"],
      lastSentAtMs: daysAgo(4),
    }),
    signals: signals({
      hasRequiredSet: true,
      hasResume: true,
      hasCommunity: true,
      hasEvent: true,
      // still no workplaceValues, but values already sent — must not repeat.
    }),
  });
  assert(step?.id === "selfid", "expected selfid (not a repeat values) on day 20");
});

test("selfid (sensitive) NOT before day 18", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(17),
    nowMs: NOW,
    state: state({
      sentSteps: ["welcome", "profile", "community", "event", "values"],
      lastSentAtMs: daysAgo(4),
    }),
    signals: signals({
      hasRequiredSet: true,
      hasResume: true,
      hasCommunity: true,
      hasEvent: true,
    }),
  });
  assert(step === null, "expected no selfid email on day 17");
});

test("selfid suppressed when demographic survey already completed", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(20),
    nowMs: NOW,
    state: state({
      sentSteps: ["welcome", "profile", "community", "event", "values"],
      lastSentAtMs: daysAgo(4),
    }),
    signals: signals({
      hasRequiredSet: true,
      hasResume: true,
      hasCommunity: true,
      hasEvent: true,
      hasSelfId: true,
    }),
  });
  assert(step === null, "expected selfid suppressed when already completed");
});

test("welcome only ever the first email (never resurrected)", () => {
  const step = selectOnboardingStep({
    createdAtMs: daysAgo(3),
    nowMs: NOW,
    // welcome missing from sentSteps but another step was sent first —
    // welcome's condition (sentStepsCount === 0) must keep it from firing.
    state: state({ sentSteps: ["profile"], lastSentAtMs: daysAgo(3) }),
    signals: signals({ hasRequiredSet: true, hasResume: true }),
  });
  assert(step?.id !== "welcome", "expected welcome not to fire once other steps sent");
});

if (failures > 0) {
  console.error(`\n${failures} gating test(s) FAILED.`);
  process.exit(1);
}
console.log(`\nAll gating tests passed.\n`);

async function runLiveDryRun() {
  try {
    // Dynamic import so a missing/invalid Firestore setup can never crash the
    // pure tests above — the scheduled module touches firebase-admin at import.
    const { runOnboardingEmails } = await import("../scheduled/onboarding-emails.js");
    console.log(
      "Attempting a live dry run (reads real profiles; sends no email, writes no state)..."
    );
    const summary = await runOnboardingEmails({ dryRun: true });
    console.log("\nDry run summary:", summary);
  } catch (error) {
    console.log(
      "\nSkipped the live Firestore dry run: could not reach Firestore/credentials in this environment " +
        "(expected outside `firebase emulators:start` or without deployed service-account creds). " +
        "The gating tests above already ran and passed — that is this script's pass/fail signal.\n" +
        `Reason: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

runLiveDryRun();
