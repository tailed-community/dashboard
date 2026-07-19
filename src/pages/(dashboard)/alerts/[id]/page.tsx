import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/seo";
import { trackEvent } from "@/lib/analytics";
import { updateAlert, type DigestRun } from "@/lib/alerts";
import { useAlert } from "@/hooks/use-alerts";
import { useLiveJobs, type JoyJob } from "@/components/playground/joy-live-jobs";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import { JoyJobRow } from "@/components/playground/joy-job-row";
import { AlertEditDialog } from "@/components/alerts/alert-edit-dialog";
import { AlertDeleteDialog } from "@/components/alerts/alert-delete-dialog";
import {
    AlertCriteriaChips,
    AlertStatusBadge,
    alertTitle,
    formatShortDate,
} from "@/components/alerts/alert-shared";

/** Ghost header action button, matching the joy outline style. */
function HeaderAction({
    onClick,
    disabled,
    children,
}: {
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg border border-joy-ink/12 bg-white px-3 py-2 text-xs font-bold text-joy-ink-muted transition hover:border-joy-grass/50 hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 disabled:opacity-50"
        >
            {children}
        </button>
    );
}

/** One batch: a heading (date · count) then its resolved jobs / no-longer-listed rows. */
function BatchSection({ run, jobsById }: { run: DigestRun; jobsById: Map<string, JoyJob> }) {
    const dateLabel = formatShortDate(run.sentAt) ?? "Recently";
    const count = run.jobCount;

    return (
        <div>
            <div className="mb-3 flex items-baseline gap-2">
                <h3 className="joy-display text-base font-extrabold text-joy-ink">{dateLabel}</h3>
                <span className="joy-mono text-xs text-joy-ink-muted">
                    {count} {count === 1 ? "role" : "roles"}
                </span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-joy-ink/8 bg-white shadow-sm">
                <ul>
                    {run.jobIds.map((jobId, i) => {
                        const job = jobsById.get(jobId);
                        if (job) {
                            return <JoyJobRow key={jobId} job={job} first={i === 0} />;
                        }
                        return (
                            <li
                                key={jobId}
                                className={`px-4 py-3 text-sm text-joy-ink/40 ${i === 0 ? "" : "border-t border-joy-ink/8"}`}
                            >
                                This role is no longer listed
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

export default function AlertDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { alert, runs, loading, error, refetch } = useAlert(id);
    const { all: liveJobs, loading: jobsLoading } = useLiveJobs();

    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [pausing, setPausing] = useState(false);

    const jobsById = useMemo(() => {
        const map = new Map<string, JoyJob>();
        for (const job of liveJobs) map.set(job.id, job);
        return map;
    }, [liveJobs]);

    useEffect(() => {
        if (alert && runs.length > 0) {
            trackEvent("alert_batch_viewed", { alertId: alert.id, batches: runs.length });
        }
    }, [alert, runs.length]);

    const handleTogglePause = async () => {
        if (!alert) return;
        setPausing(true);
        try {
            await updateAlert(alert.id, { active: !alert.active });
            trackEvent(alert.active ? "alert_paused" : "alert_resumed", { alertId: alert.id });
            toast.success(alert.active ? "Alert paused" : "Alert resumed");
            refetch();
        } catch (err) {
            console.error("Failed to toggle alert:", err);
            toast.error("Couldn't update alert", {
                description: err instanceof Error ? err.message : "Please try again",
            });
        } finally {
            setPausing(false);
        }
    };

    return (
        <div style={{ colorScheme: "light" }}>
            <Seo
                title={alert ? `Alert · ${alertTitle(alert)}` : "Alert"}
                description="Review the digests we've sent for this job alert."
                noSuffix={false}
            />
            <PlaygroundShell
                routes={LIVE_ROUTES}
                showSwitcher={false}
                activeNav="jobs"
                cta={{ label: "New alert", to: LIVE_ROUTES.alertBuilder }}
            >
                <section className="px-5 pb-4 pt-8">
                    <div className="mx-auto max-w-3xl">
                        <PlaygroundButton to="/account/alerts" variant="quiet" className="!px-0 !py-0">
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Back to my alerts
                        </PlaygroundButton>
                    </div>
                </section>

                <section className="px-5 pb-16">
                    <div className="mx-auto max-w-3xl">
                        {loading ? (
                            <div className="space-y-4">
                                <div className="h-32 animate-pulse rounded-2xl border border-joy-ink/8 bg-white" />
                                <div className="h-48 animate-pulse rounded-2xl border border-joy-ink/8 bg-white" />
                            </div>
                        ) : error || !alert ? (
                            <div className="rounded-2xl border border-joy-ink/8 bg-white p-8 text-center shadow-sm">
                                <p className="joy-display text-xl font-extrabold text-joy-ink">
                                    We couldn&apos;t load this alert
                                </p>
                                <p className="mt-2 text-sm text-joy-ink-muted">
                                    {error || "It may have been deleted, or the link is off."}
                                </p>
                                <PlaygroundButton to="/account/alerts" variant="outline" className="mt-6">
                                    Back to my alerts
                                </PlaygroundButton>
                            </div>
                        ) : (
                            <>
                                {/* Criteria card */}
                                <div className="rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h1 className="joy-display truncate text-2xl font-extrabold text-joy-ink">
                                                    {alertTitle(alert)}
                                                </h1>
                                                <AlertStatusBadge active={alert.active} />
                                            </div>
                                            <div className="mt-3">
                                                <AlertCriteriaChips alert={alert} />
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                                            <HeaderAction onClick={() => setEditOpen(true)}>
                                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                                Edit
                                            </HeaderAction>
                                            <HeaderAction onClick={handleTogglePause} disabled={pausing}>
                                                {pausing ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                                ) : alert.active ? (
                                                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                                                ) : (
                                                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                                                )}
                                                {alert.active ? "Pause" : "Resume"}
                                            </HeaderAction>
                                            <HeaderAction onClick={() => setDeleteOpen(true)}>
                                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                                Delete
                                            </HeaderAction>
                                        </div>
                                    </div>
                                </div>

                                {/* Batches */}
                                <div className="mt-8">
                                    <h2 className="joy-display mb-4 text-lg font-extrabold text-joy-ink">
                                        Digest history
                                    </h2>
                                    {runs.length === 0 ? (
                                        <div className="rounded-2xl border-2 border-dashed border-joy-ink/12 bg-white px-6 py-12 text-center">
                                            <p className="text-sm text-joy-ink-muted">
                                                Your first digest will appear here once we&apos;ve emailed you matching
                                                roles.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-8">
                                            {jobsLoading && (
                                                <p className="text-xs text-joy-ink-muted">Resolving roles from the live feed…</p>
                                            )}
                                            {runs.map((run) => (
                                                <BatchSection key={run.id} run={run} jobsById={jobsById} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <AlertEditDialog
                                    alert={alert}
                                    open={editOpen}
                                    onOpenChange={setEditOpen}
                                    onSaved={() => {
                                        setEditOpen(false);
                                        refetch();
                                    }}
                                />
                                <AlertDeleteDialog
                                    alert={alert}
                                    open={deleteOpen}
                                    onOpenChange={setDeleteOpen}
                                    onDeleted={() => {
                                        setDeleteOpen(false);
                                        navigate("/account/alerts");
                                    }}
                                />
                            </>
                        )}
                    </div>
                </section>
            </PlaygroundShell>
        </div>
    );
}
