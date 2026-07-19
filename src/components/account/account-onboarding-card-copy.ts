/**
 * Bilingual copy for the onboarding card (spec 08 §5.1 "Language & localization").
 *
 * Colocated EN/FR copy objects selected by the student's `preferredLanguage`
 * (resolved via `getPreferredLanguage(profile)`). This deliberately does NOT go
 * through Paraglide / `messages/*.json` — the platform's global UI locale stays
 * English; only student communications are bilingual, driven by the profile
 * field. Both languages share one key shape: `type Copy = typeof COPY.en` and the
 * `fr: Copy` annotation makes a missing/renamed key a compile error.
 *
 * Register: warm, natural Canadian French, tutoiement ("tu"), friendly student
 * voice. No machine values live here — only display strings.
 */

const en = {
  header: "Get started",
  /** Progress subtitle, e.g. "2 of 5 done — …". */
  subtitle: (done: number, total: number) =>
    `${done} of ${total} done — a few quick steps to get the most out of Tail'ed`,
  /** Aria-label / tooltip on the dismiss (X) control. */
  hide: "Hide",
  items: {
    profile: "Build your profile so employers and communities can find you",
    /** Alerts item when the student already has ≥1 alert. */
    alertsDone: (count: number) =>
      `You have ${count} job alert${count === 1 ? "" : "s"} — fresh matches in your inbox`,
    alertsTodo: "Set a job alert to get fresh matches in your inbox",
    values: "Tell us what matters to you in an employer",
    selfid: "Help us support students from all backgrounds — anonymously",
    /** Quiet done-state shown once the anonymous self-ID survey is complete. */
    selfidDone: "Thank you 💛",
    involved: "Get involved: join a community or RSVP to an event",
  },
  verbs: {
    profileAdd: "Add",
    alertsSetUp: "Set up",
    alertsManage: "Manage",
    valuesStart: "Start",
    selfidShare: "Share",
    involvedExplore: "Explore",
  },
  celebration: {
    title: "You're all set!",
    body: "Your profile is ready, your alerts are on, and you're part of the community. Nice work — we'll take it from here.",
    done: "Done",
  },
};

type Copy = typeof en;

const fr: Copy = {
  header: "On commence",
  subtitle: (done: number, total: number) =>
    `${done} sur ${total} — quelques étapes rapides pour profiter au max de Tail'ed`,
  hide: "Masquer",
  items: {
    profile:
      "Complète ton profil pour que les employeurs et les communautés te trouvent",
    alertsDone: (count: number) =>
      `Tu as ${count} alerte${count === 1 ? "" : "s"} d'emploi — de nouvelles offres dans ta boîte courriel`,
    alertsTodo:
      "Crée une alerte d'emploi pour recevoir de nouvelles offres dans ta boîte courriel",
    values: "Dis-nous ce qui compte pour toi chez un employeur",
    selfid:
      "Aide-nous à mieux soutenir les étudiant·es de tous les horizons — de façon anonyme",
    selfidDone: "Merci 💛",
    involved:
      "Implique-toi : rejoins une communauté ou inscris-toi à un événement",
  },
  verbs: {
    profileAdd: "Ajouter",
    alertsSetUp: "Configurer",
    alertsManage: "Gérer",
    valuesStart: "Commencer",
    selfidShare: "Partager",
    involvedExplore: "Explorer",
  },
  celebration: {
    title: "Tout est prêt!",
    body: "Ton profil est complet, tes alertes sont activées et tu fais partie de la communauté. Beau travail — on prend le relais.",
    done: "Terminé",
  },
};

export const ONBOARDING_CARD_COPY = { en, fr } as const;
