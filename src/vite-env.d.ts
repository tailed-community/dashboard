/// <reference types="vite/client" />

/**
 * Typed frontend environment.
 *
 * Without this, every `import.meta.env.VITE_*` read is `any`, so a typo
 * (VITE_FIREBASE_PROJECTID, VITE_TENANT_ID after its removal, ...) silently
 * yields `undefined` at runtime instead of failing the build.
 *
 * Keep in sync with `.env.example`. Everything here is public — these values
 * are compiled into the client bundle and served to every visitor.
 */
interface ImportMetaEnv {
  // --- Firebase ---
  // Must match the backend's FB_PROJECT_ID for the same environment: a magic
  // link minted by one project can only be completed against that project.
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;

  // --- APIs ---
  readonly VITE_API_URL: string;
  readonly VITE_COMPANIES_API_URL: string;

  // --- Emulator ---
  // The string "true" points the Firebase SDK at the local emulator suite.
  // Replaced the old implicit `projectId.startsWith("demo-")` sniff, which
  // silently used PRODUCTION auth whenever the id didn't happen to match.
  readonly VITE_USE_EMULATORS?: string;

  // --- Analytics (optional) ---
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_CLARITY_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
