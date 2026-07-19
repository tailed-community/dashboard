import type { WorkplaceValues } from "@/lib/profile";

/**
 * Bilingual copy for the workplace-values survey (spec 08 §3.4, §6.2).
 *
 * Colocated EN/FR copy selected by the student's `preferredLanguage` (fetched via
 * the survey GET, defaulting to "en"). NOT routed through Paraglide — the global
 * UI locale stays English; this drives student communications only. `type Copy =
 * typeof COPY.en` + the `fr: Copy` annotation makes any missing/renamed key a
 * compile error, so the two languages cannot drift.
 *
 * CRITICAL: only display strings live here. The 10 dimension KEYS
 * (`careerDevelopment`, `compensation`, …) submitted to the backend are byte-
 * identical across languages — we translate the `label`/`prompt`, never the key.
 *
 * Register: warm, natural Canadian French, tutoiement ("tu").
 */

type DimensionKey = keyof WorkplaceValues["perDimension"];

const en = {
  seoTitle: "What you value at work",
  seoDescription: "Tell us what matters most to you in an employer.",
  badge: "About 3 minutes",
  titleNew: "What matters to you at work",
  titleUpdate: "Update what you value",
  intro:
    "Rate how much each matters to you in an employer (1 = not important, 5 = extremely important). We use this to surface roles that fit what you care about — and you can change your answers anytime.",
  justSaved:
    "Saved — thank you. Your answers help us match you to employers who fit what you value. Come back and update this whenever it changes.",
  /** Per-dimension label + Likert prompt. Keys are machine values — never translated. */
  dimensions: {
    careerDevelopment: {
      label: "Career development",
      prompt: "Opportunities to learn, grow, and advance my career",
    },
    compensation: {
      label: "Compensation",
      prompt: "Competitive pay and financial benefits",
    },
    workLifeBalance: {
      label: "Work-life balance",
      prompt: "Work-life balance and flexibility (hours, remote/hybrid)",
    },
    jobSecurity: {
      label: "Job security",
      prompt: "Job security and stability",
    },
    missionPurpose: {
      label: "Mission & purpose",
      prompt: "A mission and purpose I believe in / positive societal impact",
    },
    dei: {
      label: "Diversity & belonging",
      prompt: "Diversity, equity, inclusion, and a sense of belonging",
    },
    culturePeople: {
      label: "Culture & people",
      prompt: "A supportive culture and people I enjoy working with",
    },
    prestige: {
      label: "Prestige",
      prompt: "Prestige and reputation of the employer",
    },
    meaningfulWork: {
      label: "Meaningful work",
      prompt: "Interesting, meaningful, and challenging work",
    },
    wellbeingSupport: {
      label: "Wellbeing support",
      prompt: "Mental-health and wellbeing support",
    },
  } satisfies Record<DimensionKey, { label: string; prompt: string }>,
  likertLow: "1 · Not important",
  likertHigh: "5 · Extremely important",
  topThreeLegend: "Your top 3",
  // Split so the component can bold the middle emphasis segment.
  topThreePromptBefore: "Of everything above, choose the ",
  topThreeEmphasis: "3 that matter most",
  topThreePromptAfter:
    " and put them in order — tap to add (1 = most important), tap again to remove.",
  back: "Back to your account",
  submitNew: "Save what you value",
  submitUpdate: "Update what you value",
  saving: "Saving…",
  helperRateAll: "Rate all 10 to continue",
  helperPickTop3: "Pick your top 3 to continue",
  toastSaved: "Saved — thanks for sharing what you value 💛",
  toastErrorTitle: "Couldn't save",
  errorRetry: "Please try again",
};

type Copy = typeof en;

const fr: Copy = {
  seoTitle: "Ce qui compte pour toi au travail",
  seoDescription: "Dis-nous ce qui compte le plus pour toi chez un employeur.",
  badge: "Environ 3 minutes",
  titleNew: "Ce qui compte pour toi au travail",
  titleUpdate: "Mets à jour ce qui compte pour toi",
  intro:
    "Évalue à quel point chaque élément compte pour toi chez un employeur (1 = pas important, 5 = extrêmement important). On s'en sert pour te proposer des postes qui correspondent à ce qui te tient à cœur — et tu peux modifier tes réponses en tout temps.",
  justSaved:
    "Enregistré — merci. Tes réponses nous aident à te jumeler à des employeurs qui correspondent à ce que tu valorises. Reviens le mettre à jour dès que ça change.",
  dimensions: {
    careerDevelopment: {
      label: "Développement de carrière",
      prompt: "Des occasions d'apprendre, de grandir et de faire avancer ma carrière",
    },
    compensation: {
      label: "Rémunération",
      prompt: "Un salaire concurrentiel et des avantages financiers",
    },
    workLifeBalance: {
      label: "Conciliation travail-vie",
      prompt: "L'équilibre travail-vie et la flexibilité (horaire, télétravail/hybride)",
    },
    jobSecurity: {
      label: "Sécurité d'emploi",
      prompt: "La sécurité et la stabilité d'emploi",
    },
    missionPurpose: {
      label: "Mission et raison d'être",
      prompt: "Une mission et une raison d'être auxquelles je crois / un impact positif sur la société",
    },
    dei: {
      label: "Diversité et appartenance",
      prompt: "La diversité, l'équité, l'inclusion et un sentiment d'appartenance",
    },
    culturePeople: {
      label: "Culture et collègues",
      prompt: "Une culture bienveillante et des collègues avec qui j'aime travailler",
    },
    prestige: {
      label: "Prestige",
      prompt: "Le prestige et la réputation de l'employeur",
    },
    meaningfulWork: {
      label: "Travail qui a du sens",
      prompt: "Un travail intéressant, stimulant et qui a du sens",
    },
    wellbeingSupport: {
      label: "Soutien au bien-être",
      prompt: "Le soutien en santé mentale et en bien-être",
    },
  } satisfies Record<DimensionKey, { label: string; prompt: string }>,
  likertLow: "1 · Pas important",
  likertHigh: "5 · Extrêmement important",
  topThreeLegend: "Ton top 3",
  topThreePromptBefore: "Parmi tout ce qui précède, choisis les ",
  topThreeEmphasis: "3 qui comptent le plus",
  topThreePromptAfter:
    " et mets-les en ordre — tape pour ajouter (1 = le plus important), tape de nouveau pour retirer.",
  back: "Retour à ton compte",
  submitNew: "Enregistrer ce qui compte",
  submitUpdate: "Mettre à jour ce qui compte",
  saving: "Enregistrement…",
  helperRateAll: "Évalue les 10 pour continuer",
  helperPickTop3: "Choisis ton top 3 pour continuer",
  toastSaved: "Enregistré — merci d'avoir partagé ce qui compte pour toi 💛",
  toastErrorTitle: "Enregistrement impossible",
  errorRetry: "Réessaie, s'il te plaît",
};

export const VALUES_COPY = { en, fr } as const;
