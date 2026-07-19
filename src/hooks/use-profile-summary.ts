import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMyAlerts } from "@/hooks/use-alerts";
import {
  calculateProfileScore,
  getMyProfile,
  type ProfileCompletion,
  type StudentProfile,
} from "@/lib/profile";

export interface ProfileSummary {
  /** True while either the profile or the alert list is still loading. */
  loading: boolean;
  /** Profile completeness 0–100 (0 until the profile loads). */
  score: number;
  /** Per-field completeness breakdown, or null before the profile loads. */
  completed: ProfileCompletion | null;
  /** Number of the signed-in user's active + inactive job alerts. */
  alertCount: number;
  /** The loaded profile, or null when unauthenticated / not yet loaded. */
  profile: StudentProfile | null;
}

/**
 * Ambient summary of the signed-in user's profile — completeness score and
 * live alert count — for the profile menu / hub. Composes the existing
 * `useMyAlerts` hook for alerts and reuses `getMyProfile` (`GET /profile`, the
 * same call the account page makes) for the profile, then scores it with the
 * shared `calculateProfileScore`.
 *
 * Degrades gracefully: unauthenticated or failed loads return zeros and never
 * throw. Only meant to be mounted for signed-in users (the profile menu only
 * renders then), but a logged-out mount is harmless.
 */
export function useProfileSummary(): ProfileSummary {
  const { user } = useAuth();
  const { alerts, loading: alertsLoading } = useMyAlerts();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(!!user);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);

    getMyProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        console.error("Failed to load profile summary:", err);
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const { score, completed } = useMemo<{
    score: number;
    completed: ProfileCompletion | null;
  }>(() => {
    if (!profile) return { score: 0, completed: null };
    return calculateProfileScore(profile);
  }, [profile]);

  return {
    loading: profileLoading || alertsLoading,
    score,
    completed,
    alertCount: alerts.length,
    profile,
  };
}
