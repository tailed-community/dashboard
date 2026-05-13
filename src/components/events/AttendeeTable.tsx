import { CheckCircle, XCircle, Clock, MoreHorizontal, Users2 } from "lucide-react";
import type { Registration } from "@/types/registration";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  groupByTeam?: boolean;
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
  groupByTeam = false,
}: AttendeeTableProps) {
  const totalPages = Math.ceil(total / limit);

  const groupedRegistrations = groupByTeam
    ? Array.from(
        registrations.reduce((groups, registration) => {
          const key = registration.teamName?.trim() || registration.teamId?.trim() || "no-team";
          const current = groups.get(key) || [];
          current.push(registration);
          groups.set(key, current);
          return groups;
        }, new Map<string, Registration[]>()).entries()
      )
        .map(([key, groupRegistrations]) => ({
          key,
          label: key === "no-team" ? "No team" : groupRegistrations[0]?.teamName?.trim() || "Unnamed team",
          registrations: groupRegistrations,
        }))
        .sort((a, b) => {
          if (a.key === "no-team") return 1;
          if (b.key === "no-team") return -1;
          return a.label.localeCompare(b.label);
        })
    : [];

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

  if (groupByTeam) {
    return (
      <div className="space-y-4">
        {groupedRegistrations.map((group) => (
          <Card key={group.key} className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 py-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users2 className="h-5 w-5 text-muted-foreground" />
                  {group.label}
                </CardTitle>
                <Badge variant="secondary">{group.registrations.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {group.registrations.map((reg) => {
                  const config = statusConfig[reg.status as keyof typeof statusConfig] || statusConfig.pending;
                  const StatusIcon = config.icon;

                  return (
                    <button
                      key={reg.id}
                      type="button"
                      className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50"
                      onClick={() => onRowClick(reg)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {reg.firstName} {reg.lastName}
                          </p>
                          <Badge className={`${config.color} gap-1 capitalize`}>
                            <StatusIcon className="h-3 w-3" />
                            {reg.status}
                          </Badge>
                          {reg.teamName ? (
                            <Badge variant="secondary">{reg.teamName}</Badge>
                          ) : (
                            <Badge variant="secondary">No team</Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span>{reg.email}</span>
                          <Separator orientation="vertical" className="h-4" />
                          <span className="capitalize">{reg.role}</span>
                          <Separator orientation="vertical" className="h-4" />
                          <span>Registered {formatDate(reg.registeredAt, "MMM dd, yyyy")}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
          <div>
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
                    {formatDate(reg.registeredAt, "MMM dd, yyyy")}
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
