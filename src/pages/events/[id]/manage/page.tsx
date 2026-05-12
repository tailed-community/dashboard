import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AttendeeFilters } from "@/components/events/AttendeeFilters";
import { AttendeeTable } from "@/components/events/AttendeeTable";
import { AttendeeDetailsDrawer } from "@/components/events/AttendeeDetailsDrawer";
import type { Registration, AttendeeListResponse, SortByField } from "@/types/registration";

export default function EventManageAttendeesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const limit = 50;
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

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
          View, search, and manage event registrations
        </p>
      </div>

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
