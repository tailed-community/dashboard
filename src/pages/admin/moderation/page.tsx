import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";
import { AdminNav } from "@/components/admin/admin-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Check, Loader2, ShieldAlert, X } from "lucide-react";
import { htmlToText } from "@/lib/html";

interface PendingCommunity {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    description?: string;
    category?: string;
    logo?: string;
    createdBy?: string;
    createdAt?: string;
    status?: string;
}

interface PendingEvent {
    id: string;
    title: string;
    slug: string;
    description?: string;
    category?: string;
    hostType?: string;
    customHostName?: string;
    startDate?: string;
    createdBy?: string;
    createdAt?: string;
    moderationStatus?: string;
}

type ReviewAction = "approve" | "reject";

type QueueKind = "communities" | "events";

interface RejectTarget {
    kind: QueueKind;
    id: string;
    label: string;
}

function formatDate(value?: string): string {
    if (!value) return "Unknown date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function QueueSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="mt-2 h-4 w-1/3" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <div className="flex gap-2 pt-2">
                            <Skeleton className="h-9 w-24" />
                            <Skeleton className="h-9 w-24" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function NoAccessNotice() {
    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <ShieldAlert className="h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-600">
                You don&apos;t have access to this page.
            </p>
        </div>
    );
}

function EmptyQueue({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
            <p className="text-sm text-slate-600">
                No pending {label} — all clear.
            </p>
        </div>
    );
}

