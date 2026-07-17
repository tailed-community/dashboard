import { useCallback, useEffect, useState } from "react";

/**
 * Client-only "saved jobs" store (WS4). Saving works instantly with no
 * account — ids live in localStorage. Never synced to Firestore (out of
 * scope for v1; see docs/specs/04-email-capture.md).
 */
const STORAGE_KEY = "savedJobIds";
const CHANGE_EVENT = "tailed:saved-jobs-changed";

function readSavedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeSavedIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Total number of jobs the visitor has saved (used to gate the save-job prompt). */
export function getSavedJobCount(): number {
  return readSavedIds().length;
}

/**
 * Hook exposing the saved-job id set plus a toggle function. Re-renders any
 * subscriber (across components) when saved ids change anywhere in the app.
 */
export function useSavedJobs() {
  const [savedIds, setSavedIds] = useState<string[]>(() => readSavedIds());

  useEffect(() => {
    const handleChange = () => setSavedIds(readSavedIds());
    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  const isSaved = useCallback((jobId: string) => savedIds.includes(jobId), [savedIds]);

  /** Toggles a job's saved state; returns the new saved-count and whether it's now saved. */
  const toggleSaved = useCallback((jobId: string): { saved: boolean; count: number } => {
    const current = readSavedIds();
    const alreadySaved = current.includes(jobId);
    const next = alreadySaved ? current.filter((id) => id !== jobId) : [...current, jobId];
    writeSavedIds(next);
    setSavedIds(next);
    return { saved: !alreadySaved, count: next.length };
  }, []);

  return { savedIds, isSaved, toggleSaved };
}
