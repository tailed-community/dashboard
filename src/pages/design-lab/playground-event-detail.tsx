import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    Github,
    Globe2,
    MapPin,
    Monitor,
    Sparkles,
    Users,
} from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { LabSwitcher } from "@/pages/design-lab/lab-shared";
import { apiFetch } from "@/lib/fetch";
import { toEventItem, type ApiEvent, type EventItem, type Mode } from "@/pages/design-lab/playground-events";
import { getMockEventById, type MockEventItem } from "@/pages/design-lab/playground-events-mock";

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

/** Chunky, joyful button: rounded, green primary with a pressed bottom-shadow edge. (Ported from playground.tsx — each lab variant keeps its own copy.) */
function Button({
    children,
    to,
    variant = "primary",
    className = "",
    onClick,
    type = "button",
}: {
    children: React.ReactNode;
    to?: string;
    variant?: "primary" | "quiet" | "outline";
    className?: string;
    onClick?: () => void;
    type?: "button" | "submit";
}) {
    const base =
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60";
    const styles: Record<string, string> = {
        primary:
            "bg-[#2E7D02] text-white shadow-[0_3px_0_#1F5C01] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_#1F5C01]",
        outline:
            "border-2 border-[#2B2118]/12 bg-white text-[#2B2118] hover:border-[#2E7D02]/50 active:translate-y-px",
        quiet: "text-[#6B5D4F] hover:text-[#2B2118]",
    };
    const cls = `${base} ${styles[variant]} ${className}`;
    if (to) {
        return (
            <Link to={to} className={cls}>
                {children}
            </Link>
        );
    }
    return (
        <button type={type} onClick={onClick} className={cls}>
            {children}
        </button>
    );
}

const NAV_LINKS = [
    { label: "Jobs", to: "/design-lab/playground/jobs" },
    { label: "Events", to: "/design-lab/playground/events" },
    { label: "Communities", to: "/design-lab/playground/communities" },
    { label: "Spotlight", to: "/spotlight" },
];

/** Tint chips checked against white/cream, same formula as playground-events.tsx's mode chips. */
function modeChipClass(mode: Mode): string {
    if (mode === "Online") return "bg-[#1CB0F6]/12 text-[#0A6FA8]";
    if (mode === "Hybrid") return "bg-[#FFC800]/25 text-[#8A6200]";
    return "bg-[#2E7D02]/10 text-[#2E7D02]";
}

function ModeIcon({ mode, className }: { mode: Mode; className?: string }) {
    if (mode === "Online") return <Monitor className={className} aria-hidden="true" />;
    if (mode === "Hybrid") return <Globe2 className={className} aria-hidden="true" />;
    return <MapPin className={className} aria-hidden="true" />;
}