export default function ModerationQueuePage() {
    const [communities, setCommunities] = useState<PendingCommunity[]>([]);
    const [events, setEvents] = useState<PendingEvent[]>([]);
    const [loadingCommunities, setLoadingCommunities] = useState(true);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [communitiesForbidden, setCommunitiesForbidden] = useState(false);
    const [eventsForbidden, setEventsForbidden] = useState(false);
    const [pendingActionId, setPendingActionId] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectSubmitting, setRejectSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const response = await apiFetch("/communities/moderation/pending");
                const result = await response.json();
                if (cancelled) return;

                if (!response.ok) {
                    if (response.status === 403) {
                        setCommunitiesForbidden(true);
                        return;
                    }
                    throw new Error(result.error || "Failed to load pending communities");
                }

                setCommunities(result.communities || []);
            } catch (error) {
                console.error("Error fetching pending communities:", error);
                toast.error("Failed to load pending communities");
            } finally {
                if (!cancelled) setLoadingCommunities(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const response = await apiFetch("/events/moderation/pending");
                const result = await response.json();
                if (cancelled) return;

                if (!response.ok) {
                    if (response.status === 403) {
                        setEventsForbidden(true);
                        return;
                    }
                    throw new Error(result.error || "Failed to load pending events");
                }

                setEvents(result.events || []);
            } catch (error) {
                console.error("Error fetching pending events:", error);
                toast.error("Failed to load pending events");
            } finally {
                if (!cancelled) setLoadingEvents(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    async function reviewCommunity(id: string, action: ReviewAction, reason?: string) {
        const previous = communities;
        setPendingActionId(id);
        // Optimistic removal — restored on failure.
        setCommunities((current) => current.filter((c) => c.id !== id));

        try {
            const response = await apiFetch(`/communities/${id}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(result.error || `Failed to ${action} community`);
            }

            toast.success(action === "approve" ? "Community approved" : "Community rejected");
        } catch (error) {
            console.error(`Error reviewing community (${action}):`, error);
            toast.error(error instanceof Error ? error.message : `Failed to ${action} community`);
            setCommunities(previous);
        } finally {
            setPendingActionId(null);
        }
    }

    async function reviewEvent(id: string, action: ReviewAction, reason?: string) {
        const previous = events;
        setPendingActionId(id);
        setEvents((current) => current.filter((e) => e.id !== id));

        try {
            const response = await apiFetch(`/events/${id}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(result.error || `Failed to ${action} event`);
            }

            toast.success(action === "approve" ? "Event approved" : "Event rejected");
        } catch (error) {
            console.error(`Error reviewing event (${action}):`, error);
            toast.error(error instanceof Error ? error.message : `Failed to ${action} event`);
            setEvents(previous);
        } finally {
            setPendingActionId(null);
        }
    }

    function handleApprove(kind: QueueKind, id: string) {
        if (kind === "communities") {
            reviewCommunity(id, "approve");
        } else {
            reviewEvent(id, "approve");
        }
    }

    function openReject(kind: QueueKind, id: string, label: string) {
        setRejectReason("");
        setRejectTarget({ kind, id, label });
    }

    async function confirmReject() {
        if (!rejectTarget) return;
        setRejectSubmitting(true);
        const { kind, id } = rejectTarget;
        const reason = rejectReason.trim() || undefined;

        if (kind === "communities") {
            await reviewCommunity(id, "reject", reason);
        } else {
            await reviewEvent(id, "reject", reason);
        }

        setRejectSubmitting(false);
        setRejectTarget(null);
    }

    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="mx-auto max-w-6xl px-6 py-12">
                <AdminNav />

                <div className="mb-8 space-y-2">
                    <h1 className="text-4xl font-bold text-slate-900">Moderation Queue</h1>
                    <p className="text-slate-600">
                        Review pending communities and events before they go live.
                    </p>
                </div>

                <Tabs defaultValue="communities" className="w-full">
                    <TabsList className="mb-8 grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="communities">
                            Communities
                            {!loadingCommunities && !communitiesForbidden && (
                                <Badge variant="secondary" className="ml-1.5">
                                    {communities.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="events">
                            Events
                            {!loadingEvents && !eventsForbidden && (
                                <Badge variant="secondary" className="ml-1.5">
                                    {events.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="communities">
                        {communitiesForbidden ? (
                            <NoAccessNotice />
                        ) : loadingCommunities ? (
                            <QueueSkeleton />
                        ) : communities.length === 0 ? (
                            <EmptyQueue label="communities" />
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {communities.map((community) => (
                                    <Card key={community.id}>
                                        <CardHeader>
                                            <div className="flex items-start justify-between gap-2">
                                                <CardTitle className="text-lg">
                                                    {community.name}
                                                </CardTitle>
                                                {community.category && (
                                                    <Badge variant="outline">{community.category}</Badge>
                                                )}
                                            </div>
                                            <CardDescription className="flex items-center gap-1.5 text-xs">
                                                <CalendarDays className="h-3.5 w-3.5" />
                                                Submitted {formatDate(community.createdAt)}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="line-clamp-3 text-sm text-slate-600">
                                                {htmlToText(
                                                    community.shortDescription || community.description
                                                ) || "No description provided."}
                                            </p>
                                            <div className="mt-4 flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApprove("communities", community.id)}
                                                    disabled={pendingActionId === community.id}
                                                >
                                                    {pendingActionId === community.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Check className="h-4 w-4" />
                                                    )}
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        openReject("communities", community.id, community.name)
                                                    }
                                                    disabled={pendingActionId === community.id}
                                                >
                                                    <X className="h-4 w-4" />
                                                    Reject
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="events">
                        {eventsForbidden ? (
                            <NoAccessNotice />
                        ) : loadingEvents ? (
                            <QueueSkeleton />
                        ) : events.length === 0 ? (
                            <EmptyQueue label="events" />
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {events.map((event) => (
                                    <Card key={event.id}>
                                        <CardHeader>
                                            <div className="flex items-start justify-between gap-2">
                                                <CardTitle className="text-lg">{event.title}</CardTitle>
                                                {event.category && (
                                                    <Badge variant="outline">{event.category}</Badge>
                                                )}
                                            </div>
                                            <CardDescription className="space-y-1 text-xs">
                                                <span className="flex items-center gap-1.5">
                                                    <CalendarDays className="h-3.5 w-3.5" />
                                                    Starts {formatDate(event.startDate)}
                                                </span>
                                                <span className="block">
                                                    Hosted by{" "}
                                                    {event.customHostName || event.hostType || "Unknown host"}
                                                </span>
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="line-clamp-3 text-sm text-slate-600">
                                                {htmlToText(event.description) ||
                                                    "No description provided."}
                                            </p>
                                            <div className="mt-4 flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApprove("events", event.id)}
                                                    disabled={pendingActionId === event.id}
                                                >
                                                    {pendingActionId === event.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Check className="h-4 w-4" />
                                                    )}
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openReject("events", event.id, event.title)}
                                                    disabled={pendingActionId === event.id}
                                                >
                                                    <X className="h-4 w-4" />
                                                    Reject
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog
                open={rejectTarget !== null}
                onOpenChange={(open) => {
                    if (!open && !rejectSubmitting) setRejectTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject {rejectTarget?.label}?</DialogTitle>
                        <DialogDescription>
                            Optionally add a reason. This may be shared with the submitter.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        placeholder="Reason (optional)"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRejectTarget(null)}
                            disabled={rejectSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmReject}
                            disabled={rejectSubmitting}
                        >
                            {rejectSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
