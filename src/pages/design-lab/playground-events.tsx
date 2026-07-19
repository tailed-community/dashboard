import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DateTime } from "luxon";
import { ArrowRight, CalendarDays, MapPin, Sparkles, Users } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { MOCK_EVENTS } from "@/pages/design-lab/playground-events-mock";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LAB_ROUTES } from "@/components/playground/playground-routes";
import { FRESH_ACCENTS, ModeIcon, modeChipClass, type EventMode } from "@/components/playground/joy-primitives";

/**
 * `MockEventItem` carries richer detail-page-only fields (`description` as
 * paragraphs, `priceLabel`) that don't fit `EventItem`'s shape — strip them
 * before handing sample events to the grid, which only renders `EventItem`.
 */
const GRID_MOCK_EVENTS: EventItem[] = MOCK_EVENTS.map(({ description: _description, priceLabel: _priceLabel, ...item }) => item);

/** Alias kept for backward compatibility with the playground-event-detail page, which imports `Mode` from this file. */
export type Mode = EventMode;

/** Shape returned by GET /public/events — loosely typed since it's an untrusted public JSON response. */
export interface ApiEvent {
    id: string;
    slug?: string;
    title: string;
    startDate: string;
    startTime: string;
    location?: string;
    city?: string;
    digitalLink?: string;
    mode: Mode;
    isPaid: boolean;
    category: string;
    hostType: "community" | "custom";
    communityName?: string;
    customHostName?: string;
    attendees?: number;
    /** Real events carry a free-text description; exported for the detail page's real-data path. */
    description?: string;
}

/** Normalized event shape the page renders from. Exported so the mock-data file and detail page agree on shape. */
export interface EventItem {
    id: string;
    slug: string;
    title: string;
    date: string;
    time: string;
    relative: string;
    daysUntil: number;
    mode: Mode;
    location: string;
    city?: string;
    category: string;
    isPaid: boolean;
    host: string;
    attendees: number;
    description?: string;
}

/** "Today" / "Tomorrow" / "Wed" / "In 12d" / "Mar 4" — same rolling window logic as the production events page. Exported for reuse by the mock-data file and the detail page. */
export function formatEventWhen(startDate: string, startTime: string): { date: string; time: string; relative: string; daysUntil: number } {
    const dt = DateTime.fromISO(`${startDate}T${startTime}`);
    const now = DateTime.now();
    const diffDays = Math.ceil(dt.diff(now, "days").days || 0);
    let relative: string;
    if (diffDays <= 0) relative = "Today";
    else if (diffDays === 1) relative = "Tomorrow";
    else if (diffDays <= 7) relative = dt.toFormat("ccc");
    else if (diffDays <= 30) relative = `In ${diffDays}d`;
    else relative = dt.toFormat("MMM d");
    return {
        date: dt.isValid ? dt.toFormat("MMM d, yyyy") : "TBA",
        time: dt.isValid ? dt.toFormat("h:mm a") : "",
        relative,
        daysUntil: diffDays,
    };
}

/** Exported so the detail page's real-data path (GET /public/events/:id) can normalize with the same logic. */
export function toEventItem(evt: ApiEvent): EventItem {
    const { date, time, relative, daysUntil } = formatEventWhen(evt.startDate, evt.startTime);
    const location = evt.mode === "Online" ? evt.digitalLink || "Virtual event" : evt.location || "Location TBA";
    const host =
        evt.hostType === "community" && evt.communityName
            ? evt.communityName
            : evt.customHostName || "Community event";
    return {
        id: evt.id,
        slug: evt.slug || evt.id,
        title: evt.title,
        date,
        time,
        relative,
        daysUntil,
        mode: evt.mode,
        location,
        city: evt.mode !== "Online" ? evt.city : undefined,
        category: evt.category || "Community",
        isPaid: Boolean(evt.isPaid),
        host,
        attendees: evt.attendees || 0,
        description: evt.description,
    };
}

const BEYOND_LINKS = [
    { to: LAB_ROUTES.jobs, title: "Job board", blurb: "11k+ live internships & new-grad roles, updated daily." },
    { to: LAB_ROUTES.communities, title: "Communities", blurb: "Student groups building in your field." },
    { to: LAB_ROUTES.spotlight, title: "Spotlight", blurb: "Real stories from students who landed the role." },
];

