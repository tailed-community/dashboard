import { useEffect, useState } from "react";
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
 */
export function useMyAlerts(): MyAlertsState {
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
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
  }, [reloadKey]);

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
