/**
 * Single source of truth for environment-dependent configuration.
 *
 * ---------------------------------------------------------------------------
 * TWO ORTHOGONAL AXES. Conflating them is what broke local dev before.
 * ---------------------------------------------------------------------------
 *
 * 1. RUNTIME — WHERE this process is executing. Auto-detected, never
 *    configured. Decides exactly one thing: whether we start our own HTTP
 *    listener.
 *      cloud      → deployed Cloud Functions (the platform serves us)
 *      emulator   → firebase emulators:start (the emulator serves us)
 *      standalone → plain node/nodemon on a laptop (WE must listen on 3001)
 *
 * 2. APP_ENV — WHICH backing resources we talk to and how we brand ourselves.
 *    Explicitly configured. Decides Firebase project, email, and URLs.
 *      emulator   → fake local Firebase
 *      dev        → the dev Firebase project
 *      production → the production Firebase project
 *
 * Note there is deliberately NO `local` APP_ENV: "local" is a runtime, not an
 * environment. That conflation is why "dev" was ambiguous — it had to mean
 * both "running on my laptop" and "the deployed dev project".
 *
 * The four real setups fall out of the two axes:
 *
 *   setup           runtime      APP_ENV      listener  email      Firebase
 *   local emulator  emulator     emulator     no        console    emulator
 *   local-dev       standalone   dev          YES       real       dev project
 *   deployed-dev    cloud        dev          no        real       dev project
 *   production      cloud        production   no        real       prod project
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY VALUE IS READ LAZILY (inside a function, never at module scope):
 * `lib/firebase.ts` calls `dotenv.config()` at import time, but import cycles
 * mean some modules finish evaluating *before* that runs. Anything read at
 * module scope freezes to `undefined` outside the Cloud Functions runtime
 * (nodemon, the dry-run scripts). That is exactly how the old `TENANT_IDS`
 * came to serialize the literal string "undefined" into magic links.
 * ---------------------------------------------------------------------------
 */

import dotenv from "dotenv";

dotenv.config();

export type AppEnv = "emulator" | "dev" | "production";
export type Runtime = "cloud" | "emulator" | "standalone";

const APP_ENVS: readonly AppEnv[] = ["emulator", "dev", "production"] as const;

let warnedAboutLegacyFallback = false;

/* -------------------------------------------------------------------------
 * Axis 1: runtime
 * ---------------------------------------------------------------------- */

/**
 * Where this process is executing. Detected from platform-injected variables,
 * never from our own config — you cannot get this wrong in a .env file.
 *
 * `FUNCTIONS_EMULATOR` is set by `firebase emulators:start`.
 * `K_SERVICE` is set by the Cloud Run / Cloud Functions gen-2 runtime.
 */
export function runtime(): Runtime {
  if (process.env.FUNCTIONS_EMULATOR === "true") return "emulator";
  if (process.env.K_SERVICE || process.env.FUNCTION_TARGET) return "cloud";
  return "standalone";
}

/**
 * True only when WE are responsible for serving HTTP — i.e. plain node or
 * nodemon on a developer machine. Both the emulator and the deployed runtime
 * serve the exported function themselves, so starting our own listener there
 * would bind a port for nothing.
 */
export const isStandalone = () => runtime() === "standalone";

/* -------------------------------------------------------------------------
 * Axis 2: APP_ENV
 * ---------------------------------------------------------------------- */

/**
 * Which backing resources we talk to.
 *
 * Prefers an explicit `APP_ENV`, then infers from the runtime for the emulator
 * case (which needs no config at all). Otherwise it THROWS — there is
 * deliberately no default, because guessing wrong is silently destructive in
 * both directions: guessing `emulator` swallows all email, and guessing
 * `production` makes a misconfigured dev project send real mail with
 * production-branded URLs.
 */
