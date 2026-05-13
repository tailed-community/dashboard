import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, CheckCircle, XCircle, Trash2, Edit2, Save, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { Team, TeamJoinRequest, EventData } from "@/types/events";
import { apiFetch } from "@/lib/fetch";

interface RegistrationInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface TeamManagementPageState {
  event: EventData | null;
  team: Team | null;
  requests: TeamJoinRequest[];
  memberRegistrations: Record<string, RegistrationInfo>;
  isLoading: boolean;
  isCaptain: boolean;
  editingName: boolean;
  newTeamName: string;
  actionInProgress: Record<string, boolean>;
}

export default function TeamManagementPage() {
  const { id: eventId, teamId } = useParams<{ id: string; teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState<TeamManagementPageState>({
    event: null,
    team: null,
    requests: [],
    memberRegistrations: {},
    isLoading: true,
    isCaptain: false,
    editingName: false,
    newTeamName: "",
    actionInProgress: {},
  });

  const fetchTeamData = useCallback(async () => {
    if (!eventId || !teamId) return;

    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      // Fetch event
      const eventResp = await apiFetch(`/events/${eventId}`);
      if (!eventResp.ok) throw new Error("Failed to load event");
      const eventBody = await eventResp.json();
      const event = eventBody.event as EventData;

      // Fetch team
      const teamResp = await apiFetch(`/events/${eventId}/teams/${teamId}`);
      if (!teamResp.ok) throw new Error("Failed to load team");
      const teamBody = await teamResp.json();
      const team = teamBody.data as Team;

      const isCaptain = user && (team.captainId === user.uid || team.createdBy === user.uid || event.createdBy === user.uid);

      // Fetch event attendees to get registration data for team members
      const memberRegistrations: Record<string, RegistrationInfo> = {};
      try {
        const attendeesResp = await apiFetch(`/events/${eventId}/attendees?limit=500`);
        if (attendeesResp.ok) {
          const attendeesBody = await attendeesResp.json();
          const attendees = attendeesBody.data || [];
          
          // Build map of userId -> registration info for team members
          for (const attendee of attendees) {
            if (team.members && team.members.includes(attendee.userId)) {
              memberRegistrations[attendee.userId] = {
                firstName: attendee.firstName,
                lastName: attendee.lastName,
                email: attendee.email,
              };
            }
          }
        }
      } catch (err) {
        console.error("Failed to load attendees:", err);
      }

      // Fetch requests if captain
      let requests: TeamJoinRequest[] = [];
      if (isCaptain) {
        try {
          const requestsResp = await apiFetch(`/events/${eventId}/teams/${teamId}/requests?status=pending`);
          if (requestsResp.ok) {
            const requestsBody = await requestsResp.json();
            requests = requestsBody.data || [];
          }
        } catch (err) {
          console.error("Failed to load requests:", err);
        }
      }

      setState((prev) => ({
        ...prev,
        event,
        team,
        requests,
        memberRegistrations,
        isCaptain: Boolean(isCaptain),
        newTeamName: team.name,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Error loading team data:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load team data");
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [eventId, teamId, user]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // Helper function to get display name for a team member from their registration
  const getMemberDisplayName = (memberId: string): string => {
    const registration = state.memberRegistrations[memberId];
    if (!registration) return memberId;

    // Prefer firstName + lastName
    if (registration.firstName && registration.lastName) {
      return `${registration.firstName} ${registration.lastName}`;
    }
    if (registration.firstName) {
      return registration.firstName;
    }

    // Fall back to email
    if (registration.email) {
      return registration.email;
    }

    // Last resort: userId
    return memberId;
  };

  // Helper function to get email for a team member
  const getMemberEmail = (memberId: string): string | null => {
    const registration = state.memberRegistrations[memberId];
    return registration?.email || null;
  };

  const handleSaveTeamName = async () => {
    if (!eventId || !teamId) return;

    const trimmedName = state.newTeamName.trim();
    if (!trimmedName) {
      toast.error("Team name cannot be empty");
      return;
    }

    if (trimmedName === state.team?.name) {
      setState((prev) => ({ ...prev, editingName: false }));
      return;
    }

    setState((prev) => ({ ...prev, actionInProgress: { ...prev.actionInProgress, "edit-name": true } }));
    try {
      const response = await apiFetch(`/events/${eventId}/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update team name");
      }

      setState((prev) => ({
        ...prev,
        team: prev.team ? { ...prev.team, name: trimmedName } : null,
        editingName: false,
      }));
      toast.success("Team name updated");
    } catch (error) {
      console.error("Error updating team name:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update team name");
    } finally {
      setState((prev) => ({ ...prev, actionInProgress: { ...prev.actionInProgress, "edit-name": false } }));
    }
  };

  const handleKickMember = async (memberId: string) => {
    if (!eventId || !teamId) return;

    const member = state.team?.members.find((m) => m === memberId);
    if (!member) return;

    const confirmed = window.confirm(`Are you sure you want to remove this member from the team?`);
    if (!confirmed) return;

    setState((prev) => ({
      ...prev,
      actionInProgress: { ...prev.actionInProgress, [`kick-${memberId}`]: true },
    }));
    try {
      const response = await apiFetch(`/events/${eventId}/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove member");
      }

      setState((prev) => ({
        ...prev,
        team: prev.team
          ? { ...prev.team, members: prev.team.members.filter((m) => m !== memberId) }
          : null,
      }));
      toast.success("Member removed from team");
    } catch (error) {
      console.error("Error kicking member:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove member");
    } finally {
      setState((prev) => ({
        ...prev,
        actionInProgress: { ...prev.actionInProgress, [`kick-${memberId}`]: false },
      }));
    }
  };

  const handleReviewRequest = async (requestId: string, decision: "approve" | "reject") => {
    if (!eventId || !teamId) return;

    setState((prev) => ({
      ...prev,
      actionInProgress: { ...prev.actionInProgress, [`review-${requestId}`]: true },
    }));
    try {
      const response = await apiFetch(`/events/${eventId}/teams/${teamId}/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNotes: null }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${decision} request`);
      }

      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((req) =>
          req.id === requestId ? { ...req, status: decision === "approve" ? "approved" : "rejected" } : req
        ),
      }));
      toast.success(decision === "approve" ? "Request approved" : "Request rejected");

      if (decision === "approve") {
        await fetchTeamData();
      }
    } catch (error) {
      console.error("Error reviewing request:", error);
      toast.error(error instanceof Error ? error.message : `Failed to ${decision} request`);
    } finally {
      setState((prev) => ({
        ...prev,
        actionInProgress: { ...prev.actionInProgress, [`review-${requestId}`]: false },
      }));
    }
  };

  if (!eventId || !teamId) {
    navigate("/events");
    return null;
  }

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading team details…</p>
        </div>
      </div>
    );
  }

  if (!state.team || !state.event) {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/events/${eventId}`)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="text-center">
          <p className="text-destructive">Team not found</p>
          <Button onClick={() => navigate(`/events/${eventId}`)} className="mt-4">
            Return to Event
          </Button>
        </div>
      </div>
    );
  }

  const pendingRequests = state.requests.filter((r) => r.status === "pending");
  const approvedRequests = state.requests.filter((r) => r.status === "approved");
  const rejectedRequests = state.requests.filter((r) => r.status === "rejected");

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/events/${eventId}/manage`)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Manage
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Team Management</h1>
        </div>
        <p className="text-muted-foreground">
          Manage your team, approve join requests, and control team membership.
        </p>
      </div>

      {/* Team Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Team Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Team Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Team Name</label>
            {state.editingName ? (
              <div className="flex gap-2">
                <Input
                  value={state.newTeamName}
                  onChange={(e) => setState((prev) => ({ ...prev, newTeamName: e.target.value }))}
                  placeholder="Enter team name"
                  disabled={state.actionInProgress["edit-name"]}
                />
                <Button
                  size="sm"
                  onClick={handleSaveTeamName}
                  disabled={state.actionInProgress["edit-name"]}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setState((prev) => ({ ...prev, editingName: false, newTeamName: prev.team?.name || "" }));
                  }}
                  disabled={state.actionInProgress["edit-name"]}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2 rounded border">
                <span className="font-medium">{state.team.name}</span>
                {state.isCaptain && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setState((prev) => ({ ...prev, editingName: true }))}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Team Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Members</p>
              <p className="text-2xl font-bold">{state.team.members.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Max Size</p>
              <p className="text-2xl font-bold">{state.team.maxSize}</p>
            </div>
          </div>

          {/* Captain */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Captain</p>
            <Badge variant="secondary">
              {getMemberDisplayName(state.team.captainId || state.team.createdBy || "")}
            </Badge>
          </div>

          {!state.isCaptain && (
            <div className="rounded bg-muted p-3 text-sm">
              <p>You are viewing this team as a member. Only captains and event organizers can manage this team.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members Section */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({state.team.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {state.team.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <div className="space-y-2">
              {state.team.members.map((memberId) => {
                const displayName = getMemberDisplayName(memberId);
                const email = getMemberEmail(memberId);
                return (
                <div
                  key={memberId}
                  className="flex items-center justify-between p-3 rounded border"
                >
                  <div>
                    <p className="font-medium text-sm">{displayName}</p>
                    {email && displayName !== email && (
                      <p className="text-xs text-muted-foreground">{email}</p>
                    )}
                    {(memberId === state.team?.captainId || memberId === state.team?.createdBy) && (
                      <Badge variant="outline" className="mt-1">
                        Captain
                      </Badge>
                    )}
                  </div>
                  {state.isCaptain &&
                    memberId !== state.team?.captainId &&
                    memberId !== state.team?.createdBy && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleKickMember(memberId)}
                        disabled={state.actionInProgress[`kick-${memberId}`]}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                </div>
              );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Requests Section */}
      {state.isCaptain && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                Pending Join Requests ({pendingRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending requests.</p>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 rounded border"
                    >
                      <div>
                        <p className="font-medium text-sm">{request.displayName}</p>
                        {request.email && (
                          <p className="text-xs text-muted-foreground">{request.email}</p>
                        )}
                        {request.requestedAt && (
                          <p className="text-xs text-muted-foreground">
                            Requested {new Date(request.requestedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleReviewRequest(request.id, "approve")}
                          disabled={state.actionInProgress[`review-${request.id}`]}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReviewRequest(request.id, "reject")}
                          disabled={state.actionInProgress[`review-${request.id}`]}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approved Requests */}
          {approvedRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Approved Requests ({approvedRequests.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {approvedRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 rounded border bg-green-50">
                      <div>
                        <p className="font-medium text-sm">{request.displayName}</p>
                        {request.email && (
                          <p className="text-xs text-muted-foreground">{request.email}</p>
                        )}
                        <Badge variant="outline" className="mt-1">
                          Approved
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rejected Requests */}
          {rejectedRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rejected Requests ({rejectedRequests.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rejectedRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 rounded border bg-red-50">
                      <div>
                        <p className="font-medium text-sm">{request.displayName}</p>
                        {request.email && (
                          <p className="text-xs text-muted-foreground">{request.email}</p>
                        )}
                        <Badge variant="outline" className="mt-1">
                          Rejected
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
