import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Circle,
  Compass,
  GraduationCap,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMyAlerts } from "@/lib/alerts";
import {
  getPreferredLanguage,
  updateOnboardingState,
  type StudentProfile,
} from "@/lib/profile";
import { ONBOARDING_CARD_COPY } from "./account-onboarding-card-copy";

/**
 * Joyful onboarding card shown at the top of /account (spec 08 §3.0).
 *
 * Evolved from the old static 3-step list into a ~5-item, progress-ring,
 * dismissible, self-celebrating checklist. Every item's done-state is derived
 * live from a REAL signal (never a duplicated "step done" flag) — profile
 * required-set, alert count, workplace-values presence, the self-ID completion
 * timestamp, and community/event membership. The only things we persist are
 * what cannot be derived: `onboardingState.dismissedAt` (card stays hidden after
 * a manual dismiss) and `onboardingState.celebratedAt` (completion celebration
 * shown exactly once).
 *
 * Item labels/CTAs map 1:1 to the email drip steps (spec 08 §7). Copy is
 * hardcoded EN for now, mirroring the previous card — FR is a follow-up build
 * task (spec 08 §5 / §8).
 *
 * Renders nothing once every item is done (after the one-time celebration) or
 * once dismissed, so it never nags a complete profile.
 */

/** Real signals read off the account page's profile (shared `StudentProfile`). */
type OnboardingSignals = Pick<
  StudentProfile,
  | "firstName"
  | "school"
  | "program"
  | "graduationYear"
  | "workplaceValues"
  | "demographicSurveyCompletedAt"
  | "communities"
  | "events"
  | "onboardingState"
  | "preferredLanguage"
>;

interface AccountOnboardingCardProps {
  /** The account page's live profile object (or the subset the card needs). */
  profile: OnboardingSignals;
  /** Switches the account page's (controlled) tab, e.g. onGoToTab("education"). */
  onGoToTab: (tab: string) => void;
}

type OnboardingItem = {
  key: string;
  icon: typeof Bell;
  label: string;
  done: boolean;
  /** Shown in place of the CTA once the item is done (optional). */
  doneLabel?: string;
  cta:
    | { kind: "tab"; tab: string; verb: string }
    | { kind: "link"; to: string; verb: string; doneVerb?: string };
};

const TOTAL_ITEMS = 5;

/** Small circular "N of 5" progress ring (no extra deps). */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const size = 52;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? done / total : 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-brand-orange/15"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className="text-brand-orange transition-all duration-500 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800">
        {done}/{total}
      </span>
    </div>
  );
}

