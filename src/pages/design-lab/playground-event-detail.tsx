import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, Sparkles, Users } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { toEventItem, type ApiEvent, type EventItem, type Mode } from "@/pages/design-lab/playground-events";
import { getMockEventById, type MockEventItem } from "@/pages/design-lab/playground-events-mock";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LAB_ROUTES } from "@/components/playground/playground-routes";
import { ModeIcon, modeChipClass } from "@/components/playground/joy-primitives";

/** Either a real event (normalized via `toEventItem`) or a mock one — whichever this page ends up rendering. */
type DetailEvent = EventItem | MockEventItem;

function isMockEvent(event: DetailEvent): event is MockEventItem {
    return Array.isArray((event as MockEventItem).description);
}

/** Body paragraphs to render — mock events author these directly; real events split their free-text description. */
function toParagraphs(event: DetailEvent): string[] {
    if (isMockEvent(event)) return event.description;
    const desc = (event as EventItem).description;
    if (!desc || !desc.trim()) {
        return ["The host hasn't posted full details yet — check back soon, or reach out to the organizers directly."];
    }
    return desc
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
}

function priceLabel(event: DetailEvent): string {
    if (isMockEvent(event)) return event.priceLabel;
    return event.isPaid ? "Paid" : "Free";
}

export default function PlaygroundEventDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [event, setEvent] = useState<DetailEvent | null>(null);
    const [source, setSource] = useState<"real" | "mock" | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [rsvped, setRsvped] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (!id) {
            setNotFound(true);
            setLoading(false);
            return;
        }
        (async () => {
            try {
                // Real single-event endpoint exists (GET /public/events/:identifier — see
                // functions/src/routes/public.ts) so we try it first, same id/slug lookup
                // the production /events/:slug page uses.
                const res = await apiFetch(`/public/events/${id}`);
                const data = await res.json();
                if (!res.ok || !data?.event) throw new Error(data?.error || "Event not found");
                if (!cancelled) {
                    setEvent(toEventItem(data.event as ApiEvent));
                    setSource("real");
                }
            } catch (error) {
                console.error(`playground-event-detail: real fetch failed for "${id}", falling back to sample data`, error);
                const mock = getMockEventById(id);
                if (!cancelled) {
                    if (mock) {
                        setEvent(mock);
                        setSource("mock");
                    } else {
                        setNotFound(true);
                    }
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const shellProps = {
        routes: LAB_ROUTES,
        showSwitcher: true,
        activeNav: null,
        cta: { label: "Get alerts", to: LAB_ROUTES.signUp },
    };

    if (loading) {
        return (
            <PlaygroundShell {...shellProps}>
                <section className="px-5 py-14">
                    <div className="mx-auto max-w-3xl animate-pulse space-y-4">
                        <div className="h-4 w-24 rounded-full bg-joy-ink/8" />
                        <div className="h-10 w-3/4 rounded-xl bg-joy-ink/8" />
                        <div className="h-32 rounded-2xl border border-joy-ink/8 bg-white" />
                    </div>
                </section>
            </PlaygroundShell>
        );
    }

    if (notFound || !event) {
        return (
            <PlaygroundShell {...shellProps}>
                <section className="px-5 py-20">
                    <div className="mx-auto max-w-lg text-center">
                        <p className="joy-mono text-xs font-bold uppercase tracking-wide text-joy-grass">404</p>
                        <h1 className="joy-display mt-2 text-3xl font-extrabold text-joy-ink">
                            We can&apos;t find that event.
                        </h1>
                        <p className="mt-3 text-joy-ink-muted">
                            It may have wrapped up, moved, or the link&apos;s just a little off. Head back and find
                            something else happening soon.
                        </p>
                        <PlaygroundButton to={LAB_ROUTES.events} className="mt-6">
                            Back to all events
                        </PlaygroundButton>
                    </div>
                </section>
            </PlaygroundShell>
        );
    }

    return (
        <PlaygroundShell {...shellProps}>
            <section className="px-5 py-10 md:py-14">
                <div className="mx-auto max-w-3xl">
                    <Link
                        to={LAB_ROUTES.events}
                        className="inline-flex items-center gap-1.5 rounded text-sm font-bold text-joy-grass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        All events
                    </Link>

                    {source === "mock" && (
                        <div className="mt-4 flex items-center gap-2 rounded-full border border-joy-sky/30 bg-joy-sky/10 px-4 py-2 text-xs font-bold text-joy-sky-ink">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            Showing a sample event — live data unavailable
                        </div>
                    )}

                    <div className="joy-swap mt-6 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${modeChipClass(event.mode as Mode)}`}>
                            {event.mode}
                        </span>
                        <span className="rounded-full bg-joy-ink/5 px-2.5 py-0.5 text-[11px] font-bold text-joy-ink-muted">
                            {event.category}
                        </span>
                        <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                event.isPaid ? "bg-joy-sun/25 text-joy-sun-ink" : "bg-joy-grass-bright/15 text-joy-grass"
                            }`}
                        >
                            {priceLabel(event)}
                        </span>
                        {event.daysUntil > 0 && event.daysUntil <= 30 && (
                            <span className="joy-mono rounded-full bg-joy-ink/5 px-2.5 py-0.5 text-[11px] font-bold text-joy-ink-muted">
                                {event.relative}
                            </span>
                        )}
                    </div>

                    <h1 className="joy-display mt-3 text-3xl font-extrabold leading-tight text-joy-ink sm:text-4xl">
                        {event.title}
                    </h1>

                    <div className="mt-5 flex flex-col gap-2.5 rounded-2xl border border-joy-ink/8 bg-white p-5 shadow-sm sm:p-6">
                        <span className="flex items-center gap-2 text-sm font-bold text-joy-ink">
                            <CalendarDays className="h-4 w-4 shrink-0 text-joy-grass" aria-hidden="true" />
                            {event.date} · {event.time}
                        </span>
                        <span className="flex items-center gap-2 text-sm text-joy-ink-muted">
                            <ModeIcon mode={event.mode as Mode} className="h-4 w-4 shrink-0" />
                            {event.location}
                        </span>
                        <span className="joy-mono text-xs text-joy-ink/40">Hosted by {event.host}</span>
                        <div className="mt-1 flex items-center gap-1.5 border-t border-joy-ink/8 pt-3 text-sm text-joy-ink-muted">
                            <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {event.attendees.toLocaleString("en-US")} going
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-joy-ink/8 bg-white p-5 shadow-sm sm:p-6">
                        {rsvped ? (
                            <div className="flex flex-col items-center gap-2 py-2 text-center">
                                <CheckCircle2 className="h-8 w-8 text-joy-grass" aria-hidden="true" />
                                <p className="joy-display text-lg font-bold text-joy-ink">You&apos;re in!</p>
                                <p className="text-sm text-joy-ink-muted">
                                    We&apos;ve saved your spot for {event.title}. See you there.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setRsvped(false)}
                                    className="mt-1 rounded text-sm font-bold text-joy-grass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                >
                                    Undo
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="joy-display text-lg font-bold text-joy-ink">Ready to join?</p>
                                    <p className="text-sm text-joy-ink-muted">Takes two seconds, no account needed to RSVP.</p>
                                </div>
                                <PlaygroundButton onClick={() => setRsvped(true)} className="shrink-0">
                                    Save your spot
                                </PlaygroundButton>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-joy-ink/80">
                        {toParagraphs(event).map((paragraph, i) => (
                            <p key={i}>{paragraph}</p>
                        ))}
                    </div>
                </div>
            </section>
        </PlaygroundShell>
    );
}
