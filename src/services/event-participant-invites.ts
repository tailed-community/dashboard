import { apiFetch } from "@/lib/fetch";

export type EventInviteRole = "participant" | "mentor" | "judge" | "speaker";

export interface EventParticipantInviteInput {
  eventId: string;
  eventName: string;
  organizerId: string;
  organizerEmail: string;
  participantEmail: string;
  role: EventInviteRole;
}

export interface EventParticipantInviteOutcome {
  importSucceeded: boolean;
  bridgeSucceeded: boolean;
  createdCount: number;
  existingCount: number;
  bridgeRequestId: string | null;
  communityAccountStatus: "created" | "existing" | null;
  importError: string | null;
  bridgeError: string | null;
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function buildPlaceholderNames(email: string): { firstName: string; lastName: string } {
  const local = (email || "").split("@")[0] || "invitee";
  const cleaned = local.replace(/[._-]+/g, " ").replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0] || "Invitee";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "Tailed";
  const firstName = first.charAt(0).toUpperCase() + first.slice(1);
  const lastName = last.charAt(0).toUpperCase() + last.slice(1);
  return { firstName: firstName || "Invitee", lastName: lastName || "Tailed" };
}

export async function inviteEventParticipant(
  input: EventParticipantInviteInput
): Promise<EventParticipantInviteOutcome> {
  let importSucceeded = false;
  let bridgeSucceeded = false;
  let createdCount = 0;
  let existingCount = 0;
  let bridgeRequestId: string | null = null;
  let importError: string | null = null;
  let bridgeError: string | null = null;

  try {
    const placeholder = buildPlaceholderNames(input.participantEmail);

    const response = await apiFetch(`/events/${input.eventId}/import-attendees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attendees: [
          {
            email: input.participantEmail,
            firstName: placeholder.firstName,
            lastName: placeholder.lastName,
            role: input.role,
          },
        ],
        role: input.role,
        sendNotifications: false,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(
        errBody?.error || errBody?.message || response.statusText || "Failed to import attendee"
      );
    }

    const body = await response.json().catch(() => ({}));
    const results = body?.results || {};

    createdCount = Array.isArray(results.created) ? results.created.length : 0;
    existingCount = Array.isArray(results.existing) ? results.existing.length : 0;

    const registeredCount = Array.isArray(results.registered) ? results.registered.length : 0;
    const addedCount = Array.isArray(results.added) ? results.added.length : 0;

    if (createdCount === 0 && existingCount === 0) {
      existingCount = Math.max(registeredCount, addedCount);
    }

    importSucceeded = true;
  } catch (error) {
    importError = toErrorMessage(error, "Failed to import attendee");
    console.error("Error importing attendee:", error);
  }

  const communityAccountStatus = createdCount > 0 ? "created" : existingCount > 0 ? "existing" : null;

  try {
    const bridgeResponse = await apiFetch(
      "/v1/bridge/participation-requests",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId: input.organizerId,
          organizerEmail: input.organizerEmail,
          eventId: input.eventId,
          eventName: input.eventName,
          participantEmail: input.participantEmail,
          role: input.role,
          communityAccountStatus: communityAccountStatus ?? undefined,
          metadata: {
            source: "event_dashboard_invite",
            requestedAt: new Date().toISOString(),
            additionalContext: {
              eventTitle: input.eventName,
              invitedFrom: "event_manage_page",
            },
          },
        }),
      },
      true
    );

    if (!bridgeResponse.ok) {
      const errBody = await bridgeResponse.json().catch(() => ({}));
      throw new Error(errBody?.error || errBody?.message || bridgeResponse.statusText || "Failed to send bridge request");
    }

    const bridgeBody = await bridgeResponse.json().catch(() => ({}));
    bridgeRequestId = typeof bridgeBody?.requestId === "string" ? bridgeBody.requestId : null;
    bridgeSucceeded = true;
  } catch (error) {
    bridgeError = toErrorMessage(error, "Failed to send bridge request");
    console.error("Error sending bridge request:", error);
  }

  return {
    importSucceeded,
    bridgeSucceeded,
    createdCount,
    existingCount,
    bridgeRequestId,
    communityAccountStatus,
    importError,
    bridgeError,
  };
}

export default inviteEventParticipant;
