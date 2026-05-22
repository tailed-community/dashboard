import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Settings, Users } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AttendeeFilters } from "@/components/events/AttendeeFilters";
import { AttendeeTable } from "@/components/events/AttendeeTable";
import { AttendeeDetailsDrawer } from "@/components/events/AttendeeDetailsDrawer";
import { useAuth } from "@/hooks/use-auth";
import { inviteEventParticipant, type EventInviteRole } from "@/services/event-participant-invites";
import type { EventData, Team } from "@/types/events";
import type { Registration, AttendeeListResponse, SortByField } from "@/types/registration";

export default function EventManageAttendeesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const limit = 50;
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [event, setEvent] = useState<EventData | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<EventInviteRole>("participant");
  const [inviting, setInviting] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortByField>("registeredAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Drawer state
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchEvent = useCallback(async () => {
    if (!id) return;

    try {
      const response = await apiFetch(`/events/${id}`);
      const result = await response.json() as { event?: EventData; error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Failed to load event");
      }

      setEvent(result.event || null);
    } catch (error) {
      console.error("Error fetching event:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load event");
    }
  }, [id]);

  // Fetch attendees on page/filter change
  const fetchAttendees = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (searchQuery) params.set("q", searchQuery);
      if (statusFilter) params.set("status", statusFilter);
      params.set("sortBy", sortBy);
      params.set("order", order);

      const response = await apiFetch(`/events/${id}/attendees?${params.toString()}`);
      const result: AttendeeListResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load attendees");
      }

      setRegistrations(result.data || []);
      setTotal(result.meta?.total || 0);
    } catch (error) {
      console.error("Error fetching attendees:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load attendees");
    } finally {
      setLoading(false);
    }
  }, [id, page, limit, searchQuery, statusFilter, sortBy, order]);

  // Fetch attendees when filters/pagination changes
  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleRegistrationUpdated = (updated: Registration) => {
    // Update the registration in the list
    setRegistrations((prev) =>
      prev.map((reg) => (reg.id === updated.id ? updated : reg))
    );
    setSelectedRegistration(updated);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setPage(1); // Reset to page 1 on new search
  };

  const handleStatusChange = (status: string | null) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleSortByChange = (newSort: string) => {
    setSortBy(newSort as SortByField);
    setPage(1);
  };

  const handleOrderChange = (newOrder: "asc" | "desc") => {
    setOrder(newOrder);
    setPage(1);
  };

  const handleInviteSubmit = async (submissionEvent: FormEvent<HTMLFormElement>) => {
    submissionEvent.preventDefault();

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Enter an email address");
      return;
    }

    if (!user?.uid || !user.email) {
      toast.error("You need to be signed in to invite participants");
      return;
    }

    if (!id || !event?.title) {
      toast.error("Event details are still loading");
      return;
    }

    setInviting(true);
    try {
      const outcome = await inviteEventParticipant({
        eventId: id,
        eventName: event.title,
        organizerId: user.uid,
        organizerEmail: user.email,
        participantEmail: email,
        role: inviteRole,
      });

      if (outcome.importSucceeded) {
        await fetchAttendees();
        setInviteEmail("");
      }

      const roleLabel = inviteRole.charAt(0).toUpperCase() + inviteRole.slice(1);

      if (outcome.importSucceeded && outcome.bridgeSucceeded) {
        toast.success(
          outcome.communityAccountStatus === "created"
            ? `${roleLabel} invite sent and a placeholder account was created.`
            : `${roleLabel} invite sent to the existing account.`
        );
        return;
      }

      if (outcome.importSucceeded && !outcome.bridgeSucceeded) {
        toast.error(
          `The attendee was added to the event, but the participation bridge failed: ${outcome.bridgeError || "unknown error"}`
        );
        return;
      }

      if (!outcome.importSucceeded && outcome.bridgeSucceeded) {
        toast.error(
          `The participation request was queued, but the event import failed: ${outcome.importError || "unknown error"}`
        );
        return;
      }

      throw new Error(outcome.importError || outcome.bridgeError || "Failed to invite participant");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to invite participant");
    } finally {
      setInviting(false);
    }
  };

  if (!id) {
    navigate("/events");
    return null;
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/events/${id}`)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Event
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Manage Attendees</h1>
        </div>
        <p className="text-muted-foreground">
          View, search, and manage event registrations
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <Badge variant="secondary">{total} registrations</Badge>
        <Badge variant="secondary">{teamCount} teams</Badge>
        <Badge variant="secondary">Search includes team names</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite Participant</CardTitle>
          <CardDescription>
            Add someone by email, pick a role, and the dashboard will create a placeholder account if needed before sending the bridge request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInviteSubmit} className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="person@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as EventInviteRole)}>
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="participant">Participant</SelectItem>
                  <SelectItem value="speaker">Speaker</SelectItem>
                  <SelectItem value="judge">Judge</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviting || !event} className="gap-2">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {inviting ? "Inviting..." : "Invite to Event"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            This also sends the participation-request bridge to {event ? event.title : "the event"} with the selected role.
          </p>
        </CardContent>
      </Card>

      {/* Teams Section */}
      {teams.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Teams</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="rounded border p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/events/${id}/teams/${team.id}/manage`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{team.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {team.members.length}/{team.maxSize} members
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/events/${id}/teams/${team.id}/manage`);
                    }}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    Captain: {team.captainId?.substring(0, 8)}...
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <AttendeeFilters
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusChange}
        onSortByChange={handleSortByChange}
        onOrderChange={handleOrderChange}
        currentSearch={searchQuery}
        currentStatus={statusFilter}
        currentSortBy={sortBy}
        currentOrder={order}
      />

      {/* Table */}
      <AttendeeTable
        registrations={registrations}
        loading={loading}
        onRowClick={(reg) => {
          setSelectedRegistration(reg);
          setIsDrawerOpen(true);
        }}
        currentPage={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
      />

      {/* Details Drawer */}
      <AttendeeDetailsDrawer
        registration={selectedRegistration}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        eventId={id}
        onRegistrationUpdated={handleRegistrationUpdated}
      />
    </div>
  );
}
