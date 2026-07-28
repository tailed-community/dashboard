import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    CalendarPlus,
    ExternalLink,
    Loader2,
    MapPin,
    Pencil,
    Users as UsersIcon,
    CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";

type CommunityEvent = {
    id: string;
    title: string;
    slug?: string;
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    city?: string;
    location?: string;
    mode?: string;
    category?: string;
    status?: string;
    moderationStatus?: string;
    attendees?: number;
    capacity?: number;
};

interface CommunityEventsTabProps {
    communityId: string;
}

/**
 * Events created before moderation shipped have no `moderationStatus`.
 * The backend treats a missing value as "approved" (see
 * getEffectiveModerationStatus in functions/src/routes/event.ts) — mirror
 * that here so legacy events don't render as "unreviewed".
 */
function effectiveModerationStatus(event: CommunityEvent): string {
    return event.moderationStatus || "approved";
}

function statusVariant(
    status?: string
): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
        case "approved":
        case "published":
            return "default";
        case "pending":
        case "draft":
            return "secondary";
        case "rejected":
        case "cancelled":
            return "destructive";
        default:
            return "outline";
    }
}

/** Events store `startDate` as "YYYY-MM-DD" and `startTime` as "HH:mm". */
function toDate(day?: string, time?: string): Date | null {
    if (!day) return null;
    const parsed = new Date(`${day}T${time || "00:00"}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatEventDate(event: CommunityEvent): string {
    const start = toDate(event.startDate, event.startTime);
    if (!start) return "Date TBD";
    const datePart = start.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
    if (!event.startTime) return datePart;
    const timePart = start.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
    });
    return `${datePart} · ${timePart}`;
}

/** An event counts as upcoming until its end (or start) day is over. */
function isUpcoming(event: CommunityEvent): boolean {
    const end = toDate(event.endDate || event.startDate, event.endTime || "23:59");
    if (!end) return true; // undated events stay actionable at the top
    return end.getTime() >= Date.now();
}

export default function CommunityEventsTab({ communityId }: CommunityEventsTabProps) {
    const [events, setEvents] = useState<CommunityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancelTarget, setCancelTarget] = useState<CommunityEvent | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelling, setCancelling] = useState(false);

    const fetchEvents = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiFetch(`/communities/${communityId}/events`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to load events");
            }

            setEvents((result.events || []) as CommunityEvent[]);
        } catch (error) {
            console.error("Error fetching community events:", error);
            toast.error("Failed to load events");
        } finally {
            setLoading(false);
        }
    }, [communityId]);

    useEffect(() => {
        if (communityId) {
            void fetchEvents();
        }
    }, [communityId, fetchEvents]);

    async function confirmCancel() {
        if (!cancelTarget) return;
        const reason = cancelReason.trim();

        try {
            setCancelling(true);
            const response = await apiFetch(`/events/${cancelTarget.id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reason ? { reason } : {}),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to cancel event");
            }

            toast.success("Event cancelled");
            setCancelTarget(null);
            setCancelReason("");
            await fetchEvents();
        } catch (error: any) {
            console.error("Error cancelling event:", error);
            toast.error(error.message || "Failed to cancel event");
        } finally {
            setCancelling(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            </div>
        );
    }

    const active = events.filter((e) => e.status !== "cancelled");
    const upcoming = active.filter(isUpcoming);
    const past = active.filter((e) => !isUpcoming(e));
    const cancelled = events.filter((e) => e.status === "cancelled");
    const pendingReview = events.filter(
        (e) => effectiveModerationStatus(e) === "pending"
    );
    const totalRegistrations = events.reduce((sum, e) => sum + (e.attendees || 0), 0);

    const renderTable = (rows: CommunityEvent[]) => (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Attendees</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((event) => {
                        const moderation = effectiveModerationStatus(event);
                        return (
                            <TableRow key={event.id}>
                                <TableCell>
                                    <div className="font-medium text-slate-900">
                                        {event.title}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                        {event.category && <span>{event.category}</span>}
                                        {(event.city || event.location) && (
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {event.city || event.location}
                                            </span>
                                        )}
                                        {event.mode && <span>{event.mode}</span>}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                                    {formatEventDate(event)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        <Badge variant={statusVariant(event.status)}>
                                            {event.status || "unknown"}
                                        </Badge>
                                        {moderation !== "approved" && (
                                            <Badge variant={statusVariant(moderation)}>
                                                {moderation === "pending"
                                                    ? "pending review"
                                                    : moderation}
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                                    {event.attendees || 0}
                                    {event.capacity ? ` / ${event.capacity}` : ""}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <Button size="sm" variant="outline" asChild>
                                            <Link to={`/events/${event.slug || event.id}`}>
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                View
                                            </Link>
                                        </Button>
                                        <Button size="sm" variant="outline" asChild>
                                            <Link to={`/events/${event.id}/manage`}>
                                                <UsersIcon className="h-3.5 w-3.5" />
                                                Attendees
                                            </Link>
                                        </Button>
                                        <Button size="sm" variant="outline" asChild>
                                            <Link to={`/events/${event.id}/edit`}>
                                                <Pencil className="h-3.5 w-3.5" />
                                                Edit
                                            </Link>
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-red-600 hover:text-red-700"
                                            onClick={() => {
                                                setCancelReason("");
                                                setCancelTarget(event);
                                            }}
                                            disabled={event.status === "cancelled"}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Total Events
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">
                            {events.length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Upcoming
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">
                            {upcoming.length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Total Registrations
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">
                            {totalRegistrations}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Pending Review
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">
                            {pendingReview.length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {events.length === 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Community Events</CardTitle>
                        <CardDescription>
                            Events hosted by this community
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-12">
                            <CalendarDays className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                            <p className="text-slate-600">
                                This community hasn't hosted any events yet.
                            </p>
                            <p className="text-sm text-slate-500 mt-2">
                                Create your first event to start collecting registrations.
                            </p>
                            <Button asChild className="mt-6">
                                <Link to="/events/create">
                                    <CalendarPlus className="mr-2 h-4 w-4" />
                                    Create Event
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                            <div>
                                <CardTitle>Upcoming Events ({upcoming.length})</CardTitle>
                                <CardDescription>
                                    Events your community is currently running or hosting soon
                                </CardDescription>
                            </div>
                            <Button asChild size="sm">
                                <Link to="/events/create">
                                    <CalendarPlus className="mr-2 h-4 w-4" />
                                    Create Event
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {upcoming.length === 0 ? (
                                <p className="py-6 text-center text-sm text-slate-500">
                                    No upcoming events scheduled.
                                </p>
                            ) : (
                                renderTable(upcoming)
                            )}
                        </CardContent>
                    </Card>

                    {past.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Past Events ({past.length})</CardTitle>
                                <CardDescription>
                                    Review attendance from events that have already happened
                                </CardDescription>
                            </CardHeader>
                            <CardContent>{renderTable(past)}</CardContent>
                        </Card>
                    )}

                    {cancelled.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Cancelled Events ({cancelled.length})</CardTitle>
                                <CardDescription>
                                    These events are hidden from public listings
                                </CardDescription>
                            </CardHeader>
                            <CardContent>{renderTable(cancelled)}</CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* Cancel confirmation */}
            <Dialog
                open={cancelTarget !== null}
                onOpenChange={(open) => {
                    if (!open && !cancelling) setCancelTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel {cancelTarget?.title}?</DialogTitle>
                        <DialogDescription>
                            The event will be marked as cancelled and hidden from public
                            listings. Registrations are kept, and an admin can reverse this.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        placeholder="Reason (optional)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCancelTarget(null)}
                            disabled={cancelling}
                        >
                            Keep event
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmCancel}
                            disabled={cancelling}
                        >
                            {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                            Cancel event
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
