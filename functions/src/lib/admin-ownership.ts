import type { Response } from "express";
import { z } from "zod";
import { auth } from "./firebase";

/**
 * Shared plumbing for platform-admin ownership transfers on events and
 * communities.
 */

export const transferOwnershipSchema = z
  .object({
    uid: z.string().min(1).optional(),
    email: z.string().email().optional(),
    reason: z.string().max(2000).optional(),
  })
  .refine((data) => Boolean(data.uid || data.email), {
    message: "Provide either a uid or an email for the new owner",
  });

export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

export interface ResolvedUser {
  uid: string;
  email?: string;
}

/**
 * Resolve the transfer target to a real Firebase Auth user.
 *
 * Verifying existence matters more here than in most lookups: writing an
 * arbitrary string into `createdBy` would orphan the resource, leaving it
 * editable by nobody but a platform admin. Responds and returns null on
 * failure, following the `ensure*` convention used in the route files.
 */
export const resolveTargetUser = async (
  res: Response,
  input: TransferOwnershipInput
): Promise<ResolvedUser | null> => {
  try {
    const record = input.uid
      ? await auth.getUser(input.uid)
      : await auth.getUserByEmail(input.email as string);

    return { uid: record.uid, email: record.email };
  } catch (error: any) {
    if (
      error?.code === "auth/user-not-found" ||
      error?.code === "auth/invalid-uid" ||
      error?.code === "auth/invalid-email"
    ) {
      res.status(404).json({
        error: "No user found for the provided uid or email",
      });
      return null;
    }
    throw error;
  }
};
