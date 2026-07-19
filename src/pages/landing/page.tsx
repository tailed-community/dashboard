import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle,
  Heart,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { Header } from "@/components/landing/header";
import { FreshJobsStrip } from "@/components/landing/fresh-jobs-strip";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SiDiscord, SiGithub, SiInstagram, SiYoutube } from "react-icons/si";
import { apiFetch } from "@/lib/fetch";
import { useAuth } from "@/hooks/use-auth";
import { getFileUrl } from "@/lib/firebase-client";
import type { ExternalJob } from "@/types/jobs";
import { Seo } from "@/components/seo";
import { fetchExternalJobs, activeExternalJobs } from "@/lib/external-jobs";
import { isFeaturableEvent, isFeaturableCommunity, pickFreshestJobs } from "@/lib/featured-content";
import { JobAlertSignup } from "@/components/capture/job-alert-signup";
import { DigestPrompt } from "@/components/capture/digest-prompt";
import { trackEvent } from "@/lib/analytics";

const FALLBACK_JOB_COUNT_LABEL = "Thousands of";

/** Rounds down to the nearest 100 and appends a "+", e.g. 11342 -> "11,300+". */
function roundedJobCountLabel(activeCount: number | null): string {
  if (activeCount === null) return FALLBACK_JOB_COUNT_LABEL;
  const rounded = Math.floor(activeCount / 100) * 100;
  return `${rounded.toLocaleString("en-US")}+`;
}

