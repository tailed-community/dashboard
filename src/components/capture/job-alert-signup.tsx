import { useEffect, useState, type FormEvent } from "react";
import { Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/fetch";
import { studentAuth } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { getStorageFlag, setStorageFlag } from "@/lib/storage-flags";

export type JobAlertSource =
  | "search"
  | "landing_strip"
  | "landing_footer"
  | "job_detail"
  | "save_job"
  | "digest_prompt"
  | "event_rsvp_optin";

interface JobAlertSignupProps {
  source: JobAlertSource;
  query?: string | null;
  locations?: string[] | null;
  jobType?: "internship" | "new-grad" | null;
  /** "inline" (jobs board / strip / detail) or "card" (landing footer panel). */
  variant?: "inline" | "card";
  className?: string;
  /** Called after a successful subscribe (e.g. to dismiss a parent prompt/toast). */
  onSubscribed?: () => void;
  /**
   * Pre-fills (and takes priority over studentAuth.currentUser?.email) —
   * used after RSVP, where the email was already captured in the
   * registration form and must not be asked for twice.
   */
  defaultEmail?: string;
}

const STORAGE_KEY = "jobAlertSubscribed";

/** Whether this visitor has already subscribed to job alerts (any surface). */
export function isJobAlertSubscribed(): boolean {
  return getStorageFlag("local", STORAGE_KEY);
}

/**
 * One email field + button that trades value (fresh jobs in your inbox) for
 * an email address. Used across the landing page, jobs board, job detail,
 * and post-RSVP confirmation. Never blocks the surrounding flow — failures
 * just toast an error and leave the form usable.
 */
export function JobAlertSignup({
  source,
  query,
  locations,
  jobType,
  variant = "inline",
  className,
  onSubscribed,
  defaultEmail,
}: JobAlertSignupProps) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(() => isJobAlertSubscribed());

  useEffect(() => {
    if (!email && studentAuth.currentUser?.email) {
      setEmail(studentAuth.currentUser.email);
    }
    // Only prefill once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const response = await apiFetch("/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          source,
          ...(query ? { query } : {}),
          ...(locations && locations.length > 0 ? { locations } : {}),
          ...(jobType ? { jobType } : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Subscription failed");
      }

      setStorageFlag("local", STORAGE_KEY);
      setSubscribed(true);
      trackEvent("job_alert_subscribed", { source });
      toast.success("You're in — first digest tomorrow morning");
      onSubscribed?.();
    } catch (error) {
      console.error("Job alert subscribe failed:", error);
      toast.error("Couldn't sign you up — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (subscribed) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Check className="h-4 w-4 text-green-600 shrink-0" aria-hidden="true" />
        <span>You're subscribed to job alerts</span>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <form
        onSubmit={handleSubmit}
        className={cn("flex flex-col sm:flex-row items-stretch gap-2.5 w-full", className)}
      >
        <div className="relative flex-1">
          <Mail
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            className="pl-11 h-auto py-3 rounded-full"
          />
        </div>
        <Button type="submit" size="lg" className="rounded-full shrink-0" disabled={submitting}>
          {submitting ? "Signing up…" : "Get daily job alerts"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex items-center gap-2 w-full", className)}>
      <div className="relative flex-1 min-w-0">
        <Mail
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.edu"
          className="pl-7 h-8 text-sm"
        />
      </div>
      <Button type="submit" size="sm" disabled={submitting} className="shrink-0">
        {submitting ? "…" : "Get alerts"}
      </Button>
    </form>
  );
}
