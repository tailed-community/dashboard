import type { SelfIdSubmission } from "@/lib/surveys";

/**
 * Bilingual copy for the anonymous self-identification survey (spec 08 §3.3,
 * §6.1). Selected by the student's `preferredLanguage` (fetched via the survey
 * status GET, defaulting to "en"). NOT routed through Paraglide — the global UI
 * locale stays English; this drives student communications only.
 *
 * CRITICAL — Canadian bilingual terminology: the French labels use OFFICIAL
 * Statistics Canada / Employment Equity wording, NOT a loose translation
 * (Premières Nations, Métis, Inuk (Inuit), Peuples autochtones, personnes
 * racisées, StatCan population-group labels, personne en situation de handicap,
 * official province/territory names). The consent screen's anonymity /
 * voluntariness language is accurate and reassuring in FR.
 *
 * CRITICAL — machine values are byte-identical across languages. The option maps
 * below are keyed by the enum VALUE submitted to the backend (e.g. "man",
 * "south-asian", "british-columbia"); only the label (the map value) is
 * translated. The page builds its `Choice[]` from these, never re-deriving a
 * value from a language.
 *
 * `type Copy = typeof COPY.en` + the `fr: Copy` annotation makes any
 * missing/renamed key a compile error, so the two languages cannot drift.
 *
 * Register: warm, natural Canadian French, tutoiement ("tu"); consent/legal
 * phrasing stays precise even while warm.
 */

/** A run of consent text; `b: true` marks a bolded (reassurance) segment. */
export type Seg = { t: string; b?: boolean };

type GenderValue = NonNullable<SelfIdSubmission["gender"]>;
type YesNoValue = "yes" | "no" | "prefer-not-to-say";
type IndigenousValue = NonNullable<SelfIdSubmission["indigenousIdentity"]>[number];
type PopulationValue = NonNullable<SelfIdSubmission["populationGroups"]>[number];
type NewcomerValue = NonNullable<SelfIdSubmission["newcomerStatus"]>;
type AgeValue = NonNullable<SelfIdSubmission["ageBand"]>;
type RegionValue =
  | "alberta"
  | "british-columbia"
  | "manitoba"
  | "new-brunswick"
  | "newfoundland-and-labrador"
  | "northwest-territories"
  | "nova-scotia"
  | "nunavut"
  | "ontario"
  | "prince-edward-island"
  | "quebec"
  | "saskatchewan"
  | "yukon"
  | "prefer-not-to-say";