const MODE_FILTERS: { label: string; value: "all" | Mode }[] = [
    { label: "All", value: "all" },
    { label: "Online", value: "Online" },
    { label: "In Person", value: "In Person" },
    { label: "Hybrid", value: "Hybrid" },
];

/** One card in the events grid — rounded-2xl white card, cycling accent border, matches the fresh-drops job grid. */
function EventTile({ event, accent }: { event: EventItem; accent: string }) {
    return (
        <Link
            to={LAB_ROUTES.eventDetail(event.id)}
            className={`flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${accent}`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="joy-mono text-xs font-bold uppercase tracking-wide text-joy-grass">
                    {event.relative}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${modeChipClass(event.mode)}`}>
                    {event.mode}
                </span>
            </div>
            <p className="joy-display mt-2 line-clamp-2 text-base font-bold text-joy-ink">{event.title}</p>
            <p className="joy-mono mt-1 text-xs text-joy-ink-muted">
                {event.date} · {event.time}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-joy-ink/50">
                <ModeIcon mode={event.mode} className="h-3.5 w-3.5 shrink-0" />
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

export default function PlaygroundEventsPage() {
    const [events, setEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(true);
    // True once we've fallen back to MOCK_EVENTS (fetch failed, or succeeded with zero events) —
    // drives the "Showing sample events" banner so this never reads as real production data.
    const [usingSampleEvents, setUsingSampleEvents] = useState(false);
    const [modeFilter, setModeFilter] = useState<"all" | Mode>("all");
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [cityFilter, setCityFilter] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await apiFetch("/public/events?upcoming=true&limit=50");
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Failed to fetch events");
                const raw: ApiEvent[] = Array.isArray(data.events) ? data.events : [];
                if (cancelled) return;
                if (raw.length > 0) {
                    setEvents(raw.map(toEventItem));
                    setUsingSampleEvents(false);
                } else {
                    // Real endpoint reached but genuinely empty — fall back to sample data
                    // instead of showing an empty grid.
                    setEvents(GRID_MOCK_EVENTS);
                    setUsingSampleEvents(true);
                }
            } catch (error) {
                console.error("playground-events: failed to load /public/events, showing sample events", error);
                if (!cancelled) {
                    setEvents(GRID_MOCK_EVENTS);
                    setUsingSampleEvents(true);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const categories = useMemo(() => {
        const counts: Record<string, number> = {};
        events.forEach((e) => {
            counts[e.category] = (counts[e.category] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, count]) => ({ name, count }));
    }, [events]);

    const cities = useMemo(() => {
        const counts: Record<string, number> = {};
        events.forEach((e) => {
            if (e.city) counts[e.city] = (counts[e.city] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, count]) => ({ name, count }));
    }, [events]);

    const filteredEvents = useMemo(() => {
        return events.filter((e) => {
            if (modeFilter !== "all" && e.mode !== modeFilter) return false;
            if (categoryFilter && e.category !== categoryFilter) return false;
            if (cityFilter && e.city !== cityFilter) return false;
            return true;
        });
    }, [events, modeFilter, categoryFilter, cityFilter]);

    const hasFilters = modeFilter !== "all" || categoryFilter !== null || cityFilter !== null;
    const featured = !hasFilters && filteredEvents.length > 0 ? filteredEvents[0] : null;
    const gridEvents = featured ? filteredEvents.slice(1) : filteredEvents;

    function clearFilters() {
        setModeFilter("all");
        setCategoryFilter(null);
        setCityFilter(null);
    }

    return (
        <PlaygroundShell
            routes={LAB_ROUTES}
            showSwitcher
            activeNav="events"
            cta={{ label: "Get alerts", to: LAB_ROUTES.signUp }}
        >
            {/* ---------------- Hero ---------------- */}
            <section className="relative overflow-hidden px-5 pb-10 pt-12 md:pt-16">
                <div className="relative mx-auto max-w-6xl">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 shadow-sm">
                            <Sparkles className="h-3.5 w-3.5 text-joy-grass" aria-hidden="true" />
                            <span className="text-xs font-bold text-joy-ink-muted">
                                Free student events, curated by the community
                            </span>
                        </div>
                        <h1 className="joy-display mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-joy-ink sm:text-5xl md:text-6xl">
                            Show up somewhere.
                            <br />
                            <span className="text-joy-grass">Meet your people.</span>
                        </h1>
                        <p className="mt-5 max-w-xl text-lg text-joy-ink-muted">
                            Hackathons, workshops, and career mixers hosted by student communities near you — and
                            online for everyone else. No corporate mixers, no ticket upsells.
                        </p>

                        {!loading && events.length > 0 && (
                            <div className="mt-6 flex items-center gap-2">
                                <span className="joy-pulse-dot h-2 w-2 rounded-full bg-joy-grass-bright" aria-hidden="true" />
                                <span className="joy-mono text-xs text-joy-ink-muted">
                                    <span className="font-bold text-joy-grass">{events.length}</span> upcoming events
                                    on the board right now
                                </span>
                            </div>
                        )}

                        {/* ---------------- Filters ---------------- */}
                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <div className="inline-flex flex-wrap rounded-lg bg-joy-ink/5 p-1">
                                {MODE_FILTERS.map((f) => (
                                    <button
                                        key={f.value}
                                        type="button"
                                        onClick={() => setModeFilter(f.value)}
                                        className={`rounded-md px-3.5 py-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${
                                            modeFilter === f.value ? "bg-white text-joy-ink shadow-sm" : "text-joy-ink-muted"
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {categories.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                {categories.map((c) => (
                                    <button
                                        key={c.name}
                                        type="button"
                                        onClick={() => {
                                            setCityFilter(null);
                                            setCategoryFilter(categoryFilter === c.name ? null : c.name);
                                        }}
                                        className={`rounded-full border px-3 py-1 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${
                                            categoryFilter === c.name
                                                ? "border-joy-grass/40 bg-joy-grass/10 text-joy-grass"
                                                : "border-joy-ink/10 text-joy-ink-muted hover:border-joy-ink/25"
                                        }`}
                                    >
                                        {c.name}
                                        <span className="joy-mono ml-1 opacity-60">{c.count}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {cities.length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-joy-ink/35">
                                    <MapPin className="h-3 w-3" aria-hidden="true" />
                                    Cities
                                </span>
                                {cities.map((c) => (
                                    <button
                                        key={c.name}
                                        type="button"
                                        onClick={() => {
                                            setCategoryFilter(null);
                                            setCityFilter(cityFilter === c.name ? null : c.name);
                                        }}
                                        className={`rounded-full border px-3 py-1 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${
                                            cityFilter === c.name
                                                ? "border-joy-sky/50 bg-joy-sky/12 text-joy-sky-ink"
                                                : "border-joy-ink/10 text-joy-ink-muted hover:border-joy-ink/25"
                                        }`}
                                    >
                                        {c.name}
                                        <span className="joy-mono ml-1 opacity-60">{c.count}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {hasFilters && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="mt-3 rounded text-xs font-bold text-joy-grass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Sample-data banner ---------------- */}
            {!loading && usingSampleEvents && (
                <section className="px-5 pb-4">
                    <div className="mx-auto max-w-6xl">
                        <div className="flex items-center gap-2 rounded-full border border-joy-sky/30 bg-joy-sky/10 px-4 py-2 text-xs font-bold text-joy-sky-ink">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            Showing sample events — live data unavailable
                        </div>
                    </div>
                </section>
            )}

            {/* ---------------- Featured event ---------------- */}
            {loading ? (
                <section className="px-5 pb-4">
                    <div className="mx-auto max-w-6xl">
                        <div className="h-40 animate-pulse rounded-2xl border-2 border-joy-ink/8 bg-white" />
                    </div>
                </section>
            ) : featured ? (
                <section className="px-5 pb-4">
                    <div className="mx-auto max-w-6xl">
                        <p className="joy-mono text-xs font-bold uppercase tracking-wide text-joy-grass">Up next</p>
                        <Link
                            to={LAB_ROUTES.eventDetail(featured.id)}
                            className={`joy-swap mt-2 flex flex-col gap-5 rounded-2xl border-2 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 sm:flex-row sm:items-center sm:justify-between ${FRESH_ACCENTS[0]}`}
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="flex items-center gap-1.5 text-sm font-bold text-joy-ink-muted">
                                        <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                        {featured.date} · {featured.time}
                                    </span>
                                    {featured.daysUntil > 0 && featured.daysUntil <= 30 && (
                                        <span className="rounded-full bg-joy-sun/25 px-2.5 py-0.5 text-[11px] font-bold text-joy-sun-ink">
                                            {featured.relative}
                                        </span>
                                    )}
                                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${modeChipClass(featured.mode)}`}>
                                        {featured.mode}
                                    </span>
                                    {!featured.isPaid && (
                                        <span className="rounded-full bg-joy-grass-bright/15 px-2.5 py-0.5 text-[11px] font-bold text-joy-grass">
                                            Free
                                        </span>
                                    )}
                                </div>
                                <h2 className="joy-display mt-2 text-2xl font-extrabold text-joy-ink">
                                    {featured.title}
                                </h2>
                                <p className="mt-1 flex items-center gap-1.5 text-sm text-joy-ink-muted">
                                    <ModeIcon mode={featured.mode} className="h-4 w-4 shrink-0" />
                                    {featured.location}
                                </p>
                                <p className="joy-mono mt-2 text-xs text-joy-ink/40">Hosted by {featured.host}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-4">
                                <div className="flex items-center gap-1.5 text-sm text-joy-ink-muted">
                                    <Users className="h-4 w-4" aria-hidden="true" />
                                    {featured.attendees} going
                                </div>
                                <PlaygroundButton className="!px-4 !py-2.5">Save your spot</PlaygroundButton>
                            </div>
                        </Link>
                    </div>
                </section>
            ) : null}

            {/* ---------------- Events grid ---------------- */}
            <section className="px-5 py-10">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="joy-mono text-xs font-bold uppercase tracking-wide text-joy-grass">
                                {hasFilters ? "Filtered" : "All events"}
                            </p>
                            <h2 className="joy-display mt-1 text-3xl font-extrabold text-joy-ink">
                                {hasFilters ? `${filteredEvents.length} match${filteredEvents.length === 1 ? "" : "es"}` : "What's coming up"}
                            </h2>
                        </div>
                    </div>

                    <div className="joy-swap mt-8">
                        {loading ? (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-40 animate-pulse rounded-2xl border border-joy-ink/8 bg-white" />
                                ))}
                            </div>
                        ) : filteredEvents.length === 0 ? (
                            <div className="rounded-2xl border border-joy-ink/8 bg-white p-8 text-center shadow-sm">
                                <p className="text-sm text-joy-ink-muted">
                                    {events.length === 0
                                        ? "The calendar's quiet right now — check back soon, or go browse the job board while you wait."
                                        : "No events match those filters yet."}
                                </p>
                                {events.length === 0 ? (
                                    <PlaygroundButton to={LAB_ROUTES.jobs} variant="outline" className="mt-4">
                                        Browse jobs instead
                                    </PlaygroundButton>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="mt-4 rounded text-sm font-bold text-joy-grass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {gridEvents.map((event, i) => (
                                    <EventTile key={event.id} event={event} accent={FRESH_ACCENTS[i % FRESH_ACCENTS.length]} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Beyond events ---------------- */}
            <section className="border-t border-joy-ink/8 px-5 py-14">
                <div className="mx-auto max-w-5xl">
                    <h2 className="joy-display text-2xl font-extrabold text-joy-ink">Beyond the event calendar</h2>
                    <div className="mt-6 grid gap-6 sm:grid-cols-3">
                        {BEYOND_LINKS.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                            >
                                <p className="joy-display text-base font-bold text-joy-ink">
                                    {item.title}{" "}
                                    <ArrowRight
                                        className="inline-block h-4 w-4 text-joy-ink/30 transition group-hover:translate-x-0.5 group-hover:text-joy-grass"
                                        aria-hidden="true"
                                    />
                                </p>
                                <p className="mt-1 text-sm text-joy-ink-muted">{item.blurb}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </PlaygroundShell>
    );
}
