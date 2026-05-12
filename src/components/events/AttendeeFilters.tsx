import { useState } from "react";
import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface AttendeeFiltersProps {
  onSearchChange: (q: string) => void;
  onStatusChange: (status: string | null) => void;
  onSortByChange: (sortBy: string) => void;
  onOrderChange: (order: 'asc' | 'desc') => void;
  currentSearch: string;
  currentStatus: string | null;
  currentSortBy: string;
  currentOrder: 'asc' | 'desc';
}

export function AttendeeFilters({
  onSearchChange,
  onStatusChange,
  onSortByChange,
  onOrderChange,
  currentSearch,
  currentStatus,
  currentSortBy,
  currentOrder,
}: AttendeeFiltersProps) {
  const [localSearch, setLocalSearch] = useState(currentSearch);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    // Debounce would be better, but for now immediate update
    onSearchChange(value);
  };

  const clearSearch = () => {
    setLocalSearch("");
    onSearchChange("");
  };

  const hasActiveFilters = currentStatus !== null || currentSearch !== "";

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or answers..."
          value={localSearch}
          onChange={handleSearchChange}
          className="pl-10 pr-10"
        />
        {localSearch && (
          <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Status, Sort, Order filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={currentStatus || "all"} onValueChange={(v) => onStatusChange(v === "all" ? null : v)}>
          <SelectTrigger className="w-auto min-w-[9rem] inline-flex">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="attended">Attended</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="no-show">No Show</SelectItem>
            <SelectItem value="waitlisted">Waitlisted</SelectItem>
          </SelectContent>
        </Select>

        <Select value={currentSortBy} onValueChange={onSortByChange}>
          <SelectTrigger className="w-auto min-w-[8rem] inline-flex">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="registeredAt">Registration Date</SelectItem>
            <SelectItem value="firstName">First Name</SelectItem>
            <SelectItem value="lastName">Last Name</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>

        <Select value={currentOrder} onValueChange={(v) => onOrderChange(v as 'asc' | 'desc')}>
          <SelectTrigger className="w-auto min-w-[6rem] inline-flex">
            <SelectValue placeholder="Order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">Ascending</SelectItem>
            <SelectItem value="desc">Descending</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Badge variant="secondary" className="px-3 py-1">
            Filters applied
          </Badge>
        )}
      </div>
    </div>
  );
}
