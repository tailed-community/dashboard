import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Search, ShieldAlert } from "lucide-react";

type AuditAction = "update" | "archive" | "unarchive" | "delete" | "transfer_ownership";
type ResourceType = "event" | "community";

interface AuditChange {
    field: string;
    before?: unknown;
    after?: unknown;
}

/**
 * `createdAt` is a Firestore Timestamp serialized to JSON. Depending on which
 * code path produced it, that lands as either `{_seconds, _nanoseconds}` or a
 * plain ISO string — hence the union and the defensive formatter below.
 */
type FirestoreDate = string | { _seconds?: number; _nanoseconds?: number } | null | undefined;

interface AuditEntry {
    id: string;
    action: AuditAction;
    resourceType: ResourceType;
    resourceId: string;
    resourceName?: string;
    changes?: AuditChange[];
    reason?: string;
    actorUid?: string;
    actorEmail?: string;
    actorName?: string;
    createdAt?: FirestoreDate;
}

const RESULT_LIMIT = 100;

const ACTION_PHRASE: Record<AuditAction, string> = {
    update: "updated",
    archive: "archived",
    unarchive: "restored",
    delete: "deleted",
    transfer_ownership: "transferred ownership of",
};

function actionVariant(action: AuditAction): "default" | "secondary" | "destructive" | "outline" {
    switch (action) {
        case "delete":
        case "archive":
            return "destructive";
        case "transfer_ownership":
            return "default";
        case "unarchive":
            return "outline";
        default:
            return "secondary";
    }
}

/** Accepts both the `{_seconds}` Firestore shape and an ISO string. */
function toDate(value: FirestoreDate): Date | null {
    if (!value) return null;

    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof value === "object" && typeof value._seconds === "number") {
        const millis = value._seconds * 1000 + Math.floor((value._nanoseconds ?? 0) / 1e6);
        const parsed = new Date(millis);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
}

