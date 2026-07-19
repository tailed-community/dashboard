import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DateTime } from "luxon";
import { ArrowLeft, CalendarDays, ExternalLink, Sparkles, Users } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { toEventItem, type ApiEvent, type EventItem } from "@/pages/design-lab/playground-events";
import { getMockEventById, type MockEventItem } from "@/pages/design-lab/playground-events-mock";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import { ModeIcon, modeChipClass, type EventMode } from "@/components/playground/joy-primitives";
import { Seo } from "@/components/seo";
import { trackEvent } from "@/lib/analytics";

const SITE_URL = "https://community.tailed.ca";

/** Either a real event (normalized via `toEventItem`) or a mock one (dev only) — whichever this page ends up rendering. */
type DetailEvent = EventItem | MockEventItem;

/**
 * `GET /public/events/:identifier` spreads the raw Firestore doc, so fields
 * `ApiEvent` doesn't bother declaring (it's typed loosely on purpose — see
 * playground-events.tsx) are still present on the wire. We only need these
 * two, both used to decide the real register/RSVP CTA below.
 */
type PublicApiEvent = ApiEvent & {
    requiresApproval?: boolean;
    registrationLink?: string;
};

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

/** Cheap plain-text fallback for the Seo description meta — descriptions can carry stray markup from the rich-text editor. */
function stripAndTruncate(text: string, max = 160): string {
    const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return "Student community event on Tail'ed.";
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export default function EventDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<DetailEvent | null>(null);
    // Raw fetch response for real events only — carries fields (requiresApproval,
    // registrationLink, startDate/startTime) that `toEventItem` doesn't preserve
    // but the register CTA below needs. Never populated for mock events, which
    // is exactly what gates the CTA to "real events only".
    const [rawEvent, setRawEvent] = useState<PublicApiEvent | null>(null);
    const [source, setSource] = useState<"real" | "mock" | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (!id) {
            setNotFound(true);
            setLoading(false);
            return;
        }
        (async () => {
            try {
                // Public single-event endpoint — accepts an id or a slug, matching
                // however the list page or an external link points here.
                const res = await apiFetch(`/public/events/${id}`);
                const data = await res.json();
                if (!res.ok || !data?.event) throw new Error(data?.error || "Event not found");
                if (!cancelled) {
                    const apiEvent = data.event as PublicApiEvent;
                    setEvent(toEventItem(apiEvent));
                    setRawEvent(apiEvent);
                    setSource("real");
                    trackEvent("event_view", { eventId: apiEvent.id });
                }
            } catch (error) {
                console.error(`events/${id}: real fetch failed`, error);
                if (cancelled) return;
                // DEV ONLY: fall back to sample data so the page previews populated
                // without a live backend. Production shows the real "not found"
                // empty state instead of a fabricated event.
                const mock = import.meta.env.DEV ? getMockEventById(id) : undefined;
                if (mock) {
                    setEvent(mock);
                    setRawEvent(null);
                    setSource("mock");
                } else {
                    setNotFound(true);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const shellProps: { routes: typeof LIVE_ROUTES; showSwitcher: boolean; activeNav: null; cta: { label: string; to: string } } = {
        routes: LIVE_ROUTES,
        showSwitcher: false,
        activeNav: null,
        cta: { label: "Get alerts", to: LIVE_ROUTES.signUp },
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
                <Seo
                    title="Event not found"
                    description="This event may have wrapped up, moved, or the link is out of date."
                    noSuffix={false}
                />
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
                        <PlaygroundButton to={LIVE_ROUTES.events} className="mt-6">
                            Back to all events
                        </PlaygroundButton>
                    </div>
                </section>
            </PlaygroundShell>
        );
    }

    // Real-event-only extras the register CTA needs; undefined for mock/sample events.
    const isPastEvent = rawEvent
        ? DateTime.fromISO(`${rawEvent.startDate}T${rawEvent.startTime}`) < DateTime.now()
        : false;

    function handleRegisterClick() {
        if (!rawEvent) return;
        if (!rawEvent.requiresApproval && rawEvent.registrationLink) {
            window.open(rawEvent.registrationLink, "_blank", "noreferrer");
            return;
        }
        trackEvent("event_rsvp_started", { eventId: rawEvent.id });
        navigate(`/events/${id}/register`);
    }

    const canonicalPath = `/events/${id}`;
    const seoDescription = stripAndTruncate(toParagraphs(event).join(" "));
    const startIso = rawEvent ? `${rawEvent.startDate}T${rawEvent.startTime}` : undefined;
    const eventJsonLd =
        source === "real" && rawEvent
            ? {
                  "@context": "https://schema.org",
                  "@type": "Event",
                  name: event.title,
                  ...(startIso ? { startDate: startIso } : {}),
                  eventAttendanceMode:
                      event.mode === "Online"
                          ? "https://schema.org/OnlineEventAttendanceMode"
                          : event.mode === "Hybrid"
                            ? "https://schema.org/MixedEventAttendanceMode"
                            : "https://schema.org/OfflineEventAttendanceMode",
                  location:
                      event.mode === "Online"
                          ? { "@type": "VirtualLocation", url: `${SITE_URL}${canonicalPath}` }
                          : { "@type": "Place", name: event.location, ...(event.city ? { address: event.city } : {}) },
                  description: seoDescription,
                  organizer: { "@type": "Organization", name: event.host },
              }
            : undefined;

    return (
        <PlaygroundShell {...shellProps}>
            <Seo title={event.title} description={seoDescription} path={canonicalPath} jsonLd={eventJsonLd} />

            <section className="px-5 py-10 md:py-14">
                <div className="mx-auto max-w-3xl">
                    <Link
                        to={LIVE_ROUTES.events}
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
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${modeChipClass(event.mode as EventMode)}`}>
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
                            <ModeIcon mode={event.mode as EventMode} className="h-4 w-4 shrink-0" />
                            {event.location}
                        </span>
                        <span className="joy-mono text-xs text-joy-ink/40">Hosted by {event.host}</span>
                        <div className="mt-1 flex items-center gap-1.5 border-t border-joy-ink/8 pt-3 text-sm text-joy-ink-muted">
                            <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {event.attendees.toLocaleString("en-US")} going
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-joy-ink/8 bg-white p-5 shadow-sm sm:p-6">
                        {source === "mock" ? (
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="joy-display text-lg font-bold text-joy-ink">Sample event</p>
                                    <p className="text-sm text-joy-ink-muted">
                                        RSVP isn&apos;t available for sample data — this only shows up when live
                                        events can&apos;t be reached.
                                    </p>
                                </div>
                                <PlaygroundButton className="shrink-0" variant="outline" onClick={undefined}>
                                    RSVP unavailable
                                </PlaygroundButton>
                            </div>
                        ) : isPastEvent ? (
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="joy-display text-lg font-bold text-joy-ink">This one&apos;s wrapped up</p>
                                    <p className="text-sm text-joy-ink-muted">Check the events board for what&apos;s next.</p>
                                </div>
                                <PlaygroundButton to={LIVE_ROUTES.events} variant="outline" className="shrink-0">
                                    Browse events
                                </PlaygroundButton>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="joy-display text-lg font-bold text-joy-ink">Ready to join?</p>
                                    <p className="text-sm text-joy-ink-muted">
                                        {rawEvent?.requiresApproval
                                            ? "Requests are reviewed by the organizer before you're confirmed."
                                            : "Takes two minutes to save your spot."}
                                    </p>
                                </div>
                                <PlaygroundButton onClick={handleRegisterClick} className="shrink-0">
                                    {rawEvent?.requiresApproval ? (
                                        "Request to join"
                                    ) : rawEvent?.registrationLink ? (
                                        <>
                                            Register now
                                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                        </>
                                    ) : (
                                        "Save your spot"
                                    )}
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
