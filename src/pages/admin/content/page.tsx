import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";
import { AdminNav } from "@/components/admin/admin-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Pencil, Search, ShieldAlert, UserCog } from "lucide-react";

interface AdminEvent {
    id: string;
    title: string;
    slug?: string;
    description?: string;
    category?: string;
    status?: string;
    moderationStatus?: string;
    startDate?: string;
    city?: string;
    createdBy?: string;
    createdAt?: string;
    customHostName?: string;
    hostType?: string;
    communityId?: string;
}

interface AdminCommunity {
    id: string;
    name: string;
    slug?: string;
    shortDescription?: string;
    category?: string;
    status?: string;
    memberCount?: number;
    createdBy?: string;
    createdAt?: string;
    logo?: string;
}

type ContentKind = "events" | "communities";

interface TransferTarget {
    kind: ContentKind;
    id: string;
    label: string;
}

interface ArchiveTarget {
    kind: ContentKind;
    id: string;
    label: string;
}

const RESULT_LIMIT = 100;

/**
 * Events carry TWO independent status axes — lifecycle `status`
 * (draft/published/cancelled) and `moderationStatus`
 * (pending/approved/rejected) — and the backend filters on them separately.
 * They get separate controls so combinations stay reachable: "published but
 * still pending review" is a question a moderator actually asks, and folding
 * both axes into one select makes it unaskable.
 */

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