const en = {
  seoTitle: "A few optional questions",
  seoDescription: "An anonymous, voluntary self-identification survey.",
  headerTitle: "A few optional questions",
  headerIntro:
    "Answer only what you're comfortable sharing — every question can be skipped, and your answers are never linked to your profile.",
  /** Prefix rendered before the question number, e.g. "Q1." */
  qPrefix: "Q",
  questions: {
    q1: {
      title: "What is your gender?",
      hint: "Separate from the sex you were assigned at birth.",
    },
    q2: {
      title: "Do you consider yourself to be transgender?",
      hint: "Optional.",
    },
    q3: {
      title: "Are you First Nations, Métis, or Inuk (Inuit)?",
      hint: "Indigenous peoples — mark all that apply.",
    },
    q4: {
      title: "Which population group(s) do you belong to?",
      hint: "Racialized people — mark all that apply.",
    },
    q5: {
      title: "Do you identify as a person with a disability?",
      hint: "A disability may be physical, sensory, mental health, cognitive, learning, or a chronic health condition, and may be visible or non-visible.",
    },
    q6: {
      title:
        "Would you be the first in your immediate family to complete a college or university degree?",
      hint: "Optional.",
    },
    q7: {
      title: "Which best describes you?",
      hint: "Optional.",
    },
    q8: {
      title: "What is your age range?",
    },
    q9: {
      title: "Which province or territory do you study in?",
    },
  },
  // Free-text placeholder shown for gender "self-described" and population "other".
  specify: "Please specify",
  options: {
    gender: {
      man: "Man",
      woman: "Woman",
      "self-described": "Or please specify",
      "prefer-not-to-say": "Prefer not to say",
    } satisfies Record<GenderValue, string>,
    yesNo: {
      yes: "Yes",
      no: "No",
      "prefer-not-to-say": "Prefer not to say",
    } satisfies Record<YesNoValue, string>,
    indigenous: {
      "first-nations": "First Nations (North American Indian)",
      metis: "Métis",
      inuit: "Inuk (Inuit)",
      "not-indigenous": "No, not an Indigenous person",
      "prefer-not-to-say": "Prefer not to say",
    } satisfies Record<IndigenousValue, string>,
    population: {
      white: "White",
      "south-asian": "South Asian (e.g., East Indian, Pakistani, Sri Lankan)",
      chinese: "Chinese",
      black: "Black",
      filipino: "Filipino",
      arab: "Arab",
      "latin-american": "Latin American",
      "southeast-asian": "Southeast Asian (e.g., Vietnamese, Cambodian, Thai)",
      "west-asian": "West Asian (e.g., Iranian, Afghan)",
      korean: "Korean",
      japanese: "Japanese",
      other: "Other — please specify",
      "prefer-not-to-say": "Prefer not to say",
    } satisfies Record<PopulationValue, string>,
    newcomer: {
      "born-in-canada": "Born in Canada",
      immigrant: "Immigrant to Canada (now a citizen or permanent resident)",
      "temporary-resident": "Temporary resident (e.g., study or work permit)",
      "prefer-not-to-say": "Prefer not to say",
    } satisfies Record<NewcomerValue, string>,
    age: {
      "under-18": "Under 18",
      "18-20": "18–20",
      "21-24": "21–24",
      "25-29": "25–29",
      "30-plus": "30 or older",
      "prefer-not-to-say": "Prefer not to say",
    } satisfies Record<AgeValue, string>,
    region: {
      alberta: "Alberta",
      "british-columbia": "British Columbia",
      manitoba: "Manitoba",
      "new-brunswick": "New Brunswick",
      "newfoundland-and-labrador": "Newfoundland and Labrador",
      "northwest-territories": "Northwest Territories",
      "nova-scotia": "Nova Scotia",
      nunavut: "Nunavut",
      ontario: "Ontario",
      "prince-edward-island": "Prince Edward Island",
      quebec: "Quebec",
      saskatchewan: "Saskatchewan",
      yukon: "Yukon",
      "prefer-not-to-say": "Prefer not to say",
    } satisfies Record<RegionValue, string>,
  },
  notNow: "Not now",
  submitShare: "Share anonymously",
  sharing: "Sharing…",
  footer: "Anonymous · never linked to your profile · never shown to employers",
  toastErrorTitle: "Couldn't submit",
  errorRetry: "Please try again",
  consent: {
    title: "Before we start",
    p1: [
      { t: "These questions are " },
      { t: "completely voluntary", b: true },
      { t: " and " },
      { t: "anonymous", b: true },
      { t: ". Your answers are " },
      { t: "never linked to your profile", b: true },
      { t: " and are " },
      { t: "never shown to employers", b: true },
      { t: "." },
    ] as Seg[],
    p2: [
      {
        t: "We ask so we can better support students from all backgrounds and share honest ",
      },
      { t: "aggregate", b: true },
      {
        t: " insight about who's entering the Canadian workforce — ",
      },
      { t: "never to screen anyone", b: true },
      { t: "." },
    ] as Seg[],
    p3: [
      { t: "Because your response is truly anonymous, it " },
      { t: "can't be traced back to you to edit or delete later", b: true },
      {
        t: " — that's exactly what keeps it anonymous. You can skip any question.",
      },
    ] as Seg[],
    decline: "Not now",
    accept: "I understand and consent — continue",
  },
  thankYou: {
    title: "Thank you — truly 💛",
    body: "Your answers help us support students from every background and paint an honest, aggregate picture of who's entering the Canadian workforce. They're anonymous and won't be shown to anyone individually.",
    back: "Back to your account",
  },
  closed: {
    title: "You've already shared — thank you",
    body: "This survey is answered once and, because it's completely anonymous, your response can't be traced back to be changed — that's what keeps it anonymous. Nothing more to do here.",
    back: "Back to your account",
  },
};

