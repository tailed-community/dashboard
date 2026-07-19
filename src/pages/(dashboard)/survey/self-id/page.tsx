import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Heart, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/seo";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import {
    getSelfIdStatus,
    submitSelfIdSurvey,
    type SelfIdSubmission,
} from "@/lib/surveys";
import { SELF_ID_COPY, type Seg } from "./copy";

type Copy = (typeof SELF_ID_COPY)["en"];

/*
 * Anonymous self-identification survey (spec 08 §3.3, §6.1).
 *
 * Consent-first (express opt-in), then Q1–Q9. Every question offers "Prefer not
 * to say"; multi-group questions accept multiple selections. On submit we call
 * the decoupled API and rely on the profile flag flip (the account card reads
 * `demographicSurveyCompletedAt`). One-time: if already completed, we show the
 * closed / thank-you state instead of the form — the survey can't be retaken.
 *
 * Copy is hardcoded EN — FR is a flagged follow-up build task (spec 08 §5 / §8).
 */

// ── Option sets ──────────────────────────────────────────────────────────────
// The VALUES and their display order are canonical machine values (they mirror
// the server enums in functions/src/routes/surveys.ts) and are language-
// independent. The LABEL shown for each value comes from the bilingual copy
// (`./copy`) and is looked up by value inside the component, so translating a
// label can never change what gets submitted.

type Choice<V extends string> = { value: V; label: string };

type GenderValue = NonNullable<SelfIdSubmission["gender"]>;
type YesNoValue = "yes" | "no" | "prefer-not-to-say";
type IndigenousValue = NonNullable<SelfIdSubmission["indigenousIdentity"]>[number];
type PopulationValue = NonNullable<SelfIdSubmission["populationGroups"]>[number];
type NewcomerValue = NonNullable<SelfIdSubmission["newcomerStatus"]>;
type AgeValue = NonNullable<SelfIdSubmission["ageBand"]>;
type RegionValue = keyof Copy["options"]["region"];

const GENDER_VALUES: GenderValue[] = [
    "man",
    "woman",
    "self-described",
    "prefer-not-to-say",
];
const YES_NO_VALUES: YesNoValue[] = ["yes", "no", "prefer-not-to-say"];
const INDIGENOUS_VALUES: IndigenousValue[] = [
    "first-nations",
    "metis",
    "inuit",
    "not-indigenous",
    "prefer-not-to-say",
];
const POPULATION_VALUES: PopulationValue[] = [
    "white",
    "south-asian",
    "chinese",
    "black",
    "filipino",
    "arab",
    "latin-american",
    "southeast-asian",
    "west-asian",
    "korean",
    "japanese",
    "other",
    "prefer-not-to-say",
];
const NEWCOMER_VALUES: NewcomerValue[] = [
    "born-in-canada",
    "immigrant",
    "temporary-resident",
    "prefer-not-to-say",
];
const AGE_VALUES: AgeValue[] = [
    "under-18",
    "18-20",
    "21-24",
    "25-29",
    "30-plus",
    "prefer-not-to-say",
];
/** Full Canadian province/territory list for Q9 (values match the server VALID_REGIONS set). */
const REGION_VALUES: RegionValue[] = [
    "alberta",
    "british-columbia",
    "manitoba",
    "new-brunswick",
    "newfoundland-and-labrador",
    "northwest-territories",
    "nova-scotia",
    "nunavut",
    "ontario",
    "prince-edward-island",
    "quebec",
    "saskatchewan",
    "yukon",
    "prefer-not-to-say",
];

/** Build a `Choice[]` by pairing each canonical value with its translated label. */
function choices<V extends string>(
    values: V[],
    labels: Record<V, string>,
): Choice<V>[] {
    return values.map((value) => ({ value, label: labels[value] }));
}

// ── Small presentational primitives ─────────────────────────────────────────

function QuestionBlock({
    n,
    prefix,
    title,
    hint,
    children,
}: {
    n: number;
    prefix: string;
    title: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <fieldset className="rounded-2xl border border-joy-ink/8 bg-white p-5 shadow-sm">
            <legend className="joy-display px-1 text-base font-extrabold text-joy-ink">
                <span className="text-joy-ink-muted">{prefix}{n}. </span>
                {title}
            </legend>
            {hint ? <p className="mt-1 text-sm text-joy-ink-muted">{hint}</p> : null}
            <div className="mt-4">{children}</div>
        </fieldset>
    );
}

