import { useState } from "react";
import { Link } from "react-router-dom";
import { BellPlus, Loader2, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/seo";
import { trackEvent } from "@/lib/analytics";
import { updateAlert, type JobAlert } from "@/lib/alerts";
import { useMyAlerts } from "@/hooks/use-alerts";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import { AlertEditDialog } from "@/components/alerts/alert-edit-dialog";
import { AlertDeleteDialog } from "@/components/alerts/alert-delete-dialog";
import {
    AlertCriteriaChips,
    AlertStatusBadge,
    alertTitle,
    formatLastSent,
} from "@/components/alerts/alert-shared";

/** Small ghost action button used inside an alert card (sits above the stretched link). */
function CardAction({
    onClick,
    disabled,
    label,
    children,
}: {
    onClick: () => void;
    disabled?: boolean;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="relative z-10 inline-flex items-center gap-1.5 rounded-lg border border-joy-ink/12 bg-white px-2.5 py-1.5 text-xs font-bold text-joy-ink-muted transition hover:border-joy-grass/50 hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 disabled:opacity-50"
        >
            {children}
        </button>
    );
}

function AlertCard({ alert, onChanged }: { alert: JobAlert; onChanged: () => void }) {
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [pausing, setPausing] = useState(false);

    const handleTogglePause = async () => {
        setPausing(true);
        try {
            await updateAlert(alert.id, { active: !alert.active });
            trackEvent(alert.active ? "alert_paused" : "alert_resumed", { alertId: alert.id });
            toast.success(alert.active ? "Alert paused" : "Alert resumed");
            onChanged();
        } catch (error) {
            console.error("Failed to toggle alert:", error);
            toast.error("Couldn't update alert", {
                description: error instanceof Error ? error.message : "Please try again",
            });
        } finally {
            setPausing(false);
        }
    };

    return (
        <div className="relative rounded-2xl border border-joy-ink/8 bg-white p-5 shadow-sm transition hover:border-joy-grass/30">
            {/* Stretched link — whole card navigates to detail; action buttons sit above via z-10. */}
            <Link
                to={`/account/alerts/${alert.id}`}
                aria-label={`Open alert ${alertTitle(alert)}`}
                className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="joy-display truncate text-lg font-extrabold text-joy-ink">
                            {alertTitle(alert)}
                        </h2>
                        <AlertStatusBadge active={alert.active} />
                    </div>
                    <p className="mt-1 text-xs text-joy-ink-muted">{formatLastSent(alert)}</p>
                    <div className="mt-3">
                        <AlertCriteriaChips alert={alert} />
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <CardAction onClick={() => setEditOpen(true)} label="Edit alert">
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                    </CardAction>
                    <CardAction onClick={handleTogglePause} disabled={pausing} label={alert.active ? "Pause alert" : "Resume alert"}>
                        {pausing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : alert.active ? (
                            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                            <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {alert.active ? "Pause" : "Resume"}
                    </CardAction>
                    <CardAction onClick={() => setDeleteOpen(true)} label="Delete alert">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete
                    </CardAction>
                </div>
            </div>

            <AlertEditDialog
                alert={alert}
                open={editOpen}
                onOpenChange={setEditOpen}
                onSaved={() => {
                    setEditOpen(false);
                    onChanged();
                }}
            />
            <AlertDeleteDialog
                alert={alert}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onDeleted={() => {
                    setDeleteOpen(false);
                    onChanged();
                }}
            />
        </div>
    );
}

export default function AlertsPage() {
    const { alerts, loading, error, refetch } = useMyAlerts();

    return (
        <div style={{ colorScheme: "light" }}>
            <Seo title="My job alerts" description="Manage the job alerts you receive by email." noSuffix={false} />
            <PlaygroundShell
                routes={LIVE_ROUTES}
                showSwitcher={false}
                activeNav="jobs"
                cta={{ label: "New alert", to: LIVE_ROUTES.alertBuilder }}
            >
                <section className="px-5 pb-6 pt-10 md:pt-12">
                    <div className="mx-auto max-w-3xl">
                        <h1 className="joy-display text-3xl font-extrabold leading-[1.08] tracking-tight text-joy-ink sm:text-4xl">
                            My alerts
                        </h1>
                        <p className="mt-3 max-w-2xl text-base text-joy-ink-muted">
                            The searches we watch for you. Edit the criteria, pause anything noisy, or open one to see
                            exactly what we emailed.
                        </p>
                    </div>
                </section>

                <section className="px-5 pb-16">
                    <div className="mx-auto max-w-3xl">
                        {loading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="h-32 animate-pulse rounded-2xl border border-joy-ink/8 bg-white" />
                                ))}
                            </div>
                        ) : error ? (
                            <div className="rounded-2xl border border-joy-ink/8 bg-white p-8 text-center shadow-sm">
                                <p className="text-sm text-joy-ink-muted">{error}</p>
                                <PlaygroundButton onClick={refetch} variant="outline" className="mt-4">
                                    Try again
                                </PlaygroundButton>
                            </div>
                        ) : alerts.length === 0 ? (
                            <div className="rounded-2xl border-2 border-dashed border-joy-grass/30 bg-joy-grass-bright/8 px-6 py-12 text-center">
                                <BellPlus className="mx-auto h-8 w-8 text-joy-grass" aria-hidden="true" />
                                <p className="joy-display mt-4 text-xl font-extrabold text-joy-ink">No alerts yet</p>
                                <p className="mx-auto mt-2 max-w-md text-sm text-joy-ink-muted">
                                    Set up an alert and we&apos;ll email you the moment matching roles drop. Nothing else,
                                    ever.
                                </p>
                                <PlaygroundButton to={LIVE_ROUTES.alertBuilder} className="mt-6">
                                    Create your first alert
                                </PlaygroundButton>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {alerts.map((alert) => (
                                    <AlertCard key={alert.id} alert={alert} onChanged={refetch} />
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </PlaygroundShell>
        </div>
    );
}