export function AccountOnboardingCard({
  profile,
  onGoToTab,
}: AccountOnboardingCardProps) {
  const [alertCount, setAlertCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const celebrationPersisted = useRef(false);

  // Copy language comes from the student's communication preference (spec 08
  // §5.1), NOT the global UI locale. Defaults to English.
  const t = ONBOARDING_CARD_COPY[getPreferredLanguage(profile)];

  // Best-effort alert count for the "set a job alert" item. Never blocks the
  // card: on failure we simply treat it as "no alerts yet" (null → 0).
  useEffect(() => {
    let cancelled = false;
    getMyAlerts()
      .then((alerts) => {
        if (!cancelled) setAlertCount(alerts.length);
      })
      .catch(() => {
        if (!cancelled) setAlertCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Derive item done-ness from real signals (spec 08 §3.0). ---
  const profileDone = !!(
    profile.firstName?.trim() &&
    profile.school?.trim() &&
    profile.program?.trim() &&
    String(profile.graduationYear ?? "").trim()
  );
  const alertsDone = (alertCount ?? 0) > 0;
  const valuesDone = !!profile.workplaceValues;
  const selfIdDone = !!profile.demographicSurveyCompletedAt;
  const involvedDone =
    (profile.communities?.length ?? 0) > 0 || (profile.events?.length ?? 0) > 0;

  const items: OnboardingItem[] = [
    {
      key: "profile",
      icon: GraduationCap,
      label: t.items.profile,
      done: profileDone,
      cta: { kind: "tab", tab: "education", verb: t.verbs.profileAdd },
    },
    {
      key: "alerts",
      icon: Bell,
      label: alertsDone
        ? t.items.alertsDone(alertCount ?? 0)
        : t.items.alertsTodo,
      done: alertsDone,
      cta: {
        kind: "link",
        to: "/account/alerts",
        verb: t.verbs.alertsSetUp,
        doneVerb: t.verbs.alertsManage,
      },
    },
    {
      key: "values",
      icon: Compass,
      label: t.items.values,
      done: valuesDone,
      cta: {
        kind: "link",
        to: "/account/survey/values",
        verb: t.verbs.valuesStart,
      },
    },
    {
      key: "selfid",
      icon: ShieldCheck,
      label: t.items.selfid,
      done: selfIdDone,
      doneLabel: t.items.selfidDone,
      cta: {
        kind: "link",
        to: "/account/survey/self-id",
        verb: t.verbs.selfidShare,
      },
    },
    {
      key: "involved",
      icon: Users,
      label: t.items.involved,
      done: involvedDone,
      cta: { kind: "link", to: "/communities", verb: t.verbs.involvedExplore },
    },
  ];

  const doneCount = items.filter((item) => item.done).length;
  const allDone = doneCount === TOTAL_ITEMS;
  const alreadyCelebrated = !!profile.onboardingState?.celebratedAt;
  const alreadyDismissed = !!profile.onboardingState?.dismissedAt || dismissed;

  // Persist the completion celebration exactly once, the first time every item
  // becomes done (spec 08 §3.0 / acceptance criterion 2).
  useEffect(() => {
    if (allDone && !alreadyCelebrated && !celebrationPersisted.current) {
      celebrationPersisted.current = true;
      updateOnboardingState({ celebratedAt: new Date().toISOString() }).catch(
        () => {
          /* best-effort; the card still self-hides for this session */
        },
      );
    }
  }, [allDone, alreadyCelebrated]);

  const handleDismiss = () => {
    setDismissed(true);
    updateOnboardingState({ dismissedAt: new Date().toISOString() }).catch(
      () => {
        /* best-effort; still hidden for this session */
      },
    );
  };

  // Hidden for good once dismissed, or once complete AND already celebrated.
  if (alreadyDismissed) return null;
  if (allDone && alreadyCelebrated) return null;

  // One-time celebratory moment when everything first becomes done.
  if (allDone) {
    return (
      <Card className="border-brand-orange/40 bg-brand-orange/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="animate-bounce text-3xl" aria-hidden="true">
              🎉
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5 text-brand-orange" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {t.celebration.title}
                </h2>
              </div>
              <p className="mt-1 text-sm text-gray-700">
                {t.celebration.body}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="shrink-0 text-gray-500 hover:text-gray-700"
            >
              {t.celebration.done}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand-orange/30 bg-brand-orange/5">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <ProgressRing done={doneCount} total={TOTAL_ITEMS} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-orange" />
              <h2 className="text-lg font-semibold text-gray-900">
                {t.header}
              </h2>
            </div>
            <p className="text-sm text-gray-500">
              {t.subtitle(doneCount, TOTAL_ITEMS)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            aria-label={t.hide}
            title={t.hide}
            className="h-8 w-8 shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ul className="space-y-3">
          {items.map((item) => {
            const ItemIcon = item.icon;
            const cta = item.cta;

            let action: ReactNode = null;
            if (item.done) {
              if (item.doneLabel) {
                action = (
                  <span className="shrink-0 text-sm font-medium text-green-700">
                    {item.doneLabel}
                  </span>
                );
              } else if (cta.kind === "link" && cta.doneVerb) {
                action = (
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link to={cta.to}>
                      <ItemIcon className="mr-1.5 h-4 w-4" />
                      {cta.doneVerb}
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                );
              }
            } else if (cta.kind === "tab") {
              action = (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onGoToTab(cta.tab)}
                  className="shrink-0"
                >
                  <ItemIcon className="mr-1.5 h-4 w-4" />
                  {cta.verb}
                </Button>
              );
            } else {
              action = (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to={cta.to}>
                    <ItemIcon className="mr-1.5 h-4 w-4" />
                    {cta.verb}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              );
            }

            return (
              <li key={item.key} className="flex items-center gap-3">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-gray-400" />
                )}
                <span className="flex-1 text-sm text-gray-700">
                  {item.label}
                </span>
                {action}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