function formatAbsolute(value: FirestoreDate): string {
    const date = toDate(value);
    if (!date) return "Unknown date";
    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatRelative(value: FirestoreDate): string | null {
    const date = toDate(value);
    if (!date) return null;

    const seconds = Math.round((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.round(months / 12)}y ago`;
}

/** Values may be objects/arrays/booleans — stringify anything that isn't a string. */
function renderValue(value: unknown): string {
    if (value === undefined) return "—";
    if (value === null) return "null";
    if (typeof value === "string") return value === "" ? '""' : value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function actorLabel(entry: AuditEntry): string {
    return entry.actorName || entry.actorEmail || entry.actorUid || "Unknown admin";
}

/**
 * Link to the edit surface rather than the public page. A log entry is most
 * often read while fixing something, and archived or cancelled resources are
 * hidden from public routes — which is precisely when their history is being
 * consulted, so a public link would 404 exactly when it's needed.
 */
function resourcePath(entry: AuditEntry): string {
    return entry.resourceType === "event"
        ? `/events/${entry.resourceId}/edit`
        : `/communities/${entry.resourceId}/admin`;
}

function LogSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                    <CardContent className="space-y-2 py-4">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
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

function AuditEntryCard({ entry }: { entry: AuditEntry }) {
    const [expanded, setExpanded] = useState(false);
    const changes = entry.changes || [];
    const relative = formatRelative(entry.createdAt);

    return (
        <Card>
            <CardContent className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                        <p className="text-sm text-slate-900">
                            <span className="font-medium">{actorLabel(entry)}</span>{" "}
                            {ACTION_PHRASE[entry.action] || entry.action}{" "}
                            <Link
                                to={resourcePath(entry)}
                                className="font-medium text-brand-blue underline underline-offset-2 hover:opacity-80"
                            >
                                {entry.resourceName || entry.resourceId}
                            </Link>
                        </p>
                        <p className="text-xs text-slate-500">
                            {formatAbsolute(entry.createdAt)}
                            {relative ? ` · ${relative}` : ""}
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Badge variant="outline">{entry.resourceType}</Badge>
                        <Badge variant={actionVariant(entry.action)}>
                            {entry.action.replace(/_/g, " ")}
                        </Badge>
                    </div>
                </div>

                {entry.reason && (
                    <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="font-medium">Reason:</span> {entry.reason}
                    </p>
                )}

                {changes.length > 0 && (
                    <div className="mt-3">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-slate-600"
                            onClick={() => setExpanded((v) => !v)}
                            aria-expanded={expanded}
                        >
                            {expanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            {changes.length} field{changes.length === 1 ? "" : "s"} changed
                        </Button>

                        {expanded && (
                            <div className="mt-2 space-y-2 rounded-md border bg-slate-50 p-3">
                                {changes.map((change, i) => (
                                    <div key={`${change.field}-${i}`} className="text-xs">
                                        <div className="font-medium text-slate-700">
                                            {change.field}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-start gap-2">
                                            <code className="max-w-full break-all rounded bg-red-50 px-1.5 py-0.5 text-red-800">
                                                {renderValue(change.before)}
                                            </code>
                                            <span className="text-slate-400">→</span>
                                            <code className="max-w-full break-all rounded bg-green-50 px-1.5 py-0.5 text-green-800">
                                                {renderValue(change.after)}
                                            </code>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function AdminAuditLogPage() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [resourceType, setResourceType] = useState("all");
    const [actorFilter, setActorFilter] = useState("");

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (resourceType !== "all") params.set("resourceType", resourceType);
                params.set("limit", String(RESULT_LIMIT));

                const response = await apiFetch(`/admin/audit-log?${params.toString()}`);
                const result = await response.json().catch(() => ({}));
                if (cancelled) return;

                if (!response.ok) {
                    if (response.status === 403) {
                        setForbidden(true);
                        return;
                    }
                    throw new Error(result.error || "Failed to load audit log");
                }

                setForbidden(false);
                setEntries(result.entries || []);
            } catch (error) {
                if (cancelled) return;
                console.error("Error fetching audit log:", error);
                toast.error(error instanceof Error ? error.message : "Failed to load audit log");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [resourceType]);

    // The backend only matches actorUid exactly, so the free-text actor box
    // filters the loaded page client-side across name / email / uid instead.
    const visible = useMemo(() => {
        const needle = actorFilter.trim().toLowerCase();
        if (!needle) return entries;
        return entries.filter((entry) =>
            [entry.actorName, entry.actorEmail, entry.actorUid]
                .filter(Boolean)
                .some((field) => field!.toLowerCase().includes(needle))
        );
    }, [entries, actorFilter]);

    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="mx-auto max-w-4xl px-6 py-12">
                <AdminNav />

                <div className="mb-8 space-y-2">
                    <h1 className="text-4xl font-bold text-slate-900">Audit log</h1>
                    <p className="text-slate-600">
                        Every admin edit, transfer, and takedown — newest first.
                    </p>
                </div>

                <div className="mb-6 flex flex-col gap-3 md:flex-row">
                    <Select value={resourceType} onValueChange={setResourceType}>
                        <SelectTrigger className="w-full md:w-48">
                            <SelectValue placeholder="All resources" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All resources</SelectItem>
                            <SelectItem value="event">Events</SelectItem>
                            <SelectItem value="community">Communities</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={actorFilter}
                            onChange={(e) => setActorFilter(e.target.value)}
                            placeholder="Filter by admin name, email, or UID…"
                            className="pl-9"
                        />
                    </div>
                </div>

                {forbidden ? (
                    <NoAccessNotice />
                ) : loading ? (
                    <LogSkeleton />
                ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
                        <p className="text-sm text-slate-600">
                            {entries.length === 0
                                ? "No admin actions recorded yet."
                                : "No entries match that actor filter."}
                        </p>
                        {/* Without this, an actor with no hits in the loaded
                            page reads as "this admin has never done
                            anything" — a claim the filter cannot support. */}
                        {entries.length >= RESULT_LIMIT && (
                            <p className="max-w-md text-xs text-slate-500">
                                The actor filter only searches the {RESULT_LIMIT} most
                                recent actions, so older entries for this person may
                                exist. Narrow by resource type to look further back.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {visible.map((entry) => (
                            <AuditEntryCard key={entry.id} entry={entry} />
                        ))}
                        {entries.length >= RESULT_LIMIT && (
                            <p className="pt-2 text-center text-xs text-slate-500">
                                Showing the most recent {RESULT_LIMIT} actions
                                {actorFilter.trim()
                                    ? " — the actor filter searches only within these."
                                    : "."}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
