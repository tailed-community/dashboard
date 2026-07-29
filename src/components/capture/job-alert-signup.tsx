import { useState, type FormEvent } from "react";
import { Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/fetch";
import { useAuth } from "@/hooks/use-auth";
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
   * Pre-fills the field for logged-out visitors — used after RSVP, where the
   * email was already captured in the registration form and must not be asked
   * for twice. Ignored when signed in: that alert always goes to the account's
   * own address (the API enforces this too).
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
 *
 * For a signed-in visitor there is nothing to trade: we already have their
 * address and the backend takes it from their ID token regardless of what the
 * body says. So they get a single button instead of a field asking for an
 * email we know — see the `signedIn` branch below.
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
  const { user, loading: authLoading, likelySignedIn } = useAuth();
  const [email, setEmail] = useState(defaultEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(() => isJobAlertSubscribed());

  // While auth is still resolving, trust the prior-session hint so a signed-in
  // visitor doesn't see the email field flash before the button replaces it.
  const signedIn = authLoading ? likelySignedIn : !!user;
  const accountEmail = user?.email ?? null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    // Signed-in callers send no email at all — the API uses their token's.
    if ((!signedIn && !trimmed) || submitting) return;
    // Rendering the signed-in layout off a stale hint: hold the submit until
    // auth lands, so we never post an email-less body for a logged-out visitor.
    if (signedIn && authLoading) return;

    setSubmitting(true);
    try {
      const response = await apiFetch("/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(signedIn ? {} : { email: trimmed }),
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

  // Signed in — we already know where to send it. One button, no email field.
  if (signedIn) {
    return (
      <form
        onSubmit={handleSubmit}
        className={cn(
          variant === "card"
            ? "flex flex-col items-stretch gap-1.5 w-full"
            : "flex flex-col items-start gap-1 w-full",
          className,
        )}
      >
        <Button
          type="submit"
          size={variant === "card" ? "lg" : "sm"}
          disabled={submitting || authLoading}
          className={cn("shrink-0", variant === "card" && "rounded-full w-full")}
        >
          {submitting ? "Signing you up…" : "Get job alerts"}
        </Button>
        {accountEmail && (
          <p className="text-xs text-muted-foreground">
            Sent to {accountEmail}
          </p>
        )}
      </form>
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
