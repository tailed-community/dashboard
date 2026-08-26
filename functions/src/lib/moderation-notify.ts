/**
 * Ops alert for the platform-admin moderation queue.
 *
 * Communities always land in the queue on creation; events only do when they
 * have no hosting community (community-hosted events are auto-approved). This
 * module resolves who submitted the item and hands it to the email service.
 */

import { auth } from "./firebase";
import {
  sendModerationQueueEmail,
  type ModerationQueueSubmission,
} from "./email-service";

type NotifyInput = Omit<
  ModerationQueueSubmission,
  "submittedByName" | "submittedByEmail" | "submittedByUid"
> & { userId: string };

/**
 * Fire-and-forget: never awaited by the caller and never rethrows, so a mail
 * outage cannot turn a successful submission into a 500.
 */
export function notifyModerationQueue({ userId, ...submission }: NotifyInput): void {
  void (async () => {
    let submittedByName: string | null = null;
    let submittedByEmail: string | null = null;

    try {
      const user = await auth.getUser(userId);
      submittedByName = user.displayName || null;
      submittedByEmail = user.email || null;
    } catch (error) {
      console.warn(
        `[moderation-notify] could not resolve submitter ${userId}:`,
        error
      );
    }

    await sendModerationQueueEmail({
      ...submission,
      submittedByName,
      submittedByEmail,
      submittedByUid: userId,
    });
  })().catch((error) => {
    console.error("[moderation-notify] failed to send queue alert:", error);
  });
}
