import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GripVertical, Heart, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/seo";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import {
    getWorkplaceValues,
    submitWorkplaceValues,
    type WorkplaceValuesSubmission,
} from "@/lib/surveys";
import type { WorkplaceValues } from "@/lib/profile";
import { VALUES_COPY } from "./copy";

/*
 * Workplace-values survey (spec 08 §3.4, §4.6, §6.2).
 *
 * The DELIBERATE OPPOSITE of the anonymous self-ID survey: this one is LINKED to
 * the profile and RE-EDITABLE. We prefill from `getWorkplaceValues()` on load,
 * present a warm "update what you value" state (never a one-time closed state),
 * and re-submitting simply overwrites and bumps `updatedAt`. There is NO
 * anonymity / immutability / consent framing here — that belongs to self-ID only.
 *
 * 10 Likert (1–5) dimensions + one forced top-3 ranking (required to submit).
 * Submit is disabled until all 10 are rated AND exactly 3 are ranked.
 *
 * Copy is hardcoded EN — FR is a flagged follow-up build task (spec 08 §5 / §8).
 */

// ── The 10 dimensions. KEYS + ORDER are canonical machine values (mirror spec
// §6.2 and the server enum) and NEVER change with language; the labels/prompts
// shown to the student come from the bilingual copy (`./copy`). ──

type DimensionKey = keyof WorkplaceValues["perDimension"];

const DIMENSION_KEYS: DimensionKey[] = [
    "careerDevelopment",
    "compensation",
    "workLifeBalance",
    "jobSecurity",
    "missionPurpose",
    "dei",
    "culturePeople",
    "prestige",
    "meaningfulWork",
    "wellbeingSupport",
];

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

// ── Likert 1–5 control (labeled endpoints, accessible radiogroup) ────────────

function LikertRow({
    label,
    prompt,
    lowLabel,
    highLabel,
    value,
    onChange,
}: {
    label: string;
    prompt: string;
    lowLabel: string;
    highLabel: string;
    value: number | undefined;
    onChange: (v: number) => void;
}) {
    return (
        <fieldset className="rounded-2xl border border-joy-ink/8 bg-white p-5 shadow-sm">
            <legend className="joy-display px-1 text-base font-extrabold text-joy-ink">
                {label}
            </legend>
            <p className="mt-1 text-sm text-joy-ink-muted">{prompt}</p>

            <div
                className="mt-4 flex items-center gap-2"
                role="radiogroup"
                aria-label={prompt}
            >
                {RATING_VALUES.map((v) => {
                    const selected = value === v;
                    return (
                        <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={`${v} out of 5`}
                            onClick={() => onChange(v)}
                            className={
                                "flex h-11 flex-1 items-center justify-center rounded-xl border text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 " +
                                (selected
                                    ? "border-joy-grass bg-joy-grass text-white"
                                    : "border-joy-ink/12 bg-white text-joy-ink hover:border-joy-grass/50")
                            }
                        >
                            {v}
                        </button>
                    );
                })}
            </div>
            <div className="mt-2 flex justify-between px-1 text-xs font-medium text-joy-ink-muted">
                <span>{lowLabel}</span>
                <span>{highLabel}</span>
            </div>
        </fieldset>
    );
}

// ── Forced top-3 ranking (select-then-order; click to add in order) ──────────

function TopThreePicker({
    topThree,
    onToggle,
    labelOf,
    t,
}: {
    topThree: DimensionKey[];
    onToggle: (key: DimensionKey) => void;
    labelOf: (key: DimensionKey) => string;
    t: (typeof VALUES_COPY)["en"];
}) {
    return (
        <fieldset className="rounded-2xl border border-joy-ink/8 bg-white p-5 shadow-sm">
            <legend className="joy-display px-1 text-base font-extrabold text-joy-ink">
                {t.topThreeLegend}
            </legend>
            <p className="mt-1 text-sm text-joy-ink-muted">
                {t.topThreePromptBefore}
                <strong>{t.topThreeEmphasis}</strong>
                {t.topThreePromptAfter}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DIMENSION_KEYS.map((key) => {
                    const rank = topThree.indexOf(key);
                    const selected = rank !== -1;
                    const full = topThree.length >= 3 && !selected;
                    return (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={selected}
                            disabled={full}
                            onClick={() => onToggle(key)}
                            className={
                                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 " +
                                (selected
                                    ? "border-joy-grass bg-joy-grass-bright/10 text-joy-ink"
                                    : full
                                      ? "cursor-not-allowed border-joy-ink/8 bg-joy-surface text-joy-ink-muted opacity-60"
                                      : "border-joy-ink/12 bg-white text-joy-ink hover:border-joy-grass/50")
                            }
                        >
                            <span
                                className={
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold " +
                                    (selected
                                        ? "bg-joy-grass text-white"
                                        : "bg-joy-ink/5 text-joy-ink-muted")
                                }
                            >
                                {selected ? rank + 1 : <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />}
                            </span>
                            {labelOf(key)}
                        </button>
                    );
                })}
            </div>

            {topThree.length > 0 ? (
                <p className="mt-3 text-sm font-medium text-joy-ink">
                    {topThree.map((k, i) => `${i + 1}. ${labelOf(k)}`).join("   ")}
                </p>
            ) : null}
        </fieldset>
    );
}

// ── The page ─────────────────────────────────────────────────────────────────

type Phase = "loading" | "form";

