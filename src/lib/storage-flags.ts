/**
 * Guarded helpers for the small "have we shown/done this already" flags
 * scattered across capture surfaces (job alert subscription, digest prompt,
 * save-job prompt, profile completion banner). `localStorage`/`sessionStorage`
 * access can throw (e.g. Safari private browsing, blocked storage), so every
 * read/write here is wrapped in try/catch and fails soft.
 */

type StorageArea = "local" | "session";

function getStorage(area: StorageArea): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return area === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Reads a boolean flag (stored as the string `"true"`) from the given storage area. */
export function getStorageFlag(area: StorageArea, key: string): boolean {
  try {
    return getStorage(area)?.getItem(key) === "true";
  } catch {
    return false;
  }
}

/** Sets a boolean flag (as the string `"true"`) in the given storage area. No-ops on failure. */
export function setStorageFlag(area: StorageArea, key: string): void {
  try {
    getStorage(area)?.setItem(key, "true");
  } catch {
    // storage unavailable (e.g. private browsing) — ignore.
  }
}

/**
 * Reads a millisecond timestamp previously written by `setStorageTimestamp`.
 * Returns `null` if absent, unparseable, or storage is unavailable.
 */
export function getStorageTimestamp(area: StorageArea, key: string): number | null {
  try {
    const raw = getStorage(area)?.getItem(key);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Writes the current time (ms) to the given storage area/key. No-ops on failure. */
export function setStorageTimestamp(area: StorageArea, key: string): void {
  try {
    getStorage(area)?.setItem(key, String(Date.now()));
  } catch {
    // storage unavailable — ignore.
  }
}
