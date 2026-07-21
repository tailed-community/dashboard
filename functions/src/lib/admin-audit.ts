import type { Request } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase";

/**
 * Audit trail for privileged platform-admin writes.
 *
 * Platform admins bypass the ownership checks that guard every other write
 * path (see `isPlatformAdmin` in routes/event.ts and routes/community.ts), so
 * an admin edit leaves no trace in the ownership model the way an owner edit
 * does. This module records who did what, to which document, and what actually
 * changed — the accountability that the bypass removes.
 *
 * Only privileged actions are logged. An admin editing a resource they own
 * anyway goes through the normal owner path and is not recorded here.
 */

export type AdminAuditAction =
  | "update"
  | "archive"
  | "unarchive"
  | "delete"
  | "transfer_ownership";

export type AdminAuditResource = "event" | "community";

/** Field-level before/after for a single changed key. */
export interface AdminAuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AdminAuditEntryInput {
  action: AdminAuditAction;
  resourceType: AdminAuditResource;
  resourceId: string;
  /** Human-readable label so the log stays readable after a delete. */
  resourceName?: string;
  changes?: AdminAuditChange[];
  /** Admin-supplied justification, where the endpoint collects one. */
  reason?: string;
}

/**
 * Values that are large, binary-ish, or noisy enough that storing them in the
 * audit log costs more than it explains. Rich-text descriptions can run to
 * 5000 chars, so they are recorded as a length-change summary instead.
 */
const TRUNCATE_AT = 500;

const summarize = (value: unknown): unknown => {
  if (typeof value === "string" && value.length > TRUNCATE_AT) {
    return `${value.slice(0, TRUNCATE_AT)}… (${value.length} chars total)`;
  }
  return value === undefined ? null : value;
};

/**
 * Shallow diff of the fields an update actually touched.
 *
 * Only keys present in `after` are considered — a PATCH sends a partial body,
 * and absent keys mean "unchanged", not "cleared". Compared with JSON equality
 * so arrays and plain objects (e.g. `admins`) diff by value rather than
 * identity.
 */
export const diffFields = (
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>
): AdminAuditChange[] => {
  const changes: AdminAuditChange[] = [];

  for (const [field, afterValue] of Object.entries(after)) {
    const beforeValue = before?.[field];

    // Firestore sentinels (FieldValue.serverTimestamp() and friends) have no
    // meaningful value until write time; recording them would be noise.
    if (afterValue instanceof FieldValue) continue;

    let equal: boolean;
    try {
      equal = JSON.stringify(beforeValue) === JSON.stringify(afterValue);
    } catch {
      // Circular or otherwise unserializable — assume it changed.
      equal = false;
    }

    if (!equal) {
      changes.push({
        field,
        before: summarize(beforeValue),
        after: summarize(afterValue),
      });
    }
  }

  return changes;
};

/**
 * Append an entry to the `adminAuditLog` collection.
 *
 * Deliberately never throws. A failure to write the audit trail should be
 * loud in the logs but must not roll back or 500 a moderation action the
 * admin already performed — the alternative is a resource left in a
 * half-edited state because the bookkeeping failed.
 */
export const logAdminAction = async (
  req: Request,
  entry: AdminAuditEntryInput
): Promise<void> => {
  try {
    const actorUid = req.user?.uid;
    if (!actorUid) {
      console.error("[admin-audit] refusing to log action with no actor", entry);
      return;
    }

    await db.collection("adminAuditLog").add({
      ...entry,
      changes: entry.changes ?? [],
      actorUid,
      actorEmail: req.user?.email ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("[admin-audit] failed to write audit entry", {
      entry,
      error,
    });
  }
};
