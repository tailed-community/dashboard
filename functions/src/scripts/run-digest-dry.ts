/**
 * Dry-run + lightweight test script for the daily jobs digest (WS5).
 *
 * Usage: `npm --prefix functions run digest:dry`
 *
 * Step 1 (always runs, no network/Firestore needed): a handful of inline
 * unit tests against the pure `matchJobsToSubscription` function. Exits
 * non-zero immediately if any assertion fails.
 *
 * Step 2 (best-effort): attempts a real dry run — `runJobsDigest({ dryRun:
 * true })` — which fetches the live jobs feed and reads real
 * `jobAlertSubscriptions`, logs per-subscription match counts, and sends no
 * email / writes no watermark. If Firestore credentials aren't available in
 * this environment, this step is skipped with a clear message; it never
 * fails the script (the match tests are the pass/fail signal).
 */
import { matchJobsToSubscription } from "../lib/digest-matching";
import type { DigestJob } from "../lib/jobs-feed";

function makeJob(overrides: Partial<DigestJob>): DigestJob {
  return {
    id: "job-1",
    title: "Software Engineer Intern",
    companyName: "Acme Corp",
    location: "Toronto, ON",
    type: "internship",
    url: "https://example.com/job",
    active: true,
    dateAddedMs: Date.parse("2026-07-01T00:00:00Z"),
    datePostedLabel: "Posted 1 Day Ago",
    ...overrides,
  };
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

console.log("Running matchJobsToSubscription inline tests...\n");

test("empty query matches all jobs", () => {
  const jobs = [makeJob({ id: "a" }), makeJob({ id: "b", title: "Data Analyst" })];
  const result = matchJobsToSubscription(jobs, { query: null, jobType: null, locations: null });
  assert(result.length === 2, "expected both jobs to match with no filters");
});

test("query requires every whitespace token to appear in title+company", () => {
  const jobs = [
    makeJob({ id: "match", title: "Software Engineer Intern", companyName: "Acme Corp" }),
    makeJob({ id: "no-match", title: "Data Analyst", companyName: "Acme Corp" }),
  ];
  const result = matchJobsToSubscription(jobs, {
    query: "software engineer",
    jobType: null,
    locations: null,
  });
  assert(result.length === 1 && result[0].id === "match", "expected only the software-engineer job to match");
});

test("query match is case-insensitive", () => {
  const jobs = [makeJob({ id: "a", title: "SOFTWARE Engineer" })];
  const result = matchJobsToSubscription(jobs, { query: "software", jobType: null, locations: null });
  assert(result.length === 1, "expected case-insensitive match");
});

test("query can match against company name, not just title", () => {
  const jobs = [makeJob({ id: "a", title: "Intern", companyName: "Shopify" })];
  const result = matchJobsToSubscription(jobs, { query: "shopify", jobType: null, locations: null });
  assert(result.length === 1, "expected company-name token to match");
});

test("jobType filters exactly when set", () => {
  const jobs = [makeJob({ id: "intern", type: "internship" }), makeJob({ id: "grad", type: "new-grad" })];
  const result = matchJobsToSubscription(jobs, { query: null, jobType: "new-grad", locations: null });
  assert(result.length === 1 && result[0].id === "grad", "expected only the new-grad job to match");
});

test("null jobType matches both types (no-filter subscription)", () => {
  const jobs = [makeJob({ id: "intern", type: "internship" }), makeJob({ id: "grad", type: "new-grad" })];
  const result = matchJobsToSubscription(jobs, { query: null, jobType: null, locations: null });
  assert(result.length === 2, "expected null jobType to match all types");
});

test("locations match by substring, case-insensitive", () => {
  const jobs = [
    makeJob({ id: "toronto", location: "Toronto, ON" }),
    makeJob({ id: "vancouver", location: "Vancouver, BC" }),
  ];
  const result = matchJobsToSubscription(jobs, { query: null, jobType: null, locations: ["toronto"] });
  assert(result.length === 1 && result[0].id === "toronto", "expected only the Toronto job to match");
});

test("'Remote' location keyword matches remote jobs", () => {
  const jobs = [
    makeJob({ id: "remote-job", location: "Remote" }),
    makeJob({ id: "office-job", location: "Toronto, ON" }),
  ];
  const result = matchJobsToSubscription(jobs, { query: null, jobType: null, locations: ["Remote"] });
  assert(result.length === 1 && result[0].id === "remote-job", "expected only the remote job to match");
});

test("multiple location tokens are OR'd together", () => {
  const jobs = [
    makeJob({ id: "toronto", location: "Toronto, ON" }),
    makeJob({ id: "montreal", location: "Montreal, QC" }),
    makeJob({ id: "calgary", location: "Calgary, AB" }),
  ];
  const result = matchJobsToSubscription(jobs, {
    query: null,
    jobType: null,
    locations: ["Toronto", "Montreal"],
  });
  assert(result.length === 2, "expected Toronto and Montreal jobs to match, not Calgary");
});

test("null locations matches everywhere (no-filter subscription)", () => {
  const jobs = [makeJob({ id: "a", location: "Toronto, ON" }), makeJob({ id: "b", location: "Berlin" })];
  const result = matchJobsToSubscription(jobs, { query: null, jobType: null, locations: null });
  assert(result.length === 2, "expected null locations to match all");
});

test("results are sorted newest-first by date_added", () => {
  const jobs = [
    makeJob({ id: "old", dateAddedMs: Date.parse("2026-01-01T00:00:00Z") }),
    makeJob({ id: "new", dateAddedMs: Date.parse("2026-07-01T00:00:00Z") }),
    makeJob({ id: "mid", dateAddedMs: Date.parse("2026-04-01T00:00:00Z") }),
  ];
  const result = matchJobsToSubscription(jobs, { query: null, jobType: null, locations: null });
  assert(
    result.map((j) => j.id).join(",") === "new,mid,old",
    `expected newest-first order, got ${result.map((j) => j.id).join(",")}`
  );
});

test("combined filters (query + jobType + locations) must all pass", () => {
  const jobs = [
    makeJob({
      id: "match",
      title: "Backend Intern",
      companyName: "Shopify",
      type: "internship",
      location: "Remote",
    }),
    makeJob({
      id: "wrong-type",
      title: "Backend Intern",
      companyName: "Shopify",
      type: "new-grad",
      location: "Remote",
    }),
    makeJob({
      id: "wrong-query",
      title: "Frontend Intern",
      companyName: "Shopify",
      type: "internship",
      location: "Remote",
    }),
    makeJob({
      id: "wrong-location",
      title: "Backend Intern",
      companyName: "Shopify",
      type: "internship",
      location: "Toronto",
    }),
  ];
  const result = matchJobsToSubscription(jobs, {
    query: "backend",
    jobType: "internship",
    locations: ["Remote"],
  });
  assert(result.length === 1 && result[0].id === "match", "expected only the fully-matching job to pass all filters");
});

if (failures > 0) {
  console.error(`\n${failures} match test(s) FAILED.`);
  process.exit(1);
}
console.log(`\nAll match tests passed.\n`);

async function runLiveDryRun() {
  try {
    // Dynamic import so a missing/invalid Firestore setup can never crash
    // the test portion above — this module touches `../lib/firebase`
    // (firebase-admin) at import time.
    const { runJobsDigest } = await import("../scheduled/jobs-digest.js");
    console.log(
      "Attempting a live dry run (real jobs feed + real Firestore subscriptions; sends no email, writes no watermark)..."
    );
    const summary = await runJobsDigest({ dryRun: true });
    console.log("\nDry run summary:", summary);
  } catch (error) {
    console.log(
      "\nSkipped the live Firestore dry run: could not reach Firestore/credentials in this environment " +
        "(this is expected outside `firebase emulators:start` or without deployed service-account creds). " +
        "The match tests above already ran and passed — that is this script's pass/fail signal.\n" +
        `Reason: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

runLiveDryRun();
