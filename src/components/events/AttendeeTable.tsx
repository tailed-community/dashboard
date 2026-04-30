import { CheckCircle, XCircle, Clock, MoreHorizontal } from "lucide-react";
import type { Registration } from "@/types/registration";
import { DateTime } from "luxon";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AttendeeTableProps {
  registrations: Registration[];
  loading?: boolean;
  onRowClick: (registration: Registration) => void;
  currentPage: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

const statusConfig = {
  pending: { icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  confirmed: { icon: CheckCircle, color: "bg-green-100 text-green-800" },
  rejected: { icon: XCircle, color: "bg-red-100 text-red-800" },
  attended: { icon: CheckCircle, color: "bg-blue-100 text-blue-800" },
  "no-show": { icon: XCircle, color: "bg-red-100 text-red-800" },
  waitlisted: { icon: Clock, color: "bg-amber-100 text-amber-800" },
};

export function AttendeeTable({
  registrations,
  loading = false,
  onRowClick,
  currentPage,
  limit,
  total,
  onPageChange,
}: AttendeeTableProps) {
  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading attendees...</div>
      </div>
    );
  }

  if (registrations.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">No attendees found</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations.map((reg) => {
              const config = statusConfig[reg.status as keyof typeof statusConfig] || statusConfig.pending;
              const StatusIcon = config.icon;

              return (
                <TableRow
                  key={reg.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onRowClick(reg)}
                >
                  <TableCell className="font-medium">
                    {reg.firstName} {reg.lastName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {reg.email}
                  </TableCell>
                  <TableCell className="capitalize text-sm">
                    {reg.role}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${config.color} gap-1 capitalize`}>
                      <StatusIcon className="h-3 w-3" />
                      {reg.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {DateTime.fromISO(String(reg.registeredAt)).toFormat("MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onRowClick(reg);
                        }}>
                          View Details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages} • {total} total attendees
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
