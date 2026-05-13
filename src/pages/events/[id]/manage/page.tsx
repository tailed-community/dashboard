import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Settings } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AttendeeFilters } from "@/components/events/AttendeeFilters";
import { AttendeeTable } from "@/components/events/AttendeeTable";
import { AttendeeDetailsDrawer } from "@/components/events/AttendeeDetailsDrawer";
import type { Registration, AttendeeListResponse, SortByField } from "@/types/registration";
import type { Team } from "@/types/events";

export default function EventManageAttendeesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const limit = 50;
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamCount, setTeamCount] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortByField>("registeredAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Drawer state
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
      const result = await response.json() as AttendeeListResponse & { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Failed to load attendees");
      }

      setRegistrations(result.data || []);
      setTotal(result.meta?.total || 0);

      try {
        const teamsResp = await apiFetch(`/events/${id}/teams`);
        if (teamsResp.ok) {
          const teamsBody = await teamsResp.json();
          const teamsList = Array.isArray(teamsBody.data) ? teamsBody.data : [];
          setTeams(teamsList);
          setTeamCount(teamsList.length);
        }
      } catch (teamError) {
        console.error("Error fetching teams:", teamError);
      }
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
          View, search, and manage event registrations. Team names are searchable and attendees are grouped by team.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <Badge variant="secondary">{total} registrations</Badge>
        <Badge variant="secondary">{teamCount} teams</Badge>
        <Badge variant="secondary">Search includes team names</Badge>
      </div>

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
        groupByTeam
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
