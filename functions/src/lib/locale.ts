import { db } from "./firebase";

/**
 * Communication locale for student-facing emails (spec 08 §5.1). The single
 * source of truth is `profiles/{uid}.preferredLanguage`; public endpoints that
 * have no profile yet fall back to the browser's `Accept-Language`. Everything
 * defaults to `"en"`.
 */
export type Locale = "en" | "fr";

/** Coerces any stored value into a valid Locale, defaulting to "en". */
export function normalizeLocale(value: unknown): Locale {
  return value === "fr" ? "fr" : "en";
}

/**
 * Resolves a Locale from an HTTP `Accept-Language` header. Only the primary
 * (first, highest-priority) language tag is considered: a tag that starts with
 * `"fr"` → `"fr"`, everything else → `"en"`.
 */
export function localeFromAcceptLanguage(
  header: string | string[] | undefined | null
): Locale {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return "en";
  const primary = raw.split(",")[0]?.trim().toLowerCase() ?? "";
  return primary.startsWith("fr") ? "fr" : "en";
}

/**
 * Reads `profiles/{uid}.preferredLanguage` and returns it as a Locale. Any
 * missing profile / unset field / read error resolves to `"en"` so a language
 * lookup can never block or fail an email send.
 */
export async function getPreferredLocaleForUid(
  uid: string | null | undefined
): Promise<Locale> {
  if (!uid) return "en";
  try {
    const snap = await db.collection("profiles").doc(uid).get();
    return normalizeLocale(snap.data()?.preferredLanguage);
  } catch (error) {
    console.warn("locale: failed to read preferredLanguage for", uid, error);
    return "en";
  }
}