function statusVariant(status?: string): "default" | "secondary" | "destructive" | "outline" {
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

function TableSkeleton() {
    return (
        <div className="space-y-2 rounded-lg border bg-white p-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="ml-auto h-8 w-40" />
                </div>
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

function EmptyResults({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
            <p className="text-sm text-slate-600">No {label} matched your search.</p>
        </div>
    );
}

function TruncatedNotice({ count }: { count: number }) {
    return (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
                Showing the first {count} results only — there are more matches. Refine your
                search or narrow the status filter to see the rest.
            </span>
        </div>
    );
}

export default function AdminContentPage() {
    const [tab, setTab] = useState<ContentKind>("events");

    // Raw input value vs. the debounced value that actually drives fetches.
    const [searchInput, setSearchInput] = useState("");
    const [query, setQuery] = useState("");
    const [eventStatus, setEventStatus] = useState("all");
    const [eventModerationStatus, setEventModerationStatus] = useState("all");
    const [communityStatus, setCommunityStatus] = useState("all");

    const [events, setEvents] = useState<AdminEvent[]>([]);
    const [communities, setCommunities] = useState<AdminCommunity[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [loadingCommunities, setLoadingCommunities] = useState(true);
    const [eventsForbidden, setEventsForbidden] = useState(false);
    const [communitiesForbidden, setCommunitiesForbidden] = useState(false);
    const [eventsTruncated, setEventsTruncated] = useState(false);
    const [communitiesTruncated, setCommunitiesTruncated] = useState(false);

    const [transferTarget, setTransferTarget] = useState<TransferTarget | null>(null);
    const [transferValue, setTransferValue] = useState("");
    const [transferReason, setTransferReason] = useState("");
    const [transferError, setTransferError] = useState<string | null>(null);
    const [transferSubmitting, setTransferSubmitting] = useState(false);

    const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);
    const [archiveReason, setArchiveReason] = useState("");
    const [archiveSubmitting, setArchiveSubmitting] = useState(false);

    // Debounce the search box (~300ms) so typing doesn't fire a request per key.
    useEffect(() => {
        const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const eventsAbort = useRef<AbortController | null>(null);
    const communitiesAbort = useRef<AbortController | null>(null);

    const fetchEvents = useCallback(async () => {
        eventsAbort.current?.abort();
        const controller = new AbortController();
        eventsAbort.current = controller;

        setLoadingEvents(true);
        try {
            const params = new URLSearchParams();
            if (query) params.set("q", query);
            if (eventStatus !== "all") params.set("status", eventStatus);
            if (eventModerationStatus !== "all") {
                params.set("moderationStatus", eventModerationStatus);
            }
            params.set("limit", String(RESULT_LIMIT));

            const response = await apiFetch(`/events/admin/all?${params.toString()}`, {
                signal: controller.signal,
            });
            const result = await response.json().catch(() => ({}));
            if (controller.signal.aborted) return;

            if (!response.ok) {
                if (response.status === 403) {
                    setEventsForbidden(true);
                    return;
                }
                throw new Error(result.error || "Failed to load events");
            }

            setEventsForbidden(false);
            setEvents(result.events || []);
            setEventsTruncated(Boolean(result.truncated));
        } catch (error) {
            if (controller.signal.aborted) return;
            console.error("Error fetching admin events:", error);
            toast.error(error instanceof Error ? error.message : "Failed to load events");
        } finally {
            if (!controller.signal.aborted) setLoadingEvents(false);
        }
    }, [query, eventStatus, eventModerationStatus]);

    const fetchCommunities = useCallback(async () => {
        communitiesAbort.current?.abort();
        const controller = new AbortController();
        communitiesAbort.current = controller;

        setLoadingCommunities(true);
        try {
            const params = new URLSearchParams();
            if (query) params.set("q", query);
            if (communityStatus !== "all") params.set("status", communityStatus);
            params.set("limit", String(RESULT_LIMIT));

            const response = await apiFetch(`/communities/admin/all?${params.toString()}`, {
                signal: controller.signal,
            });
            const result = await response.json().catch(() => ({}));
            if (controller.signal.aborted) return;

            if (!response.ok) {
                if (response.status === 403) {
                    setCommunitiesForbidden(true);
                    return;
                }
                throw new Error(result.error || "Failed to load communities");
            }

            setCommunitiesForbidden(false);
            setCommunities(result.communities || []);
            setCommunitiesTruncated(Boolean(result.truncated));
        } catch (error) {
            if (controller.signal.aborted) return;
            console.error("Error fetching admin communities:", error);
            toast.error(error instanceof Error ? error.message : "Failed to load communities");
        } finally {
            if (!controller.signal.aborted) setLoadingCommunities(false);
        }
    }, [query, communityStatus]);

    useEffect(() => {
        if (tab !== "events") return;
        fetchEvents();
    }, [tab, fetchEvents]);

    useEffect(() => {
        if (tab !== "communities") return;
        fetchCommunities();
    }, [tab, fetchCommunities]);

    function openTransfer(kind: ContentKind, id: string, label: string) {
        setTransferValue("");
        setTransferReason("");
        setTransferError(null);
        setTransferTarget({ kind, id, label });
    }

    async function submitTransfer() {
        if (!transferTarget) return;
        const value = transferValue.trim();
        if (!value) {
            setTransferError("Enter the new owner's email address or user ID.");
            return;
        }

        setTransferSubmitting(true);
        setTransferError(null);
        const { kind, id } = transferTarget;
        const reason = transferReason.trim();

        try {
            const response = await apiFetch(
                `/${kind === "events" ? "events" : "communities"}/${id}/transfer-ownership`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        // The single field accepts either form; "@" is the
                        // discriminator the server contract expects us to apply.
                        ...(value.includes("@") ? { email: value } : { uid: value }),
                        ...(reason ? { reason } : {}),
                    }),
                }
            );
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                // Keep the dialog open so the admin can correct the identifier
                // rather than losing what they typed to a dismissing toast.
                setTransferError(result.error || "Failed to transfer ownership");
                return;
            }

            const newOwner = result.newOwner?.email || result.newOwner?.uid || value;
            toast.success(`Ownership transferred to ${newOwner}`);
            setTransferTarget(null);
            if (kind === "events") fetchEvents();
            else fetchCommunities();
        } catch (error) {
            console.error("Error transferring ownership:", error);
            setTransferError(
                error instanceof Error ? error.message : "Failed to transfer ownership"
            );
        } finally {
            setTransferSubmitting(false);
        }
    }

    function openArchive(kind: ContentKind, id: string, label: string) {
        setArchiveReason("");
        setArchiveTarget({ kind, id, label });
    }

    async function confirmArchive() {
        if (!archiveTarget) return;
        const { kind, id } = archiveTarget;
        const reason = archiveReason.trim();
        const isEvent = kind === "events";

        setArchiveSubmitting(true);

        // Optimistic status flip — restored from these snapshots on failure.
        const previousEvents = events;
        const previousCommunities = communities;
        if (isEvent) {
            setEvents((current) =>
                current.map((e) => (e.id === id ? { ...e, status: "cancelled" } : e))
            );
        } else {
            setCommunities((current) =>
                current.map((c) => (c.id === id ? { ...c, status: "rejected" } : c))
            );
        }

        try {
            const response = await apiFetch(`/${isEvent ? "events" : "communities"}/${id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reason ? { reason } : {}),
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.error || (isEvent ? "Failed to cancel event" : "Failed to archive community")
                );
            }

            toast.success(isEvent ? "Event cancelled" : "Community archived");
            setArchiveTarget(null);
        } catch (error) {
            console.error("Error archiving content:", error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : isEvent
                      ? "Failed to cancel event"
                      : "Failed to archive community"
            );
            if (isEvent) setEvents(previousEvents);
            else setCommunities(previousCommunities);
        } finally {
            setArchiveSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="mx-auto max-w-7xl px-6 py-12">
                <AdminNav />

                <div className="mb-8 space-y-2">
                    <h1 className="text-4xl font-bold text-slate-900">All content</h1>
                    <p className="text-slate-600">
                        Search every event and community — including already-approved ones — to
                        edit, reassign, or take it down.
                    </p>
                </div>

                <Tabs
                    value={tab}
                    onValueChange={(value) => setTab(value as ContentKind)}
                    className="w-full"
                >
                    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
                        <TabsList className="grid w-full max-w-xs grid-cols-2">
                            <TabsTrigger value="events">Events</TabsTrigger>
                            <TabsTrigger value="communities">Communities</TabsTrigger>
                        </TabsList>

                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder={
                                    tab === "events"
                                        ? "Search events by title or slug…"
                                        : "Search communities by name or slug…"
                                }
                                className="pl-9"
                            />
                        </div>

                        {tab === "events" ? (
                            <>
                            <Select value={eventStatus} onValueChange={setEventStatus}>
                                <SelectTrigger className="w-full md:w-44">
                                    <SelectValue placeholder="Any lifecycle" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Lifecycle</SelectLabel>
                                        <SelectItem value="all">Any lifecycle</SelectItem>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="published">Published</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <Select
                                value={eventModerationStatus}
                                onValueChange={setEventModerationStatus}
                            >
                                <SelectTrigger className="w-full md:w-48">
                                    <SelectValue placeholder="Any review state" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Moderation</SelectLabel>
                                        <SelectItem value="all">Any review state</SelectItem>
                                        <SelectItem value="pending">Pending review</SelectItem>
                                        <SelectItem value="approved">Approved</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            </>
                        ) : (
                            <Select value={communityStatus} onValueChange={setCommunityStatus}>
                                <SelectTrigger className="w-full md:w-56">
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="pending">Pending review</SelectItem>
                                    <SelectItem value="rejected">Rejected / archived</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <TabsContent value="events">
                        {eventsForbidden ? (
                            <NoAccessNotice />
                        ) : loadingEvents ? (
                            <TableSkeleton />
                        ) : (
                            <>
                                {eventsTruncated && <TruncatedNotice count={events.length} />}
                                {events.length === 0 ? (
                                    <EmptyResults label="events" />
                                ) : (
                                    <div className="rounded-lg border bg-white">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Event</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Category</TableHead>
                                                    <TableHead>Created</TableHead>
                                                    <TableHead className="text-right">
                                                        Actions
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {events.map((event) => (
                                                    <TableRow key={event.id}>
                                                        <TableCell>
                                                            <div className="font-medium text-slate-900">
                                                                {event.title}
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                /{event.slug || event.id}
                                                                {event.city ? ` · ${event.city}` : ""}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-wrap gap-1">
                                                                <Badge
                                                                    variant={statusVariant(
                                                                        event.status
                                                                    )}
                                                                >
                                                                    {event.status || "unknown"}
                                                                </Badge>
                                                                <Badge
                                                                    variant={statusVariant(
                                                                        event.moderationStatus
                                                                    )}
                                                                >
                                                                    {event.moderationStatus ||
                                                                        "unreviewed"}
                                                                </Badge>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-slate-600">
                                                            {event.category || "—"}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-slate-600">
                                                            {formatDate(event.createdAt)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    asChild
                                                                >
                                                                    <Link
                                                                        to={`/events/${event.id}/edit`}
                                                                    >
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                        Edit
                                                                    </Link>
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        openTransfer(
                                                                            "events",
                                                                            event.id,
                                                                            event.title
                                                                        )
                                                                    }
                                                                >
                                                                    <UserCog className="h-3.5 w-3.5" />
                                                                    Transfer
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="text-red-600 hover:text-red-700"
                                                                    onClick={() =>
                                                                        openArchive(
                                                                            "events",
                                                                            event.id,
                                                                            event.title
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        event.status === "cancelled"
                                                                    }
                                                                >
                                                                    Cancel event
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="communities">
                        {communitiesForbidden ? (
                            <NoAccessNotice />
                        ) : loadingCommunities ? (
                            <TableSkeleton />
                        ) : (
                            <>
                                {communitiesTruncated && (
                                    <TruncatedNotice count={communities.length} />
                                )}
                                {communities.length === 0 ? (
                                    <EmptyResults label="communities" />
                                ) : (
                                    <div className="rounded-lg border bg-white">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Community</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Category</TableHead>
                                                    <TableHead>Members</TableHead>
                                                    <TableHead>Created</TableHead>
                                                    <TableHead className="text-right">
                                                        Actions
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {communities.map((community) => (
                                                    <TableRow key={community.id}>
                                                        <TableCell>
                                                            <div className="font-medium text-slate-900">
                                                                {community.name}
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                /{community.slug || community.id}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant={statusVariant(
                                                                    community.status
                                                                )}
                                                            >
                                                                {community.status || "unknown"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-slate-600">
                                                            {community.category || "—"}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-slate-600">
                                                            {community.memberCount ?? 0}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-slate-600">
                                                            {formatDate(community.createdAt)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    asChild
                                                                >
                                                                    <Link
                                                                        to={`/communities/${community.id}/admin`}
                                                                    >
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                        Edit
                                                                    </Link>
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        openTransfer(
                                                                            "communities",
                                                                            community.id,
                                                                            community.name
                                                                        )
                                                                    }
                                                                >
                                                                    <UserCog className="h-3.5 w-3.5" />
                                                                    Transfer
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="text-red-600 hover:text-red-700"
                                                                    onClick={() =>
                                                                        openArchive(
                                                                            "communities",
                                                                            community.id,
                                                                            community.name
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        community.status ===
                                                                        "rejected"
                                                                    }
                                                                >
                                                                    Archive
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Transfer ownership */}
            <Dialog
                open={transferTarget !== null}
                onOpenChange={(open) => {
                    if (!open && !transferSubmitting) setTransferTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transfer ownership</DialogTitle>
                        <DialogDescription>
                            Reassign {transferTarget?.label} to a different owner. The current
                            owner loses management access.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="transfer-identifier">
                                New owner&apos;s email or user ID
                            </Label>
                            <Input
                                id="transfer-identifier"
                                value={transferValue}
                                onChange={(e) => {
                                    setTransferValue(e.target.value);
                                    setTransferError(null);
                                }}
                                placeholder="someone@example.com or a Firebase UID"
                                autoComplete="off"
                            />
                            {transferError && (
                                <p className="text-sm text-red-600">{transferError}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="transfer-reason">Reason (optional)</Label>
                            <Textarea
                                id="transfer-reason"
                                value={transferReason}
                                onChange={(e) => setTransferReason(e.target.value)}
                                placeholder="Recorded in the audit log."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setTransferTarget(null)}
                            disabled={transferSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button onClick={submitTransfer} disabled={transferSubmitting}>
                            {transferSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            Transfer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Archive / cancel confirmation */}
            <Dialog
                open={archiveTarget !== null}
                onOpenChange={(open) => {
                    if (!open && !archiveSubmitting) setArchiveTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {archiveTarget?.kind === "events"
                                ? `Cancel ${archiveTarget?.label}?`
                                : `Archive ${archiveTarget?.label}?`}
                        </DialogTitle>
                        <DialogDescription>
                            {archiveTarget?.kind === "events"
                                ? "The event will be marked cancelled and hidden from listings. This is reversible by editing the event."
                                : "The community will be archived and hidden from listings. This is reversible by an admin."}
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        placeholder="Reason (optional) — recorded in the audit log."
                        value={archiveReason}
                        onChange={(e) => setArchiveReason(e.target.value)}
                        rows={3}
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setArchiveTarget(null)}
                            disabled={archiveSubmitting}
                        >
                            Keep it
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmArchive}
                            disabled={archiveSubmitting}
                        >
                            {archiveSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            {archiveTarget?.kind === "events" ? "Cancel event" : "Archive"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
