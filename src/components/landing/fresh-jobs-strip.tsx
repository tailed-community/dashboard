import { Link } from "react-router-dom";
import { Briefcase } from "lucide-react";
import type { ExternalJob } from "@/types/jobs";
import { Skeleton } from "@/components/ui/skeleton";
import { JobAlertSignup } from "@/components/capture/job-alert-signup";
import { formatPostedLabel } from "@/lib/external-jobs";

function JobRow({ job }: { job: ExternalJob }) {
  const typeLabel = job.type === "internship" ? "Internship" : "New Grad";
  return (
    <Link
      to={`/jobs/e/${encodeURIComponent(job.id)}`}
      className="flex items-center gap-3 sm:gap-4 px-2 sm:px-4 py-2.5 sm:py-3 rounded-2xl border border-transparent hover:border-brand-cream-200 dark:hover:border-brand-cream-800 hover:bg-brand-cream-50 dark:hover:bg-brand-cream-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
    >
      <div className="size-10 shrink-0 rounded-xl bg-brand-cream-100 dark:bg-brand-cream-900 flex items-center justify-center">
        <Briefcase className="w-5 h-5 text-brand-cream-500" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-brand-cream-950 dark:text-brand-cream-50 truncate">
          {job.title}
        </p>
        <p className="text-xs text-brand-cream-500 truncate">
          {job.company_name} · {job.locations?.[0] || "Remote"}
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <span className="px-2.5 py-1 rounded-md bg-brand-cream-100 dark:bg-brand-cream-900 text-brand-cream-600 dark:text-brand-cream-400 text-xs font-semibold border border-brand-cream-200 dark:border-brand-cream-800">
          {typeLabel}
        </span>
        <span className="text-xs text-brand-cream-400 whitespace-nowrap">{formatPostedLabel(job)}</span>
      </div>
    </Link>
  );
}

function JobRowSkeleton() {
  return (
    <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3">
      <Skeleton className="size-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="hidden sm:block h-6 w-20 rounded-md shrink-0" />
    </div>
  );
}

interface FreshJobsStripProps {
  jobs: ExternalJob[];
  loading: boolean;
  /** True once the feed fetch has settled and failed (or returned nothing usable). */
  failed: boolean;
  /** Total active job count, for the "See all {count} jobs" link. Null while unknown. */
  jobCount: number | null;
}

/**
 * The landing page's core proof section: a handful of the freshest live jobs
 * from the external feed. Renders skeleton rows while loading and hides
 * itself entirely on feed failure — an empty/error block here would be worse
 * than nothing, since the rest of the page still functions without it.
 */
export function FreshJobsStrip({ jobs, loading, failed, jobCount }: FreshJobsStripProps) {
  if (failed) return null;
  if (!loading && jobs.length === 0) return null;

  return (
    <div className="rounded-[2rem] border border-brand-cream-200 dark:border-brand-cream-800 bg-brand-cream-50/60 dark:bg-brand-cream-900/30 p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3 px-1 sm:px-2">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-lg text-brand-cream-950 dark:text-brand-cream-50">
            Fresh off the feed
          </h2>
          <Link
            to="/jobs"
            className="text-sm font-semibold text-brand-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 rounded-sm"
          >
            {jobCount !== null ? `See all ${jobCount.toLocaleString("en-US")} jobs →` : "See all jobs →"}
          </Link>
        </div>
        <div className="w-full sm:w-64 shrink-0">
          <JobAlertSignup source="landing_strip" variant="inline" />
        </div>
      </div>
      <div className="divide-y divide-brand-cream-200/70 dark:divide-brand-cream-800/70">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <JobRowSkeleton key={i} />)
          : jobs.map((job) => <JobRow key={job.id} job={job} />)}
      </div>
    </div>
  );
}