/** Single-choice pill group. Selecting the already-selected value clears it (all questions skippable). */
function SingleChoice<V extends string>({
    name,
    options,
    value,
    onChange,
}: {
    name: string;
    options: Choice<V>[];
    value: V | undefined;
    onChange: (v: V | undefined) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
            {options.map((opt) => {
                const selected = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(selected ? undefined : opt.value)}
                        className={
                            "rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 " +
                            (selected
                                ? "border-joy-grass bg-joy-grass text-white"
                                : "border-joy-ink/12 bg-white text-joy-ink hover:border-joy-grass/50")
                        }
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

/** Mark-all-that-apply checkbox group. */
function MultiChoice<V extends string>({
    name,
    options,
    values,
    onToggle,
}: {
    name: string;
    options: Choice<V>[];
    values: V[];
    onToggle: (v: V) => void;
}) {
    return (
        <div className="flex flex-col gap-2" role="group" aria-label={name}>
            {options.map((opt) => {
                const checked = values.includes(opt.value);
                return (
                    <label
                        key={opt.value}
                        className={
                            "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition " +
                            (checked
                                ? "border-joy-grass bg-joy-grass-bright/10 text-joy-ink"
                                : "border-joy-ink/12 bg-white text-joy-ink hover:border-joy-grass/50")
                        }
                    >
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggle(opt.value)}
                            className="h-4 w-4 shrink-0 accent-joy-grass"
                        />
                        {opt.label}
                    </label>
                );
            })}
        </div>
    );
}

// ── The page ────────────────────────────────────────────────────────────────

type Phase = "loading" | "closed" | "consent" | "questions" | "done";

export default function SelfIdSurveyPage() {
    const navigate = useNavigate();
    const [phase, setPhase] = useState<Phase>("loading");
    const [submitting, setSubmitting] = useState(false);
    // Communication-language preference (spec 08 §5.1), fetched with the status.
    // Defaults to English until the GET resolves; NOT the global UI locale.
    const [lang, setLang] = useState<"en" | "fr">("en");
    const t = SELF_ID_COPY[lang];

    // Answers.
    const [gender, setGender] = useState<SelfIdSubmission["gender"]>();
    const [genderSelfDescribed, setGenderSelfDescribed] = useState("");
    const [transStatus, setTransStatus] = useState<SelfIdSubmission["transStatus"]>();
    const [indigenous, setIndigenous] = useState<
        NonNullable<SelfIdSubmission["indigenousIdentity"]>
    >([]);
    const [population, setPopulation] = useState<
        NonNullable<SelfIdSubmission["populationGroups"]>
    >([]);
    const [populationOther, setPopulationOther] = useState("");
    const [disability, setDisability] = useState<SelfIdSubmission["disability"]>();
    const [firstGeneration, setFirstGeneration] = useState<SelfIdSubmission["firstGeneration"]>();
    const [newcomer, setNewcomer] = useState<SelfIdSubmission["newcomerStatus"]>();
    const [ageBand, setAgeBand] = useState<SelfIdSubmission["ageBand"]>();
    const [region, setRegion] = useState<string>("");

    // One-time gate: if already completed, show the closed state, never the form.
    useEffect(() => {
        let cancelled = false;
        getSelfIdStatus()
            .then((status) => {
                if (cancelled) return;
                setLang(status.preferredLanguage);
                setPhase(status.completed ? "closed" : "consent");
            })
            .catch(() => {
                // If we can't read status, fail open to the consent screen — the
                // backend still enforces one-time (409) on submit.
                if (!cancelled) setPhase("consent");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const toggleIndigenous = (v: (typeof indigenous)[number]) =>
        setIndigenous((prev) =>
            prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
        );
    const togglePopulation = (v: (typeof population)[number]) =>
        setPopulation((prev) =>
            prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
        );

    const submission = useMemo<SelfIdSubmission>(() => {
        const s: SelfIdSubmission = {};
        if (gender) s.gender = gender;
        if (gender === "self-described" && genderSelfDescribed.trim()) {
            s.genderSelfDescribed = genderSelfDescribed.trim();
        }
        if (transStatus) s.transStatus = transStatus;
        if (indigenous.length) s.indigenousIdentity = indigenous;
        if (population.length) s.populationGroups = population;
        if (population.includes("other") && populationOther.trim()) {
            s.populationGroupOther = populationOther.trim();
        }
        if (disability) s.disability = disability;
        if (firstGeneration) s.firstGeneration = firstGeneration;
        if (newcomer) s.newcomerStatus = newcomer;
        if (ageBand) s.ageBand = ageBand;
        if (region) s.region = region;
        return s;
    }, [
        gender,
        genderSelfDescribed,
        transStatus,
        indigenous,
        population,
        populationOther,
        disability,
        firstGeneration,
        newcomer,
        ageBand,
        region,
    ]);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await submitSelfIdSurvey(submission);
            setPhase("done");
        } catch (error) {
            const message = error instanceof Error ? error.message : t.errorRetry;
            if (message.toLowerCase().includes("already completed")) {
                // Raced / already done elsewhere — treat as closed, never retake.
                setPhase("closed");
            } else {
                toast.error(t.toastErrorTitle, { description: message });
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Translated option lists — canonical values paired with the current
    // language's labels (values never change with language).
    const genderOptions = choices(GENDER_VALUES, t.options.gender);
    const yesNoOptions = choices(YES_NO_VALUES, t.options.yesNo);
    const indigenousOptions = choices(INDIGENOUS_VALUES, t.options.indigenous);
    const populationOptions = choices(POPULATION_VALUES, t.options.population);
    const newcomerOptions = choices(NEWCOMER_VALUES, t.options.newcomer);
    const ageOptions = choices(AGE_VALUES, t.options.age);
    const regionOptions = choices(REGION_VALUES, t.options.region);

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
                        ) : phase === "closed" ? (
                            <ClosedState t={t} onLeave={() => navigate("/account")} />
                        ) : phase === "done" ? (
                            <ThankYouState t={t} onLeave={() => navigate("/account")} />
                        ) : phase === "consent" ? (
                            <ConsentScreen
                                t={t}
                                onConsent={() => setPhase("questions")}
                                onDecline={() => navigate("/account")}
                            />
                        ) : (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void handleSubmit();
                                }}
                            >
                                <header className="mb-6">
                                    <h1 className="joy-display text-3xl font-extrabold leading-[1.08] tracking-tight text-joy-ink">
                                        {t.headerTitle}
                                    </h1>
                                    <p className="mt-3 text-base text-joy-ink-muted">
                                        {t.headerIntro}
                                    </p>
                                </header>

                                <div className="space-y-4">
                                    <QuestionBlock n={1} prefix={t.qPrefix} title={t.questions.q1.title} hint={t.questions.q1.hint}>
                                        <SingleChoice name="gender" options={genderOptions} value={gender} onChange={setGender} />
                                        {gender === "self-described" ? (
                                            <input
                                                type="text"
                                                value={genderSelfDescribed}
                                                onChange={(e) => setGenderSelfDescribed(e.target.value)}
                                                maxLength={120}
                                                placeholder={t.specify}
                                                className="mt-3 w-full rounded-xl border border-joy-ink/12 bg-white px-4 py-2.5 text-sm text-joy-ink outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                            />
                                        ) : null}
                                    </QuestionBlock>

                                    <QuestionBlock n={2} prefix={t.qPrefix} title={t.questions.q2.title} hint={t.questions.q2.hint}>
                                        <SingleChoice name="transStatus" options={yesNoOptions} value={transStatus} onChange={setTransStatus} />
                                    </QuestionBlock>

                                    <QuestionBlock n={3} prefix={t.qPrefix} title={t.questions.q3.title} hint={t.questions.q3.hint}>
                                        <MultiChoice name="indigenousIdentity" options={indigenousOptions} values={indigenous} onToggle={toggleIndigenous} />
                                    </QuestionBlock>

                                    <QuestionBlock n={4} prefix={t.qPrefix} title={t.questions.q4.title} hint={t.questions.q4.hint}>
                                        <MultiChoice name="populationGroups" options={populationOptions} values={population} onToggle={togglePopulation} />
                                        {population.includes("other") ? (
                                            <input
                                                type="text"
                                                value={populationOther}
                                                onChange={(e) => setPopulationOther(e.target.value)}
                                                maxLength={120}
                                                placeholder={t.specify}
                                                className="mt-3 w-full rounded-xl border border-joy-ink/12 bg-white px-4 py-2.5 text-sm text-joy-ink outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                            />
                                        ) : null}
                                    </QuestionBlock>

                                    <QuestionBlock
                                        n={5}
                                        prefix={t.qPrefix}
                                        title={t.questions.q5.title}
                                        hint={t.questions.q5.hint}
                                    >
                                        <SingleChoice name="disability" options={yesNoOptions} value={disability} onChange={setDisability} />
                                    </QuestionBlock>

                                    <QuestionBlock n={6} prefix={t.qPrefix} title={t.questions.q6.title} hint={t.questions.q6.hint}>
                                        <SingleChoice name="firstGeneration" options={yesNoOptions} value={firstGeneration} onChange={setFirstGeneration} />
                                    </QuestionBlock>

                                    <QuestionBlock n={7} prefix={t.qPrefix} title={t.questions.q7.title} hint={t.questions.q7.hint}>
                                        <SingleChoice name="newcomerStatus" options={newcomerOptions} value={newcomer} onChange={setNewcomer} />
                                    </QuestionBlock>

                                    <QuestionBlock n={8} prefix={t.qPrefix} title={t.questions.q8.title}>
                                        <SingleChoice name="ageBand" options={ageOptions} value={ageBand} onChange={setAgeBand} />
                                    </QuestionBlock>

                                    <QuestionBlock n={9} prefix={t.qPrefix} title={t.questions.q9.title}>
                                        <SingleChoice name="region" options={regionOptions} value={(region || undefined) as RegionValue | undefined} onChange={(v) => setRegion(v ?? "")} />
                                    </QuestionBlock>
                                </div>

                                <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <button
                                        type="button"
                                        onClick={() => navigate("/account")}
                                        className="text-sm font-semibold text-joy-ink-muted hover:text-joy-ink"
                                    >
                                        {t.notNow}
                                    </button>
                                    <PlaygroundButton type="submit" className={submitting ? "opacity-70" : ""}>
                                        {submitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                                {t.sharing}
                                            </>
                                        ) : (
                                            t.submitShare
                                        )}
                                    </PlaygroundButton>
                                </div>

                                <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-joy-ink-muted">
                                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                    {t.footer}
                                </p>
                            </form>
                        )}
                    </div>
                </section>
            </PlaygroundShell>
        </div>
    );
}

// ── Consent (express opt-in) — spec §6.1 consent block ──────────────────────

/** Render a run of consent segments, bolding the reassurance parts. */
function ConsentText({ segs, boldClass }: { segs: Seg[]; boldClass?: string }) {
    return (
        <>
            {segs.map((seg, i) =>
                seg.b ? (
                    <strong key={i} className={boldClass}>
                        {seg.t}
                    </strong>
                ) : (
                    <span key={i}>{seg.t}</span>
                ),
            )}
        </>
    );
}

function ConsentScreen({
    t,
    onConsent,
    onDecline,
}: {
    t: Copy;
    onConsent: () => void;
    onDecline: () => void;
}) {
    return (
        <div className="rounded-2xl border border-joy-ink/8 bg-white p-7 shadow-sm sm:p-9">
            <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-joy-grass-bright/15 text-joy-grass">
                    <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                </span>
                <h1 className="joy-display text-2xl font-extrabold leading-tight text-joy-ink sm:text-3xl">
                    {t.consent.title}
                </h1>
            </div>

            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-joy-ink">
                <p>
                    <ConsentText segs={t.consent.p1} />
                </p>
                <p>
                    <ConsentText segs={t.consent.p2} />
                </p>
                <p className="rounded-xl border border-joy-ink/8 bg-joy-surface px-4 py-3 text-joy-ink-muted">
                    <ConsentText segs={t.consent.p3} boldClass="text-joy-ink" />
                </p>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                <button
                    type="button"
                    onClick={onDecline}
                    className="rounded-xl px-5 py-2.5 text-sm font-bold text-joy-ink-muted transition hover:text-joy-ink"
                >
                    {t.consent.decline}
                </button>
                <PlaygroundButton onClick={onConsent}>
                    {t.consent.accept}
                </PlaygroundButton>
            </div>
        </div>
    );
}

// ── Post-submit warm thank-you ──────────────────────────────────────────────

function ThankYouState({ t, onLeave }: { t: Copy; onLeave: () => void }) {
    return (
        <div className="rounded-2xl border border-joy-ink/8 bg-white p-9 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-joy-grass-bright/15 text-joy-grass">
                <Heart className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="joy-display mt-5 text-2xl font-extrabold text-joy-ink sm:text-3xl">
                {t.thankYou.title}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-joy-ink-muted">
                {t.thankYou.body}
            </p>
            <div className="mt-7">
                <PlaygroundButton onClick={onLeave}>{t.thankYou.back}</PlaygroundButton>
            </div>
        </div>
    );
}

// ── Already completed (one-time) closed state ───────────────────────────────

function ClosedState({ t, onLeave }: { t: Copy; onLeave: () => void }) {
    return (
        <div className="rounded-2xl border border-joy-ink/8 bg-white p-9 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-joy-grass-bright/15 text-joy-grass">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="joy-display mt-5 text-2xl font-extrabold text-joy-ink sm:text-3xl">
                {t.closed.title}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-joy-ink-muted">
                {t.closed.body}
            </p>
            <div className="mt-7">
                <PlaygroundButton onClick={onLeave}>{t.closed.back}</PlaygroundButton>
            </div>
        </div>
    );
}