type Copy = typeof en;

const fr: Copy = {
  seoTitle: "Quelques questions facultatives",
  seoDescription:
    "Un sondage d'auto-identification anonyme et volontaire.",
  headerTitle: "Quelques questions facultatives",
  headerIntro:
    "Réponds seulement à ce que tu es à l'aise de partager — chaque question peut être ignorée, et tes réponses ne sont jamais liées à ton profil.",
  qPrefix: "Q",
  questions: {
    q1: {
      title: "Quel est ton genre?",
      hint: "Distinct du sexe qui t'a été assigné à la naissance.",
    },
    q2: {
      title: "Te considères-tu comme une personne transgenre?",
      hint: "Facultatif.",
    },
    q3: {
      title: "Es-tu des Premières Nations, Métis ou Inuk (Inuit)?",
      hint: "Peuples autochtones — coche toutes les réponses qui s'appliquent.",
    },
    q4: {
      title: "À quel(s) groupe(s) de population appartiens-tu?",
      hint: "Personnes racisées — coche toutes les réponses qui s'appliquent.",
    },
    q5: {
      title: "Te considères-tu comme une personne en situation de handicap?",
      hint: "Un handicap peut être physique, sensoriel, lié à la santé mentale, cognitif, d'apprentissage ou une affection chronique, et peut être visible ou non visible.",
    },
    q6: {
      title:
        "Serais-tu la première personne de ta famille immédiate à obtenir un diplôme collégial ou universitaire?",
      hint: "Facultatif.",
    },
    q7: {
      title: "Quel énoncé te décrit le mieux?",
      hint: "Facultatif.",
    },
    q8: {
      title: "Quelle est ta tranche d'âge?",
    },
    q9: {
      title: "Dans quelle province ou quel territoire étudies-tu?",
    },
  },
  specify: "Veuillez préciser",
  options: {
    gender: {
      man: "Homme",
      woman: "Femme",
      "self-described": "Ou veuillez préciser",
      "prefer-not-to-say": "Je préfère ne pas répondre",
    } satisfies Record<GenderValue, string>,
    yesNo: {
      yes: "Oui",
      no: "Non",
      "prefer-not-to-say": "Je préfère ne pas répondre",
    } satisfies Record<YesNoValue, string>,
    indigenous: {
      "first-nations": "Premières Nations (Indien de l'Amérique du Nord)",
      metis: "Métis",
      inuit: "Inuk (Inuit)",
      "not-indigenous": "Non, je ne suis pas une personne autochtone",
      "prefer-not-to-say": "Je préfère ne pas répondre",
    } satisfies Record<IndigenousValue, string>,
    population: {
      white: "Blanche",
      "south-asian": "Sud-Asiatique (p. ex. Indienne de l'Inde, Pakistanaise, Sri-Lankaise)",
      chinese: "Chinoise",
      black: "Noire",
      filipino: "Philippine",
      arab: "Arabe",
      "latin-american": "Latino-Américaine",
      "southeast-asian": "Asiatique du Sud-Est (p. ex. Vietnamienne, Cambodgienne, Thaïlandaise)",
      "west-asian": "Asiatique occidentale (p. ex. Iranienne, Afghane)",
      korean: "Coréenne",
      japanese: "Japonaise",
      other: "Autre — veuillez préciser",
      "prefer-not-to-say": "Je préfère ne pas répondre",
    } satisfies Record<PopulationValue, string>,
    newcomer: {
      "born-in-canada": "Né·e au Canada",
      immigrant:
        "Immigrant·e au Canada (maintenant citoyen·ne ou résident·e permanent·e)",
      "temporary-resident":
        "Résident·e temporaire (p. ex. permis d'études ou de travail)",
      "prefer-not-to-say": "Je préfère ne pas répondre",
    } satisfies Record<NewcomerValue, string>,
    age: {
      "under-18": "Moins de 18 ans",
      "18-20": "18–20 ans",
      "21-24": "21–24 ans",
      "25-29": "25–29 ans",
      "30-plus": "30 ans ou plus",
      "prefer-not-to-say": "Je préfère ne pas répondre",
    } satisfies Record<AgeValue, string>,
    region: {
      alberta: "Alberta",
      "british-columbia": "Colombie-Britannique",
      manitoba: "Manitoba",
      "new-brunswick": "Nouveau-Brunswick",
      "newfoundland-and-labrador": "Terre-Neuve-et-Labrador",
      "northwest-territories": "Territoires du Nord-Ouest",
      "nova-scotia": "Nouvelle-Écosse",
      nunavut: "Nunavut",
      ontario: "Ontario",
      "prince-edward-island": "Île-du-Prince-Édouard",
      quebec: "Québec",
      saskatchewan: "Saskatchewan",
      yukon: "Yukon",
      "prefer-not-to-say": "Je préfère ne pas répondre",
    } satisfies Record<RegionValue, string>,
  },
  notNow: "Plus tard",
  submitShare: "Partager anonymement",
  sharing: "Partage en cours…",
  footer:
    "Anonyme · jamais lié à ton profil · jamais montré aux employeurs",
  toastErrorTitle: "Envoi impossible",
  errorRetry: "Réessaie, s'il te plaît",
  consent: {
    title: "Avant de commencer",
    p1: [
      { t: "Ces questions sont " },
      { t: "entièrement volontaires", b: true },
      { t: " et " },
      { t: "anonymes", b: true },
      { t: ". Tes réponses ne sont " },
      { t: "jamais liées à ton profil", b: true },
      { t: " et ne sont " },
      { t: "jamais montrées aux employeurs", b: true },
      { t: "." },
    ] as Seg[],
    p2: [
      {
        t: "On te les pose pour mieux soutenir les étudiant·es de tous les horizons et partager un portrait honnête et ",
      },
      { t: "agrégé", b: true },
      {
        t: " des personnes qui font leur entrée sur le marché du travail canadien — ",
      },
      { t: "jamais pour écarter qui que ce soit", b: true },
      { t: "." },
    ] as Seg[],
    p3: [
      { t: "Parce que ta réponse est vraiment anonyme, elle " },
      {
        t: "ne peut pas être retracée jusqu'à toi pour être modifiée ou supprimée plus tard",
        b: true,
      },
      {
        t: " — c'est exactement ce qui la garde anonyme. Tu peux ignorer n'importe quelle question.",
      },
    ] as Seg[],
    decline: "Plus tard",
    accept: "Je comprends et je consens — continuer",
  },
  thankYou: {
    title: "Merci — sincèrement 💛",
    body: "Tes réponses nous aident à soutenir les étudiant·es de tous les horizons et à dresser un portrait honnête et agrégé des personnes qui font leur entrée sur le marché du travail canadien. Elles sont anonymes et ne seront montrées à personne de façon individuelle.",
    back: "Retour à ton compte",
  },
  closed: {
    title: "Tu as déjà répondu — merci",
    body: "Ce sondage se remplit une seule fois et, parce qu'il est entièrement anonyme, ta réponse ne peut pas être retracée pour être modifiée — c'est ce qui la garde anonyme. Il n'y a rien de plus à faire ici.",
    back: "Retour à ton compte",
  },
};

export const SELF_ID_COPY = { en, fr } as const;
