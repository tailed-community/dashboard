import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { usePlaygroundRoutes } from "@/components/playground/playground-routes";
import { ModeIcon, modeChipClass, type EventMode } from "@/components/playground/joy-primitives";
import type { EventItem } from "@/pages/design-lab/playground-events";

/**
 * One card in an events grid — rounded-2xl white card, cycling accent border,
 * matches the fresh-drops job grid. Shared by the `/events` board and the
 * community detail page's "Events" section, and linked through the active
 * route map so both the live and design-lab route sets work.
 *
 * Past events (negative `daysUntil`) drop the green "when" flag to muted ink,
 * since `relative` there reads "2 months ago" rather than a countdown.
 */
export function JoyEventTile({ event, accent }: { event: EventItem; accent: string }) {
    const routes = usePlaygroundRoutes();
    const isPast = event.daysUntil < 0;

    return (
        <Link
            to={routes.eventDetail(event.slug || event.id)}
            className={`flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${accent}`}
        >
            <div className="flex items-center justify-between gap-2">
                <span
                    className={`joy-mono text-xs font-bold uppercase tracking-wide ${
                        isPast ? "text-joy-ink/40" : "text-joy-grass"
                    }`}
                >
                    {event.relative}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${modeChipClass(event.mode as EventMode)}`}>
                    {event.mode}
                </span>
            </div>
            <p className="joy-display mt-2 line-clamp-2 text-base font-bold text-joy-ink">{event.title}</p>
            <p className="joy-mono mt-1 text-xs text-joy-ink-muted">
                {event.date} · {event.time}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-joy-ink/50">
                <ModeIcon mode={event.mode as EventMode} className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{event.city || event.location}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-joy-ink/8 pt-3">
                <span className="truncate text-xs font-semibold text-joy-ink-muted">{event.host}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-joy-ink/40">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {event.attendees}
                </span>
            </div>
        </Link>
    );
}