/** Shared page chrome (header, footer, LabSwitcher) so loading/not-found/found states all look like the rest of Playground. */
function PageShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="min-h-screen w-full overflow-x-hidden bg-[#FFFBF0] text-[#2B2118]"
            style={{ fontFamily: "'Nunito', ui-sans-serif, system-ui, sans-serif" }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');
                .joy-display { font-family: 'Baloo 2', ui-rounded, system-ui, sans-serif; }
                .joy-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }

                @keyframes joySwapIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .joy-swap { animation: joySwapIn 0.32s ease both; }

                @media (prefers-reduced-motion: reduce) {
                    .joy-swap { animation: none; }
                }
            `}</style>

            {/* ---------------- Header ---------------- */}
            <header className="sticky top-0 z-40 bg-gradient-to-b from-[#EAF6DC]/95 via-[#FFFBF0]/92 to-[#FFFBF0]/75 backdrop-blur-md">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
                    <Link
                        to="/"
                        className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                    >
                        <div className="flex items-center h-8 sm:h-9">
                            <AspectRatio ratio={3042 / 968} className="h-full w-auto">
                                <img
                                    src="/Tailed_Community_logo.png"
                                    alt="Tail'ed Community logo"
                                    className="object-contain h-full w-full"
                                />
                            </AspectRatio>
                        </div>
                    </Link>
                    <nav className="hidden items-center gap-1 md:flex">
                        {NAV_LINKS.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="rounded-lg px-3.5 py-2 text-sm font-bold text-[#6B5D4F] transition hover:bg-[#2B2118]/5 hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex items-center gap-3">
                        <Link
                            to="/sign-in"
                            className="hidden rounded text-sm font-bold text-[#6B5D4F] hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60 sm:inline-block"
                        >
                            Sign in
                        </Link>
                        <Button to="/sign-up" className="!px-4 !py-2 !text-xs">
                            Get alerts
                        </Button>
                    </div>
                </div>
            </header>

            {children}

            {/* ---------------- Footer ---------------- */}
            <footer className="border-t border-[#2B2118]/8 px-5 py-8">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
                    <div className="flex items-center gap-2 text-[#2B2118]">
                        <span className="joy-display text-sm font-bold">Tail&apos;ed</span>
                        <span className="text-xs text-[#2B2118]/40">· built by students, free forever</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[#6B5D4F]">
                        <a
                            href="https://github.com/tailed-community"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            <Github className="h-4 w-4" aria-hidden="true" />
                        </a>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            <SiDiscord className="h-4 w-4" aria-hidden="true" />
                        </a>
                        <Link
                            to="/sign-in"
                            className="rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            Sign in
                        </Link>
                    </div>
                </div>
            </footer>

            <LabSwitcher />
        </div>
    );
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

    if (loading) {
        return (
            <PageShell>
                <section className="px-5 py-14">
                    <div className="mx-auto max-w-3xl animate-pulse space-y-4">
                        <div className="h-4 w-24 rounded-full bg-[#2B2118]/8" />
                        <div className="h-10 w-3/4 rounded-xl bg-[#2B2118]/8" />
                        <div className="h-32 rounded-2xl border border-[#2B2118]/8 bg-white" />
                    </div>
                </section>
            </PageShell>
        );
    }

    if (notFound || !event) {
        return (
            <PageShell>
                <section className="px-5 py-20">
                    <div className="mx-auto max-w-lg text-center">
                        <p className="joy-mono text-xs font-bold uppercase tracking-wide text-[#2E7D02]">404</p>
                        <h1 className="joy-display mt-2 text-3xl font-extrabold text-[#2B2118]">
                            We can&apos;t find that event.
                        </h1>
                        <p className="mt-3 text-[#6B5D4F]">
                            It may have wrapped up, moved, or the link&apos;s just a little off. Head back and find
                            something else happening soon.
                        </p>
                        <Button to="/design-lab/playground/events" className="mt-6">
                            Back to all events
                        </Button>
                    </div>
                </section>
            </PageShell>
        );
    }

    return (
        <PageShell>
            <section className="px-5 py-10 md:py-14">
                <div className="mx-auto max-w-3xl">
                    <Link
                        to="/design-lab/playground/events"
                        className="inline-flex items-center gap-1.5 rounded text-sm font-bold text-[#2E7D02] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        All events
                    </Link>

                    {source === "mock" && (
                        <div className="mt-4 flex items-center gap-2 rounded-full border border-[#1CB0F6]/30 bg-[#1CB0F6]/10 px-4 py-2 text-xs font-bold text-[#0A6FA8]">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            Showing a sample event — live data unavailable
                        </div>
                    )}

                    <div className="joy-swap mt-6 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${modeChipClass(event.mode)}`}>
                            {event.mode}
                        </span>
                        <span className="rounded-full bg-[#2B2118]/5 px-2.5 py-0.5 text-[11px] font-bold text-[#6B5D4F]">
                            {event.category}
                        </span>
                        <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                event.isPaid ? "bg-[#FFC800]/25 text-[#8A6200]" : "bg-[#58CC02]/15 text-[#2E7D02]"
                            }`}
                        >
                            {priceLabel(event)}
                        </span>
                        {event.daysUntil > 0 && event.daysUntil <= 30 && (
                            <span className="joy-mono rounded-full bg-[#2B2118]/5 px-2.5 py-0.5 text-[11px] font-bold text-[#6B5D4F]">
                                {event.relative}
                            </span>
                        )}
                    </div>

                    <h1 className="joy-display mt-3 text-3xl font-extrabold leading-tight text-[#2B2118] sm:text-4xl">
                        {event.title}
                    </h1>

                    <div className="mt-5 flex flex-col gap-2.5 rounded-2xl border border-[#2B2118]/8 bg-white p-5 shadow-sm sm:p-6">
                        <span className="flex items-center gap-2 text-sm font-bold text-[#2B2118]">
                            <CalendarDays className="h-4 w-4 shrink-0 text-[#2E7D02]" aria-hidden="true" />
                            {event.date} · {event.time}
                        </span>
                        <span className="flex items-center gap-2 text-sm text-[#6B5D4F]">
                            <ModeIcon mode={event.mode} className="h-4 w-4 shrink-0" />
                            {event.location}
                        </span>
                        <span className="joy-mono text-xs text-[#2B2118]/40">Hosted by {event.host}</span>
                        <div className="mt-1 flex items-center gap-1.5 border-t border-[#2B2118]/8 pt-3 text-sm text-[#6B5D4F]">
                            <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {event.attendees.toLocaleString("en-US")} going
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-[#2B2118]/8 bg-white p-5 shadow-sm sm:p-6">
                        {rsvped ? (
                            <div className="flex flex-col items-center gap-2 py-2 text-center">
                                <CheckCircle2 className="h-8 w-8 text-[#2E7D02]" aria-hidden="true" />
                                <p className="joy-display text-lg font-bold text-[#2B2118]">You&apos;re in!</p>
                                <p className="text-sm text-[#6B5D4F]">
                                    We&apos;ve saved your spot for {event.title}. See you there.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setRsvped(false)}
                                    className="mt-1 rounded text-sm font-bold text-[#2E7D02] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                                >
                                    Undo
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="joy-display text-lg font-bold text-[#2B2118]">Ready to join?</p>
                                    <p className="text-sm text-[#6B5D4F]">Takes two seconds, no account needed to RSVP.</p>
                                </div>
                                <Button onClick={() => setRsvped(true)} className="shrink-0">
                                    Save your spot
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-[#2B2118]/80">
                        {toParagraphs(event).map((paragraph, i) => (
                            <p key={i}>{paragraph}</p>
                        ))}
                    </div>
                </div>
            </section>
        </PageShell>
    );
}
