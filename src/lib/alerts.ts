import { apiFetch } from "./fetch";

/**
 * A job-alert subscription owned by the signed-in user, as returned by the
 * authenticated `/alerts/*` endpoints (spec 06 §4). Mirrors the
 * `jobAlertSubscriptions` doc shape (§3.1).
 *
 * NOTE: the backend serializes Firestore `Timestamp`s to ISO strings before
 * sending them over the wire, so every timestamp field here is typed `string`.
 */
export interface JobAlert {
  id: string;
  query: string | null;
  jobType: "internship" | "new-grad" | null;
  locations: string[] | null;
  frequency: "daily" | "weekly";
  active: boolean;
  source: string;
  createdAt: string;
  lastSentAt: string | null;
  /** Summary of the newest `digestRuns` doc, or null if none has sent yet. */
  lastBatch: { sentAt: string; jobCount: number } | null;
}

/**
 * One batch the cron emailed for an alert — a `digestRuns` doc (spec 06 §3.2).
 * `sentAt` is an ISO string (serialized Firestore Timestamp); the watermark
 * fields are epoch-millis numbers (or null before the first send).
 */
export interface DigestRun {
  id: string;
  sentAt: string;
  jobIds: string[];
  jobCount: number;
  matchedCount: number;
  watermarkBefore: number | null;
  watermarkAfter: number;
}

/**
 * Editable subset of a `JobAlert`, sent as the body of `PATCH /alerts/:id`.
 * All fields optional — a partial patch (spec 06 §4).
 */
export interface AlertPatch {
  query?: string | null;
  locations?: string[] | null;
  jobType?: "internship" | "new-grad" | null;
  frequency?: "daily" | "weekly";
  active?: boolean;
}

/** List the signed-in user's alerts → `GET /alerts/mine`. */
export async function getMyAlerts(): Promise<JobAlert[]> {
  const response = await apiFetch("/alerts/mine");

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load alerts");
  }

  return await response.json();
}

/** One alert plus its batch history → `GET /alerts/:id`. */
export async function getAlert(
  id: string,
): Promise<{ alert: JobAlert; runs: DigestRun[] }> {
  const response = await apiFetch(`/alerts/${id}`);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load alert");
  }

  return await response.json();
}

/** Edit an alert's criteria / active state → `PATCH /alerts/:id`. */
export async function updateAlert(
  id: string,
  patch: AlertPatch,
): Promise<void> {
  const response = await apiFetch(`/alerts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to update alert");
  }
}

/** Delete an alert and its `digestRuns` → `DELETE /alerts/:id`. */
export async function deleteAlert(id: string): Promise<void> {
  const response = await apiFetch(`/alerts/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to delete alert");
  }
}