export function appEnv(): AppEnv {
  const raw = process.env.APP_ENV?.trim().toLowerCase();

  if (raw && (APP_ENVS as readonly string[]).includes(raw)) {
    return raw as AppEnv;
  }

  // Accept the pre-rename value so an old .env keeps working.
  if (raw === "local") return "emulator";

  if (runtime() === "emulator") return "emulator";

  // TRANSITIONAL: the deploy workflow does not set APP_ENV yet. The Cloud
  // Functions runtime always sets NODE_ENV=production, so honouring it here
  // preserves exactly today's production behaviour. Remove once APP_ENV is set
  // in every deployed environment — it cannot tell dev apart from production,
  // which is the entire point of APP_ENV.
  if (process.env.NODE_ENV === "production") {
    if (!warnedAboutLegacyFallback) {
      warnedAboutLegacyFallback = true;
      console.warn(
        "[env] APP_ENV is not set; falling back to NODE_ENV=production. " +
          "This cannot tell dev apart from production — set APP_ENV explicitly."
      );
    }
    return "production";
  }

  throw new Error(
    `[env] APP_ENV is ${
      raw ? `"${raw}", which is not one of ${APP_ENVS.join(" | ")}` : "not set"
    }. Set it to one of ${APP_ENVS.join(" | ")} in this environment's .env file.`
  );
}

export const isEmulatorEnv = () => appEnv() === "emulator";
export const isDev = () => appEnv() === "dev";
export const isProduction = () => appEnv() === "production";

/**
 * True when Firebase calls hit the emulator suite rather than a real project.
 * Keys off BOTH axes: the emulator runtime always implies fake resources, and
 * APP_ENV=emulator means the same for a standalone process.
 */
export const useEmulators = () =>
  runtime() === "emulator" || appEnv() === "emulator";

/* -------------------------------------------------------------------------
 * Email
 * ---------------------------------------------------------------------- */

/** SMTP connection URL for nodemailer. */
export const emailServer = () => process.env.EMAIL_SERVER;

/**
 * Whether to hand messages to SMTP.
 *
 * Keyed on the PRESENCE OF A MAIL SERVER, not on the environment name. If one
 * is configured we use it — that covers real SMTP in dev/production and a
 * local catcher (Mailpit/MailHog) if one is ever added. If none is configured
 * there is nothing to send with, so we log instead.
 *
 * `assertEnvValid()` separately makes a MISSING mail server a hard startup
 * error in dev and production, so this can never silently swallow mail there.
 */
export const shouldSendEmail = () => Boolean(emailServer());

/** Envelope `From` for outbound mail. */
export const emailFrom = () =>
  process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>";

/* -------------------------------------------------------------------------
 * URLs
 * ---------------------------------------------------------------------- */

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, "");

/**
 * Reads a URL-shaped variable, normalising the ways a value arrives mangled
 * from CI: surrounding quotes (a secret pasted with them), leading/trailing
 * whitespace, and a trailing CR from a Windows clipboard. Every one of those
 * survives `process.env` intact, and every one of them makes firebase-admin
 * reject the magic-link continue URL — its validator treats a space, a
 * newline and a quote alike as illegal URL characters.
 *
 * Returns undefined for an absent OR blank value, so callers fall back to
 * their defaults instead of building a URL on top of "".
 */
function readUrlVar(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const cleaned = raw
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .trim();
  return cleaned ? stripTrailingSlash(cleaned) : undefined;
}

/**
 * Mirrors firebase-admin's own URL check (`utils/validator.isURL`): an
 * http(s) URL containing no illegal characters. We re-implement it rather than
 * import it so a bad value fails ONCE at startup, naming the variable, instead
 * of surfacing on every sign-in as
 *   auth/invalid-continue-uri — "The continue URL must be a valid URL string"
 * which names nothing and sends you reading Firebase docs instead of your
 * deploy config. Returns a human-readable problem, or null when valid.
 */