export default function WorkplaceValuesSurveyPage() {
    const navigate = useNavigate();
    const [phase, setPhase] = useState<Phase>("loading");
    const [submitting, setSubmitting] = useState(false);
    // Whether we loaded existing values / have saved at least once this session —
    // drives the "update what you value" register (this survey is re-editable).
    const [hasExisting, setHasExisting] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    // Communication-language preference (spec 08 §5.1), fetched with the survey.
    // Defaults to English until the GET resolves; NOT the global UI locale.
    const [lang, setLang] = useState<"en" | "fr">("en");
    const t = VALUES_COPY[lang];
    const labelOf = (key: DimensionKey) => t.dimensions[key].label;

    const [ratings, setRatings] = useState<Partial<Record<DimensionKey, number>>>({});
    const [topThree, setTopThree] = useState<DimensionKey[]>([]);

    // Prefill on load — re-editable, so seed the form from any stored submission.
    useEffect(() => {
        let cancelled = false;
        getWorkplaceValues()
            .then(({ workplaceValues, preferredLanguage }) => {
                if (cancelled) return;
                setLang(preferredLanguage);
                if (workplaceValues) {
                    setRatings({ ...workplaceValues.perDimension });
                    setTopThree(
                        (workplaceValues.topThree as DimensionKey[]).filter((k) =>
                            DIMENSION_KEYS.includes(k),
                        ),
                    );
                    setHasExisting(true);
                }
                setPhase("form");
            })
            .catch(() => {
                // Fail open to an empty form — the backend still validates on submit.
                if (!cancelled) setPhase("form");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const setRating = (key: DimensionKey, v: number) =>
        setRatings((prev) => ({ ...prev, [key]: v }));

    const toggleTopThree = (key: DimensionKey) =>
        setTopThree((prev) => {
            if (prev.includes(key)) return prev.filter((k) => k !== key);
            if (prev.length >= 3) return prev; // capped at 3
            return [...prev, key];
        });

    const allRated = useMemo(
        () => DIMENSION_KEYS.every((key) => typeof ratings[key] === "number"),
        [ratings],
    );
    const canSubmit = allRated && topThree.length === 3 && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        // Build the payload — all 10 dimensions are guaranteed rated by `canSubmit`.
        const perDimension = DIMENSION_KEYS.reduce(
            (acc, key) => {
                acc[key] = ratings[key] as number;
                return acc;
            },
            {} as WorkplaceValues["perDimension"],
        );
        const payload: WorkplaceValuesSubmission = { perDimension, topThree };

        setSubmitting(true);
        try {
            await submitWorkplaceValues(payload);
            setHasExisting(true);
            setJustSaved(true);
            toast.success(t.toastSaved);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            const message = error instanceof Error ? error.message : t.errorRetry;
            toast.error(t.toastErrorTitle, { description: message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ colorScheme: "light" }}>
            <Seo
                title={t.seoTitle}
                description={t.seoDescription}
                noSuffix={false}
            />
            <PlaygroundShell routes={LIVE_ROUTES} showSwitcher={false} activeNav={null}>
                <section className="px-5 pb-16 pt-10 md:pt-12">
                    <div className="mx-auto max-w-2xl">
                        {phase === "loading" ? (
                            <div className="flex justify-center py-24">
                                <Loader2 className="h-6 w-6 animate-spin text-joy-grass" aria-hidden="true" />
                            </div>
                        ) : (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void handleSubmit();
                                }}
                            >
                                <header className="mb-6">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-joy-grass-bright/15 px-3 py-1 text-xs font-bold text-joy-grass">
                                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                        {t.badge}
                                    </span>
                                    <h1 className="joy-display mt-4 text-3xl font-extrabold leading-[1.08] tracking-tight text-joy-ink">
                                        {hasExisting ? t.titleUpdate : t.titleNew}
                                    </h1>
                                    <p className="mt-3 text-base text-joy-ink-muted">
                                        {t.intro}
                                    </p>
                                </header>

                                {justSaved ? (
                                    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-joy-grass/30 bg-joy-grass-bright/10 p-4">
                                        <Heart className="mt-0.5 h-5 w-5 shrink-0 text-joy-grass" aria-hidden="true" />
                                        <p className="text-sm font-medium text-joy-ink">
                                            {t.justSaved}
                                        </p>
                                    </div>
                                ) : null}

                                <div className="space-y-4">
                                    {DIMENSION_KEYS.map((key) => (
                                        <LikertRow
                                            key={key}
                                            label={t.dimensions[key].label}
                                            prompt={t.dimensions[key].prompt}
                                            lowLabel={t.likertLow}
                                            highLabel={t.likertHigh}
                                            value={ratings[key]}
                                            onChange={(v) => setRating(key, v)}
                                        />
                                    ))}

                                    <TopThreePicker
                                        topThree={topThree}
                                        onToggle={toggleTopThree}
                                        labelOf={labelOf}
                                        t={t}
                                    />
                                </div>

                                <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <button
                                        type="button"
                                        onClick={() => navigate("/account")}
                                        className="text-sm font-semibold text-joy-ink-muted hover:text-joy-ink"
                                    >
                                        {t.back}
                                    </button>
                                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                                        <PlaygroundButton
                                            type="submit"
                                            className={!canSubmit ? "opacity-50" : ""}
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                                    {t.saving}
                                                </>
                                            ) : hasExisting ? (
                                                t.submitUpdate
                                            ) : (
                                                t.submitNew
                                            )}
                                        </PlaygroundButton>
                                        {!canSubmit && !submitting ? (
                                            <p className="text-xs text-joy-ink-muted">
                                                {!allRated
                                                    ? t.helperRateAll
                                                    : t.helperPickTop3}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </section>
            </PlaygroundShell>
        </div>
    );
}
