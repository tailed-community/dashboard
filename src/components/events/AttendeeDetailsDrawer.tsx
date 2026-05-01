import { useState } from "react";
import { X, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Registration } from "@/types/registration";
import { DateTime } from "luxon";
import { formatDate } from "@/lib/dates";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";

interface AttendeeDetailsDrawerProps {
  registration: Registration | null;
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onRegistrationUpdated: (updated: Registration) => void;
}

const statusConfig = {
  pending: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100", label: "Pending" },
  confirmed: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100", label: "Confirmed" },
  rejected: { icon: XCircle, color: "text-red-600", bg: "bg-red-100", label: "Rejected" },
  attended: { icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-100", label: "Attended" },
  "no-show": { icon: XCircle, color: "text-red-600", bg: "bg-red-100", label: "No Show" },
  waitlisted: { icon: Clock, color: "text-amber-600", bg: "bg-amber-100", label: "Waitlisted" },
};

export function AttendeeDetailsDrawer({
  registration,
  isOpen,
  onClose,
  eventId,
  onRegistrationUpdated,
}: AttendeeDetailsDrawerProps) {
  const [reviewNotes, setReviewNotes] = useState(registration?.reviewNotes || "");
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<string>(registration?.status || "pending");

  if (!registration) return null;

  const config = statusConfig[registration.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = config.icon;

  const handleStatusUpdate = async (newSt: string) => {
    if (newSt === registration.status) return;

    setUpdating(true);
    try {
      const response = await apiFetch(
        `/events/${eventId}/registrations/${registration.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: newSt,
            reviewNotes: reviewNotes || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update registration");
      }

      setNewStatus(newSt);
      onRegistrationUpdated({
        ...registration,
        status: newSt as any,
        reviewNotes,
        reviewedAt: new Date().toISOString(),
      });

      toast.success(`Registration marked as ${newSt}`);
    } catch (error) {
      console.error("Error updating registration:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update registration");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${config.color}`} />
            {registration.firstName} {registration.lastName}
          </SheetTitle>
          <SheetDescription>{registration.email}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Current Status */}
          <div>
            <h3 className="mb-3 font-semibold">Current Status</h3>
            <Badge className={`${config.bg} ${config.color} text-sm gap-1 capitalize`}>
              {config.label}
            </Badge>
            {registration.reviewedAt && (
              <p className="mt-2 text-sm text-muted-foreground">
                Reviewed by admin on {formatDate(registration.reviewedAt, "MMM dd, yyyy 'at' hh:mm a")}
              </p>
            )}
          </div>

          <Separator />

          {/* Registration Info */}
          <div className="grid gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium capitalize">{registration.role}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Registered At</p>
              <p className="font-medium">{formatDate(registration.registeredAt, "MMM dd, yyyy 'at' hh:mm a")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Source</p>
              <p className="font-medium capitalize">{registration.source}</p>
            </div>
          </div>

          <Separator />

          {/* Form Answers */}
          {registration.formAnswers && registration.formAnswers.length > 0 && (
            <div>
              <h3 className="mb-3 font-semibold">Form Responses</h3>
              <div className="space-y-3">
                {registration.formAnswers.map((answer, idx) => (
                  <div key={idx} className="rounded-lg border p-3">
                    <p className="text-sm font-medium text-muted-foreground">{answer.label}</p>
                    <p className="mt-1">{String(answer.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Review Notes */}
          <div>
            <h3 className="mb-2 font-semibold">Admin Notes</h3>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add review notes..."
              className="min-h-[100px]"
            />
          </div>

          {/* Status Actions */}
          <div>
            <h3 className="mb-3 font-semibold">Update Status</h3>
            <div className="grid gap-2">
              <Button
                variant={newStatus === "confirmed" ? "default" : "outline"}
                disabled={updating}
                onClick={() => handleStatusUpdate("confirmed")}
              >
                {updating && newStatus === "confirmed" ? "Updating..." : "✓ Approve"}
              </Button>
              <Button
                variant={newStatus === "rejected" ? "destructive" : "outline"}
                disabled={updating}
                onClick={() => handleStatusUpdate("rejected")}
              >
                {updating && newStatus === "rejected" ? "Updating..." : "✕ Reject"}
              </Button>
              <Button
                variant={newStatus === "attended" ? "default" : "outline"}
                disabled={updating}
                onClick={() => handleStatusUpdate("attended")}
              >
                {updating && newStatus === "attended" ? "Updating..." : "Attended"}
              </Button>
              <Button
                variant={newStatus === "no-show" ? "destructive" : "outline"}
                disabled={updating}
                onClick={() => handleStatusUpdate("no-show")}
              >
                {updating && newStatus === "no-show" ? "Updating..." : "No Show"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
