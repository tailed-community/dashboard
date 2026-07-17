import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ArrowLeft, Calendar, ExternalLink, GraduationCap, MapPin } from "lucide-react";
import { Github } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { useAllJobs, LabSwitcher } from "@/pages/design-lab/lab-shared";
import { formatPostedLabel } from "@/lib/external-jobs";
import type { ExternalJob } from "@/types/jobs";

function jobTypeChipLabel(type: "internship" | "new-grad"): string {
    return type === "internship" ? "Internship" : "New grad";
}

/** Tint chips checked against white/cream: #2E7D02 ~5:1, #0A6FA8 ~5.4:1. */
function jobTypeChipClass(type: "internship" | "new-grad"): string {
    return type === "internship" ? "bg-[#2E7D02]/10 text-[#2E7D02]" : "bg-[#1CB0F6]/12 text-[#0A6FA8]";
}

/** Neutral outline chip for secondary metadata (category / term / degree). */
const NEUTRAL_CHIP_CLASS =
    "inline-flex items-center gap-1 rounded-full border border-[#2B2118]/12 px-2.5 py-0.5 text-xs font-bold text-[#6B5D4F]";

/** Chunky, joyful button: rounded, green primary with a pressed bottom-shadow edge. */
function Button({
    children,
    to,
    href,
    variant = "primary",
    className = "",
    onClick,
    type = "button",
}: {
    children: React.ReactNode;
    to?: string;
    href?: string;
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
    if (href) {
        return (
            <a href={href} target="_blank" rel="noreferrer" className={cls}>
                {children}
            </a>
        );
    }
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

/** Same nav as the other Playground pages, but nothing is marked active — this is a detail page, not a listing. */
const NAV_LINKS = [
    { label: "Jobs", to: "/design-lab/playground/jobs" },
    { label: "Events", to: "/design-lab/playground/events" },
    { label: "Communities", to: "/design-lab/playground/communities" },
    { label: "Spotlight", to: "/spotlight" },
];

const JOY_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');
    .joy-display { font-family: 'Baloo 2', ui-rounded, system-ui, sans-serif; }
    .joy-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }

    @keyframes joyPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
    }
    .joy-pulse-dot { animation: joyPulse 2s ease-in-out infinite; }

    @keyframes joySwapIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .joy-swap { animation: joySwapIn 0.32s ease both; }

    @media (prefers-reduced-motion: reduce) {
        .joy-pulse-dot, .joy-swap { animation: none; }
    }