function urlProblem(value: string): string | null {
  // Same character class firebase-admin rejects on — notably excludes
  // whitespace, quotes and backslashes.
  if (/[^a-z0-9:/?#[\]@!$&'()*+,;=.\-_~%]/i.test(value)) {
    return "contains a character that is illegal in a URL (a stray quote, space or newline from CI?)";
  }
  let protocol: string;
  try {
    protocol = new URL(value).protocol;
  } catch {
    return "is not a parseable URL (missing the https:// scheme?)";
  }
  if (protocol !== "http:" && protocol !== "https:") {
    return `has scheme "${protocol}" — it must be http:// or https://`;
  }
  return null;
}

/**
 * Public origin of the frontend site. Used for email assets (the logo PNG must
 * be fetchable by mail clients, so this is never localhost) and for job and
 * community links inside emails.
 */
export function frontendUrl(): string {
  return readUrlVar("FRONTEND_URL") || "https://community.tailed.ca";
}

/**
 * Base origin the passwordless magic link lands on (`/auth/callback`).
 *
 * Its domain MUST be in the Firebase authorized-domains list or
 * `generateSignInWithEmailLink` fails with `auth/unauthorized-continue-uri`.
 * `localhost` is allowlisted at any port.
 *
 * Runtime-aware default: a standalone process is a developer laptop, so the
 * link should land on the local Vite server. This is what lets local-dev and
 * deployed-dev share APP_ENV=dev without any per-machine URL configuration.
 */
export function authContinueUrl(): string {
  const configured = readUrlVar("AUTH_CONTINUE_URL");
  if (configured) return configured;
  if (isStandalone()) return "http://localhost:5174";
  return frontendUrl();
}

/**
 * Public origin of THIS API. Used for links that must work without a session
 * (one-click unsubscribe), so it can never point at the frontend.
 *
 * Runtime-aware default, then derived from the project id. Never hardcode a
 * host here: the previous fallback was a literal `tailed-community-dev` Cloud
 * Functions URL, so production digest emails could ship unsubscribe links
 * pointing at the DEV project — links that would not unsubscribe anyone.
 */
export function apiPublicUrl(): string {
  const configured = readUrlVar("API_PUBLIC_URL");
  if (configured) return configured;

  if (isStandalone()) return "http://localhost:3001";

  const projectId =
    process.env.FB_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;

  if (projectId) {
    return `https://us-central1-${projectId}.cloudfunctions.net/app`;
  }

  throw new Error(
    "[env] API_PUBLIC_URL is required (used for session-less unsubscribe " +
      "links) and could not be derived because FB_PROJECT_ID is also unset."
  );
}

/* -------------------------------------------------------------------------
 * Startup validation
 * ---------------------------------------------------------------------- */

/**
 * Fail fast at startup rather than at first use, so a misconfigured deploy
 * surfaces in the logs instead of as a mysterious 500 on the first sign-in.
 */
export function assertEnvValid(): void {
  const env = appEnv();
  const rt = runtime();
  const missing: string[] = [];

  // A real environment with no mail server would silently log every message
  // to stdout — the exact failure this module was built to eliminate.
  if (env !== "emulator" && !emailServer()) {
    missing.push(
      "EMAIL_SERVER (required when APP_ENV is dev or production; " +
        "without it every email would be logged instead of sent)"
    );
  }

  if (env !== "emulator" && rt === "cloud") {
    // Checked through readUrlVar, not raw presence: a secret that CI wrote as
    // `FRONTEND_URL=` or `FRONTEND_URL=" "` is missing, not configured.
    if (!readUrlVar("FRONTEND_URL")) missing.push("FRONTEND_URL");
    if (!process.env.FB_PROJECT_ID && !readUrlVar("API_PUBLIC_URL")) {
      missing.push("FB_PROJECT_ID (or an explicit API_PUBLIC_URL)");
    }
  }

  if (missing.length) {
    throw new Error(
      `[env] APP_ENV="${env}" runtime="${rt}" but required configuration is ` +
        `missing:\n  - ${missing.join("\n  - ")}`
    );
  }

  // MALFORMED is a separate failure from MISSING, and the one that actually
  // bit us: `FRONTEND_URL=community.tailed.ca` (no scheme) passes every
  // presence check above, then makes generateSignInWithEmailLink reject the
  // continue URL on every single sign-in attempt. Catch it here, once, with
  // the variable named.
  const invalid: string[] = [];
  const checkUrl = (name: string, value: string) => {
    const problem = urlProblem(value);
    if (problem) invalid.push(`${name} resolved to "${value}", which ${problem}`);
  };
  checkUrl("FRONTEND_URL", frontendUrl());
  checkUrl("AUTH_CONTINUE_URL", authContinueUrl());
  if (env !== "emulator") checkUrl("API_PUBLIC_URL", apiPublicUrl());

  if (invalid.length) {
    throw new Error(
      `[env] APP_ENV="${env}" runtime="${rt}" but configured URLs are not ` +
        `usable:\n  - ${invalid.join("\n  - ")}\n` +
        `Each must be a full origin including the scheme, e.g. ` +
        `https://community.tailed.ca`
    );
  }

  console.log(
    `[env] APP_ENV=${env} runtime=${rt} emulators=${useEmulators()} ` +
      `email=${shouldSendEmail() ? "smtp" : "console"} ` +
      `authContinue=${authContinueUrl()}`
  );
}
