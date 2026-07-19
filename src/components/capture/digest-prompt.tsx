import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { JobAlertSignup, isJobAlertSubscribed } from "@/components/capture/job-alert-signup";
import { FloatingCaptureCard } from "@/components/capture/floating-capture-card";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { getStorageFlag, setStorageFlag } from "@/lib/storage-flags";

const SESSION_KEY = "digestPromptShown";
const SCROLL_THRESHOLD = 0.6;

interface DigestPromptProps {
  /**
   * True while another capture surface (e.g. the landing page's final CTA
   * panel, which has its own email capture) is in the viewport. While true,
   * the floating prompt fades/slides out of view instead of stacking two
   * capture surfaces on screen at once — it remains mounted so it can
   * transition back in once the other surface scrolls out of view.
   */
  suppressed?: boolean;
}

/**
 * Small, easily-dismissible bottom-right card offering the daily job digest.
 * Appears at most once per session, only for logged-out visitors who
 * haven't already subscribed to job alerts, once the visitor has scrolled
 * past 60% of the landing page. Never a modal wall — browsing is never
 * blocked. Source: "digest_prompt".
 */
export function DigestPrompt({ suppressed = false }: DigestPromptProps) {
  const { user, loading, likelySignedIn } = useAuth();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Auth resolves asynchronously now — while it's still in flight, skip
    // arming the listener if a prior session hints the visitor is signed
    // in, so we don't briefly show a logged-out capture prompt to someone
    // who turns out to be signed in a moment later.
    if (loading && likelySignedIn) return;
    if (user) {
      // Auth resolved (or re-resolved) to signed-in after the listener was
      // already armed — e.g. the localStorage hint was missing/wrong in
      // private browsing and a signed-in visitor scrolled past the
      // threshold before Firebase reported back. Force the card hidden so
      // it can't stay shown (or flash) to a signed-in user.
      setVisible(false);
      return;
    }
    if (isJobAlertSubscribed()) return;
    if (typeof window === "undefined") return;

    if (getStorageFlag("session", SESSION_KEY)) return;

    const handleScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = window.scrollY / scrollable;
      if (progress >= SCROLL_THRESHOLD) {
        setVisible(true);
        setStorageFlag("session", SESSION_KEY);
        trackEvent("digest_prompt_shown", { source: "digest_prompt" });
        window.removeEventListener("scroll", handleScroll);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [user, loading, likelySignedIn]);

  if (!visible || dismissed) return null;

  return (
    <FloatingCaptureCard
      icon={Mail}
      title="Get fresh jobs in your inbox every morning"
      onDismiss={() => setDismissed(true)}
      suppressed={suppressed}
    >
      <JobAlertSignup
        source="digest_prompt"
        variant="inline"
        onSubscribed={() => {
          trackEvent("digest_prompt_subscribed", { source: "digest_prompt" });
          setDismissed(true);
        }}
      />
    </FloatingCaptureCard>
  );
}
