import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bell, Briefcase, UserRoundCog } from "lucide-react";
import { Seo } from "@/components/seo";
import { PreloadLink } from "@/components/preload-link";
import { apiFetch } from "@/lib/fetch";
import { useAuth } from "@/hooks/use-auth";
import { useProfileSummary } from "@/hooks/use-profile-summary";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import { AccountOnboardingCard } from "@/components/account/account-onboarding-card";

/**
 * `/me` — "Your space" hub (Slice 1). A single calm, cream-surfaced home base
 * for signed-in users, replacing the old sidebar dashboard concept. Renders
 * inside the joy top-bar shell (no sidebar), mirroring the alerts/survey pages.
 *
 * Composes existing outputs — `useProfileSummary` (Slice 0) for name/score/
 * alert count, the shared `AccountOnboardingCard`, and a light-weight applied-
 * jobs count from the same `/job/applied-jobs` endpoint the applied page uses.
 */

/** Small joy summary card: icon, value, label, and a link CTA. */
function SummaryCard({
    icon,
    value,
    label,
    to,
    cta,
}: {
    icon: ReactNode;
    value: ReactNode;
    label: string;
    to: string;
    cta: string;
}) {
    return (
        <div className="flex flex-col rounded-2xl border border-joy-ink/8 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-joy-grass">{icon}</div>
            <p className="joy-display mt-3 text-3xl font-extrabold leading-none text-joy-ink">{value}</p>
            <p className="mt-1 text-sm text-joy-ink-muted">{label}</p>
            <PreloadLink
                to={to}
                className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-joy-grass transition hover:gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
            >
                {cta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </PreloadLink>
        </div>
    );
}

export default function YourSpacePage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { loading, score, alertCount, profile } = useProfileSummary();

    // Light-weight applications count — reuses the same `/job/applied-jobs`
    // endpoint the applied-jobs page uses, but only reads the ID list length
    // (no per-job detail fetches). Best-effort: on any failure we show no count
    // and just link out.
    const [appliedCount, setAppliedCount] = useState<number | null>(null);
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        apiFetch("/job/applied-jobs")
            .then(async (res) => {
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setAppliedCount(Array.isArray(data) ? data.length : 0);
            })
            .catch(() => {
                /* best-effort; leave count hidden */
            });
        return () => {
            cancelled = true;
        };
    }, [user]);

    const firstName =
        profile?.firstName?.trim() ||
        user?.displayName?.trim()?.split(" ")[0] ||
        "friend";

    return (
        <div style={{ colorScheme: "light" }}>
            <Seo title="Your space" description="Your home base on Tailed — profile, alerts, and applications." noSuffix={false} />
            <PlaygroundShell routes={LIVE_ROUTES} showSwitcher={false}>
                <section className="px-5 pb-6 pt-10 md:pt-12">
                    <div className="mx-auto max-w-3xl">
                        <h1 className="joy-display text-3xl font-extrabold leading-[1.08] tracking-tight text-joy-ink sm:text-4xl">
                            Welcome back, {firstName} 👋
                        </h1>
                        <p className="mt-3 max-w-2xl text-base text-joy-ink-muted">
                            Your calm home base. Pick up where you left off, keep your profile fresh, and see what we&apos;re
                            watching for you.
                        </p>
                    </div>
                </section>

                <section className="px-5 pb-16">
                    <div className="mx-auto max-w-3xl space-y-6">
                        {/* Onboarding progress — rendered as-is once the profile loads. */}
                        {profile && (
                            <AccountOnboardingCard
                                profile={profile}
                                onGoToTab={() => navigate(LIVE_ROUTES.account)}
                            />
                        )}

                        {/* Summary cards. */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <SummaryCard
                                icon={<UserRoundCog className="h-5 w-5" aria-hidden="true" />}
                                value={loading ? "—" : `${score}%`}
                                label="Profile complete"
                                to={LIVE_ROUTES.account}
                                cta="Complete your profile"
                            />
                            <SummaryCard
                                icon={<Bell className="h-5 w-5" aria-hidden="true" />}
                                value={loading ? "—" : alertCount}
                                label={alertCount === 1 ? "Job alert" : "Job alerts"}
                                to={LIVE_ROUTES.alerts}
                                cta="Manage alerts"
                            />
                            <SummaryCard
                                icon={<Briefcase className="h-5 w-5" aria-hidden="true" />}
                                value={appliedCount ?? "—"}
                                label={appliedCount === 1 ? "Application" : "Applications"}
                                to={LIVE_ROUTES.applications}
                                cta="View applications"
                            />
                        </div>

                        {/* Gentle nudge to keep exploring. */}
                        <div className="rounded-2xl border border-joy-ink/8 bg-joy-surface p-6 text-center shadow-sm">
                            <p className="joy-display text-lg font-extrabold text-joy-ink">Looking for something new?</p>
                            <p className="mx-auto mt-1 max-w-md text-sm text-joy-ink-muted">
                                Fresh internships and new-grad roles land every day. Browse the board or set an alert so we
                                bring them to you.
                            </p>
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                                <PlaygroundButton to={LIVE_ROUTES.jobs}>Browse jobs</PlaygroundButton>
                                <PlaygroundButton to={LIVE_ROUTES.alertBuilder} variant="outline">
                                    Set an alert
                                </PlaygroundButton>
                            </div>
                        </div>
                    </div>
                </section>
            </PlaygroundShell>
        </div>
    );
}
