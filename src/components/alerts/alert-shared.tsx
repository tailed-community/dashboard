import { MapPin } from "lucide-react";
import { jobTypeChipClass, jobTypeChipLabel } from "@/components/playground/joy-primitives";
import type { JobAlert } from "@/lib/alerts";

/** Neutral outline chip for secondary alert metadata (location / frequency). */
const NEUTRAL_CHIP_CLASS =
    "inline-flex items-center gap-1 rounded-full border border-joy-ink/12 px-2.5 py-0.5 text-xs font-bold text-joy-ink-muted";

/** Human title for an alert — its search query, or "All jobs" when unscoped. */
export function alertTitle(alert: JobAlert): string {
    const q = alert.query?.trim();
    return q && q.length > 0 ? q : "All jobs";
}

/**
 * Format an ISO timestamp as a short "Jul 17" label. Returns null for empty /
 * unparseable input so callers can pick their own fallback copy.
 */
export function formatShortDate(iso: string | null): string | null {
    if (!iso) return null;
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Last sent Jul 17" / "Not sent yet" summary from the alert's send metadata. */
export function formatLastSent(alert: JobAlert): string {
    const iso = alert.lastSentAt ?? alert.lastBatch?.sentAt ?? null;
    const label = formatShortDate(iso);
    return label ? `Last sent ${label}` : "Not sent yet";
}

/** Active / paused pill. */
export function AlertStatusBadge({ active }: { active: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                active ? "bg-joy-grass/10 text-joy-grass" : "bg-joy-ink/8 text-joy-ink-muted"
            }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${active ? "bg-joy-grass-bright" : "bg-joy-ink/30"}`}
                aria-hidden="true"
            />
            {active ? "Active" : "Paused"}
        </span>
    );
}

/** Chip row describing an alert's criteria: type, locations, frequency. */
export function AlertCriteriaChips({ alert }: { alert: JobAlert }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {alert.jobType && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${jobTypeChipClass(alert.jobType)}`}>
                    {jobTypeChipLabel(alert.jobType)}
                </span>
            )}
            {(alert.locations ?? []).map((loc) => (
                <span key={loc} className={NEUTRAL_CHIP_CLASS}>
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    {loc}
                </span>
            ))}
            <span className={NEUTRAL_CHIP_CLASS}>
                {alert.frequency === "weekly" ? "Weekly" : "Daily"}
            </span>
        </div>
    );
}