`;

/** Shared shell: header + font styles + footer + LabSwitcher, wrapping whichever body state (loading/not-found/found) is active. */
function PlaygroundShell({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            className="min-h-screen w-full overflow-x-hidden bg-[#FFFBF0] text-[#2B2118]"
            style={{ fontFamily: "'Nunito', ui-sans-serif, system-ui, sans-serif" }}
        >
            <style>{JOY_STYLE}</style>

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
                        <Button to="/design-lab/playground/jobs#alert-builder" className="!px-4 !py-2 !text-xs">
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
                            className="inline-flex items-center gap-2 rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            <Github className="h-4 w-4" aria-hidden="true" />
                            GitHub
                        </a>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            <SiDiscord className="h-4 w-4" aria-hidden="true" />
                            Discord
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

function DetailSkeleton() {
    return (
        <section className="px-5 py-10">
            <div className="mx-auto max-w-3xl">
                <div className="h-4 w-32 animate-pulse rounded-full bg-[#2B2118]/8" />
                <div className="mt-6 rounded-2xl border border-[#2B2118]/8 bg-white p-6 shadow-sm sm:p-8">
                    <div className="h-3 w-24 animate-pulse rounded-full bg-[#2B2118]/8" />
                    <div className="mt-4 h-8 w-2/3 animate-pulse rounded-lg bg-[#2B2118]/8" />
                    <div className="mt-3 flex gap-2">
                        <div className="h-5 w-20 animate-pulse rounded-full bg-[#2B2118]/8" />
                        <div className="h-5 w-28 animate-pulse rounded-full bg-[#2B2118]/8" />
                    </div>
                    <div className="mt-6 h-10 w-40 animate-pulse rounded-xl bg-[#2B2118]/8" />
                </div>
            </div>
        </section>
    );
}

function NotFoundState() {
    return (
        <section className="px-5 py-16">
            <div className="mx-auto max-w-xl text-center">
                <p className="joy-display text-2xl font-extrabold text-[#2B2118]">
                    Hmm, we can&apos;t find that role
                </p>
                <p className="mt-2 text-sm text-[#6B5D4F]">
                    It may have been filled, pulled by the employer, or the link is off. The rest of the board is
                    still very much alive.
                </p>
                <Button to="/design-lab/playground/jobs" className="mt-6">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to the job board
                </Button>
            </div>
        </section>
    );
}

function JobDetailBody({ job }: { job: ExternalJob }) {
    const locationSummary = job.locations.length > 0 ? job.locations.join(" · ") : "Remote / Unlisted";
    const postedLabel = formatPostedLabel(job);

    return (
        <>
            <section className="px-5 pb-4 pt-8">
                <div className="mx-auto max-w-3xl">
                    <Link
                        to="/design-lab/playground/jobs"
                        className="inline-flex items-center gap-1.5 rounded text-sm font-bold text-[#6B5D4F] hover:text-[#2E7D02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Back to the job board
                    </Link>
                </div>
            </section>

            <section className="joy-swap px-5 pb-8">
                <div className="mx-auto max-w-3xl">
                    <div className="rounded-2xl border border-[#2B2118]/8 bg-white p-6 shadow-sm sm:p-8">
                        <p className="text-sm font-semibold text-[#6B5D4F]">{job.company_name}</p>
                        <h1 className="joy-display mt-1 text-3xl font-extrabold leading-[1.1] text-[#2B2118] sm:text-4xl">
                            {job.title}
                        </h1>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${jobTypeChipClass(job.type)}`}>
                                {jobTypeChipLabel(job.type)}
                            </span>
                            {job.category && <span className={NEUTRAL_CHIP_CLASS}>{job.category}</span>}
                            {job.terms?.map((term) => (
                                <span key={term} className={NEUTRAL_CHIP_CLASS}>
                                    <Calendar className="h-3 w-3" aria-hidden="true" />
                                    {term}
                                </span>
                            ))}
                            {job.degrees?.map((degree) => (
                                <span key={degree} className={NEUTRAL_CHIP_CLASS}>
                                    <GraduationCap className="h-3 w-3" aria-hidden="true" />
                                    {degree}
                                </span>
                            ))}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#6B5D4F]">
                            <span className="flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 text-[#2B2118]/35" aria-hidden="true" />
                                {locationSummary}
                            </span>
                            <span className="joy-mono flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-[#2B2118]/35" aria-hidden="true" />
                                {postedLabel}
                            </span>
                        </div>

                        <p className="mt-6 text-sm leading-relaxed text-[#6B5D4F]">
                            This listing is posted on {job.company_name}&apos;s own careers site. Tail&apos;ed
                            surfaces it as part of our free job board for students — applying happens on the
                            employer&apos;s site.
                        </p>

                        <div className="mt-6">
                            <Button href={job.url} className="w-full sm:w-auto">
                                Apply now
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </div>
                    </div>

                    {/* ---------------- Alerts CTA ---------------- */}
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-[#2E7D02]/30 bg-[#58CC02]/8 px-4 py-4 sm:px-6">
                        <div>
                            <p className="joy-display text-base font-bold text-[#2B2118]">
                                Get alerts for roles like this
                            </p>
                            <p className="mt-0.5 text-sm text-[#6B5D4F]">
                                We&apos;ll email you the moment similar {jobTypeChipLabel(job.type).toLowerCase()} roles
                                drop. Nothing else, ever.
                            </p>
                        </div>
                        <Button to="/design-lab/playground/jobs#alert-builder" variant="outline" className="shrink-0">
                            Set up alerts
                        </Button>
                    </div>
                </div>
            </section>
        </>
    );
}

export default function PlaygroundJobDetailPage() {
    const { id: rawId } = useParams<{ id: string }>();
    const id = rawId ? decodeURIComponent(rawId) : "";
    const { all, loading } = useAllJobs();

    const job = useMemo(() => all.find((candidate) => candidate.id === id) ?? null, [all, id]);

    return (
        <PlaygroundShell>
            {loading ? <DetailSkeleton /> : job ? <JobDetailBody job={job} /> : <NotFoundState />}
        </PlaygroundShell>
    );
}