function formatMemberCount(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${count}`;
}

function formatEventDateTime(startDate: string, startTime?: string): string {
  const now = new Date();
  const eventDate = new Date(startDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const diffInDays = Math.floor((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = startTime
    ? ` • ${new Date(`2000-01-01T${startTime}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : "";

  if (diffInDays === 0) return `Today${timeStr}`;
  if (diffInDays === 1) return `Tomorrow${timeStr}`;
  return `${eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}${timeStr}`;
}

/** Resolves a Firebase Storage path to a downloadable URL; passes absolute URLs through unchanged. */
async function resolveStorageUrl(path?: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  try {
    return await getFileUrl(path);
  } catch (error) {
    console.error("Failed to resolve storage path:", path, error);
    return undefined;
  }
}

interface WeekEvent {
  id: string;
  slug?: string;
  title: string;
  startDate: string;
  startTime?: string;
  location?: string;
  heroImageUrl?: string;
  attendees?: number;
}

interface WeekCommunity {
  id: string;
  name: string;
  shortDescription: string;
  category: string;
  memberCount: number;
  logoUrl?: string;
  bannerUrl?: string;
}

function WeekEventRow({ event }: { event: WeekEvent }) {
  return (
    <Link
      to={`/events/${event.slug || event.id}`}
      className="flex items-center gap-3 p-3 rounded-2xl border border-brand-cream-100 dark:border-brand-cream-800 bg-brand-cream-50 dark:bg-brand-cream-950 hover:border-brand-orange/30 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
    >
      <div className="size-14 shrink-0 rounded-xl overflow-hidden bg-brand-cream-100 dark:bg-brand-cream-900 flex items-center justify-center">
        {event.heroImageUrl ? (
          <img
            src={event.heroImageUrl}
            alt={event.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <Users className="w-6 h-6 text-brand-cream-400" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-brand-orange uppercase tracking-wide">
          {formatEventDateTime(event.startDate, event.startTime)}
        </p>
        <p className="font-semibold text-sm text-brand-cream-950 dark:text-brand-cream-50 truncate">
          {event.title}
        </p>
        {event.location && (
          <p className="text-xs text-brand-cream-500 truncate flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
            {event.location}
          </p>
        )}
      </div>
      {(event.attendees ?? 0) > 0 && (
        <span className="hidden sm:inline text-xs text-brand-cream-500 font-medium shrink-0 whitespace-nowrap">
          {event.attendees} going
        </span>
      )}
    </Link>
  );
}

function WeekCommunityRow({ community }: { community: WeekCommunity }) {
  return (
    <Link
      to="/communities"
      className="flex items-center gap-3 p-3 rounded-2xl border border-brand-cream-100 dark:border-brand-cream-800 bg-brand-cream-50 dark:bg-brand-cream-950 hover:border-brand-orange/30 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
    >
      <div className="size-14 shrink-0 rounded-xl overflow-hidden bg-brand-cream-100 dark:bg-brand-cream-900 flex items-center justify-center">
        {community.logoUrl ? (
          <img
            src={community.logoUrl}
            alt={community.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <Users className="w-6 h-6 text-brand-cream-400" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-brand-blue uppercase tracking-wide truncate">
          {community.category}
        </p>
        <p className="font-semibold text-sm text-brand-cream-950 dark:text-brand-cream-50 truncate">
          {community.name}
        </p>
        <p className="text-xs text-brand-cream-500 truncate">
          {formatMemberCount(community.memberCount)} members
        </p>
      </div>
    </Link>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const [freshJobs, setFreshJobs] = useState<ExternalJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsFailed, setJobsFailed] = useState(false);
  const [jobCount, setJobCount] = useState<number | null>(null);
  const [companyCount, setCompanyCount] = useState<number | null>(null);

  const [weekEvents, setWeekEvents] = useState<WeekEvent[]>([]);
  const [weekCommunities, setWeekCommunities] = useState<WeekCommunity[]>([]);

  // Final CTA panel has its own email capture — the floating digest prompt
  // must hide whenever it's in the viewport to avoid two capture surfaces
  // competing on screen at once.
  const finalCtaRef = useRef<HTMLElement | null>(null);
  const [finalCtaVisible, setFinalCtaVisible] = useState(false);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    trackEvent("landing_search_submit", { query: trimmed });
    navigate(trimmed ? `/jobs?search=${encodeURIComponent(trimmed)}` : "/jobs");
  };

  useEffect(() => {
    trackEvent("landing_view");
  }, []);

  // Live jobs feed: powers the headline count, trust line, and the fresh
  // jobs strip. On failure the strip hides itself entirely (never an empty
  // error block) and the headline falls back to a non-numeric label.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const jobs = await fetchExternalJobs();
        const active = activeExternalJobs(jobs);
        if (cancelled) return;
        if (active.length === 0) {
          setJobsFailed(true);
        } else {
          setJobCount(active.length);
          setCompanyCount(new Set(active.map((job) => job.company_name)).size);
          setFreshJobs(pickFreshestJobs(active, 6));
        }
      } catch (error) {
        console.error("Error fetching external jobs feed:", error);
        if (!cancelled) setJobsFailed(true);
      } finally {
        if (!cancelled) setJobsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // "This week on Tail'ed" — real events/communities via /public/explore,
  // quality-gated (WS2). Either half — or the whole section — collapses
  // silently on fetch failure or when nothing clears the gate.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch("/public/explore?eventLimit=8&communityLimit=8");
        const data = await response.json();
        if (!response.ok || !data.success) return;

        const rawEvents: any[] = data.events ?? [];
        const resolvedEvents = await Promise.all(
          rawEvents.map(async (evt): Promise<WeekEvent | null> => {
            const heroImageUrl = await resolveStorageUrl(evt.heroImage);
            const candidate = {
              id: evt.id,
              heroImageUrl,
              startDate: evt.startDate,
            };
            if (!isFeaturableEvent(candidate)) return null;
            return {
              id: evt.id,
              slug: evt.slug,
              title: evt.title,
              startDate: evt.startDate,
              startTime: evt.startTime,
              location: evt.location || evt.city,
              heroImageUrl,
              attendees: evt.attendees || 0,
            };
          }),
        );
        if (!cancelled) {
          setWeekEvents(resolvedEvents.filter((e): e is WeekEvent => e !== null).slice(0, 3));
        }

        const rawCommunities: any[] = data.communities ?? [];
        const resolvedCommunities = await Promise.all(
          rawCommunities.map(async (comm): Promise<WeekCommunity | null> => {
            const [logoUrl, bannerUrl] = await Promise.all([
              resolveStorageUrl(comm.logo),
              resolveStorageUrl(comm.banner),
            ]);
            const candidate = {
              memberCount: comm.memberCount || 0,
              logoUrl,
              bannerUrl,
              shortDescription: comm.shortDescription,
            };
            if (!isFeaturableCommunity(candidate)) return null;
            return {
              id: comm.id,
              name: comm.name,
              shortDescription: comm.shortDescription,
              category: comm.category,
              memberCount: comm.memberCount || 0,
              logoUrl,
              bannerUrl,
            };
          }),
        );
        if (!cancelled) {
          setWeekCommunities(
            resolvedCommunities.filter((c): c is WeekCommunity => c !== null).slice(0, 3),
          );
        }
      } catch (error) {
        console.error("Error fetching explore content:", error);
        // Leave weekEvents/weekCommunities empty — the section collapses.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = finalCtaRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setFinalCtaVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const jobCountLabel = roundedJobCountLabel(jobCount);
  const showWeekSection = weekEvents.length > 0 || weekCommunities.length > 0;

  return (
    <div className="bg-brand-cream dark:bg-neutral-950 font-sans text-brand-cream-900 dark:text-brand-cream-100 overflow-x-hidden transition-colors duration-200 antialiased selection:bg-brand-orange/20 selection:text-brand-orange">
      <Seo
        noSuffix
        title="Tail'ed Community — Tech internships and new-grad jobs for students, free forever"
        description="A non-profit student platform with thousands of tech internships and new-grad jobs, hackathons, events, and student communities. Free forever."
        path="/"
      />
      <Header />
      <DigestPrompt suppressed={finalCtaVisible} />
      <main className="w-full">
        {/* Hero — compressed so hero + jobs strip both fit at 1440x900, and
            hero + >=2 job rows both fit at 390x844. */}
        <section className="pt-5 pb-4 md:pt-12 md:pb-8 px-4 md:px-6 max-w-5xl mx-auto flex flex-col items-center text-center relative isolate">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] sm:w-[460px] sm:h-[460px] bg-gradient-to-tr from-brand-orange/20 via-brand-yellow/10 to-brand-blue/20 rounded-full blur-[90px] -z-10 pointer-events-none"></div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-cream-50 dark:bg-brand-cream-900 border border-brand-cream-100 dark:border-brand-cream-800 mb-3 shadow-sm">
            <Heart className="w-3.5 h-3.5 text-brand-orange" aria-hidden="true" />
            <span className="text-xs font-medium text-brand-cream-600 dark:text-brand-cream-300">
              Non-profit · Built by students
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight text-brand-cream-950 dark:text-brand-cream-50 mb-2 max-w-3xl mx-auto leading-[1.15]">
            <span className="inline-block bg-gradient-to-r from-brand-orange to-brand-orange/70 bg-clip-text text-transparent tabular-nums">
              {jobCountLabel}
            </span>{" "}
            tech internships &amp; new-grad jobs.{" "}
            <span className="bg-gradient-to-r from-brand-orange to-brand-orange/70 bg-clip-text text-transparent">
              Free forever.
            </span>
          </h1>
          <p className="text-sm md:text-lg text-brand-cream-600 dark:text-brand-cream-400 max-w-xl mx-auto mb-4 leading-relaxed">
            Tail'ed Community is a non-profit built by students, for students — no paywall, no data selling.
          </p>

          <form
            onSubmit={handleSearchSubmit}
            className="w-full max-w-xl mx-auto flex flex-col sm:flex-row items-stretch gap-2 mb-3"
          >
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-cream-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search internships by role or city…"
                className="w-full pl-12 pr-4 py-2.5 md:py-3 rounded-full bg-brand-cream-50 dark:bg-brand-cream-950 border border-brand-cream-200 dark:border-brand-cream-800 text-brand-cream-950 dark:text-brand-cream-50 placeholder:text-brand-cream-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all text-base"
              />
            </div>
            <button
              type="submit"
              className="px-7 py-2.5 md:py-3 rounded-full bg-brand-cream-950 text-brand-cream-50 dark:bg-brand-cream-50 dark:text-brand-cream-950 font-semibold hover:scale-[1.03] transition-all shadow-md flex items-center justify-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-2"
            >
              Search jobs
            </button>
          </form>

          {user ? (
            <div className="flex justify-center w-full sm:w-auto mb-3">
              <Link
                to="/dashboard"
                className="w-full sm:w-auto px-8 py-2.5 md:py-3 rounded-full bg-brand-cream-950 text-brand-cream-50 dark:bg-brand-cream-50 dark:text-brand-cream-950 font-semibold hover:scale-[1.03] transition-all shadow-md flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-2"
              >
                Go to dashboard
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto mb-3">
              <Link
                to="/sign-up"
                onClick={() => trackEvent("landing_join_click", { location: "hero" })}
                className="w-full sm:w-auto px-8 py-2.5 md:py-3 rounded-full bg-brand-orange text-white font-semibold hover:bg-brand-orange/90 hover:scale-[1.03] transition-all shadow-md flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-2"
              >
                Join free — 10 seconds with Google
              </Link>
              <Link
                to="/communities"
                className="w-full sm:w-auto px-5 py-2 text-brand-cream-700 dark:text-brand-cream-300 font-medium text-sm hover:text-brand-cream-950 dark:hover:text-brand-cream-50 transition-all group flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 rounded-full"
              >
                Explore communities{" "}
                <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs md:text-sm text-brand-cream-500 font-medium flex-wrap justify-center">
            <CheckCircle className="text-green-600 w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              {jobCountLabel} open roles · {companyCount !== null ? `${companyCount}+` : "many"} companies · updated
              daily · 100% free
            </span>
          </div>
        </section>

        {/* Live jobs strip — the core proof */}
        <section className="px-4 pb-8 md:pb-12 max-w-5xl mx-auto">
          <FreshJobsStrip jobs={freshJobs} loading={jobsLoading} failed={jobsFailed} jobCount={jobCount} />
        </section>

        {/* This week on Tail'ed Community — events + communities, quality-gated */}
        {showWeekSection && (
          <section className="px-4 pb-16 max-w-5xl mx-auto">
            <h2 className="text-xl font-bold text-brand-cream-950 dark:text-brand-cream-50 mb-4 px-1">
              This week on Tail'ed
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {weekEvents.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-semibold text-sm text-brand-cream-600 dark:text-brand-cream-400 uppercase tracking-wide">
                      Events
                    </h3>
                    <Link
                      to="/events"
                      className="text-sm font-semibold text-brand-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 rounded-sm"
                    >
                      See all events →
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {weekEvents.map((event) => (
                      <WeekEventRow key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}
              {weekCommunities.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-semibold text-sm text-brand-cream-600 dark:text-brand-cream-400 uppercase tracking-wide">
                      Communities
                    </h3>
                    <Link
                      to="/communities"
                      className="text-sm font-semibold text-brand-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 rounded-sm"
                    >
                      Explore all →
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {weekCommunities.map((community) => (
                      <WeekCommunityRow key={community.id} community={community} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Why free — the only "explanation" */}
        <section className="px-4 pb-16 max-w-2xl mx-auto text-center">
          <h2 className="text-lg font-bold text-brand-cream-950 dark:text-brand-cream-50 mb-2">Why is this free?</h2>
          <p className="text-brand-cream-600 dark:text-brand-cream-400 leading-relaxed mb-3">
            Tail'ed Community is a registered non-profit built by students. No premium tier, no resume-selling, no recruiter
            spam — we exist so every student gets the same shot.
          </p>
          <a
            href="https://github.com/tailed-community"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-cream-900 dark:text-brand-cream-50 hover:text-brand-orange transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 rounded-sm"
          >
            <SiGithub className="w-4 h-4" aria-hidden="true" />
            We build in the open
          </a>
        </section>

        {/* Final CTA panel — observed by the floating digest prompt above so
            the two email-capture surfaces never show at the same time. */}
        <section id="final-cta-panel" ref={finalCtaRef} className="py-12 px-6">
          <div className="max-w-4xl mx-auto bg-brand-cream-950 dark:bg-brand-cream-50 rounded-[2.5rem] p-10 md:p-16 text-center relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <span className="inline-block py-1 px-3 rounded-full bg-brand-cream-50/10 dark:bg-brand-cream-950/5 text-brand-cream-50 dark:text-brand-cream-950 text-sm font-semibold backdrop-blur-sm border border-brand-cream-50/10 dark:border-brand-cream-950/10">
                100% Free Forever
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-brand-cream-50 dark:text-brand-cream-950 tracking-tight max-w-2xl mx-auto leading-tight">
                Start with your inbox.
              </h2>
              <p className="text-brand-cream-300 dark:text-brand-cream-600 max-w-lg mx-auto">
                {jobCountLabel} live jobs from {companyCount !== null ? `${companyCount}+` : "hundreds of"} companies,
                updated daily. Free forever.
              </p>
              <div className="max-w-md mx-auto pt-2 [&_input]:bg-brand-cream-50 [&_input]:dark:bg-brand-cream-950 [&_input]:border-brand-cream-800 [&_input]:dark:border-brand-cream-200 [&_input]:text-brand-cream-950 [&_input]:dark:text-brand-cream-50 [&_button]:bg-brand-cream-50 [&_button]:dark:bg-brand-cream-950 [&_button]:text-brand-cream-950 [&_button]:dark:text-brand-cream-50 [&_button]:hover:bg-brand-cream-100 [&_button]:dark:hover:bg-brand-cream-800">
                <JobAlertSignup source="landing_footer" variant="card" />
              </div>
              <div className="flex justify-center pt-1">
                <Link
                  to="/sign-up"
                  onClick={() => trackEvent("landing_join_click", { location: "footer" })}
                  className="px-8 py-3 rounded-full bg-brand-orange text-white font-bold hover:bg-brand-orange/90 transition-colors shadow-[0_0_40px_-10px_rgba(255,140,60,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-2"
                >
                  Join free
                </Link>
              </div>
            </div>
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[400px] h-[400px] bg-brand-blue dark:bg-brand-blue/50 rounded-full blur-[100px] opacity-40 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-brand-orange dark:bg-brand-orange/50 rounded-full blur-[100px] opacity-40 pointer-events-none"></div>
          </div>
        </section>
      </main>
      <footer className="border-t border-brand-cream-100 dark:border-brand-cream-800 py-8 bg-brand-cream-50 dark:bg-brand-cream-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-2">
            <Link to="/jobs" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">
              Jobs
            </Link>
            <Link to="/events" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">
              Events
            </Link>
            <Link to="/communities" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">
              Communities
            </Link>
            <Link to="/about" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">
              About
            </Link>
            <Link to="/terms-and-conditions" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">
              Terms
            </Link>
            <Link to="/privacy" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">
              Privacy
            </Link>
            <a href="mailto:community@tailed.ca" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">
              Help
            </a>
          </div>
          <div className="flex items-center gap-6">
            <Link to="https://www.youtube.com/@tailedcommunity" target="_blank" rel="noopener noreferrer" className="text-brand-cream-400 hover:text-brand-cream-900 dark:hover:text-brand-cream-50 transition-colors" aria-label="Tail'ed Community on YouTube">
              <SiYoutube className="w-5 h-5" />
            </Link>
            <Link to="https://www.instagram.com/tailed.community" target="_blank" rel="noopener noreferrer" className="text-brand-cream-400 hover:text-brand-cream-900 dark:hover:text-brand-cream-50 transition-colors" aria-label="Tail'ed Community on Instagram">
              <SiInstagram className="w-5 h-5" />
            </Link>
            <Link to="https://discord.gg/gpbtFXTgNQ" target="_blank" rel="noopener noreferrer" className="text-brand-cream-400 hover:text-brand-cream-900 dark:hover:text-brand-cream-50 transition-colors" aria-label="Tail'ed Community on Discord">
              <SiDiscord className="w-5 h-5" />
            </Link>
            <Link to="https://github.com/tailed-community" target="_blank" rel="noopener noreferrer" className="text-brand-cream-400 hover:text-brand-cream-900 dark:hover:text-brand-cream-50 transition-colors" aria-label="Tail'ed Community on GitHub">
              <SiGithub className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
