import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  getMyAlerts,
  getAlert,
  type JobAlert,
  type DigestRun,
} from "@/lib/alerts";

export interface MyAlertsState {
  alerts: JobAlert[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Live list of the signed-in user's job alerts (`GET /alerts/mine`).
 * Mirrors the `useLiveJobs` useState + useEffect + `cancelled`-flag pattern
 * (`joy-live-jobs.ts`). Bump the internal `reloadKey` via `refetch` to reload.
 *
 * Gated on auth, and deliberately keyed on `user?.uid` rather than firing once
 * on mount. `/alerts/mine` is authenticated, and `authenticatedFetch` reads
 * `studentAuth.currentUser` at call time — which is still null until Firebase
 * restores the session. Since auth is non-blocking, this hook can mount before
 * that happens, so an unconditional fetch would go out with no Authorization
 * header and 401. Not just console noise: nothing re-ran the request once auth
 * landed, so a signed-in user's alert count sat at 0. Logged-out visitors (the
 * public home mounts this via `useProfileSummary`) now skip the call entirely.
 */
export function useMyAlerts(): MyAlertsState {
  const { user, loading: authLoading } = useAuth();
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    // Auth still resolving — stay in the loading state rather than briefly
    // reporting "no alerts" for a user who has them.
    if (authLoading) return;

    if (!user) {
      setAlerts([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getMyAlerts();
        if (!cancelled) {
          setAlerts(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load alerts:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load alerts");
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, authLoading, reloadKey]);

  return { alerts, loading, error, refetch: () => setReloadKey((k) => k + 1) };
}

export interface AlertDetailState {
  alert: JobAlert | null;
  runs: DigestRun[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * One alert + its batch history (`GET /alerts/:id`). No-ops when `id` is
 * undefined. Same useState + useEffect + `cancelled`-flag pattern as above.
 */
export function useAlert(id: string | undefined): AlertDetailState {
  const [alert, setAlert] = useState<JobAlert | null>(null);
  const [runs, setRuns] = useState<DigestRun[]>([]);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    if (!id) {
      setAlert(null);
      setRuns([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getAlert(id!);
        if (!cancelled) {
          setAlert(data.alert);
          setRuns(data.runs);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load alert:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load alert");
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  return {
    alert,
    runs,
    loading,
    error,
    refetch: () => setReloadKey((k) => k + 1),
  };
}
