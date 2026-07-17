import type { Community } from "@/components/community/community-card";

/**
 * Mock communities for the Playground design-lab prototype.
 *
 * Local dev has no running functions server, so `apiFetch("/public/communities")`
 * (and the single-community lookup) always fails there — which meant the
 * Playground communities pages could only ever show their empty/error state.
 * This file is the single source of sample data both
 * `playground-communities.tsx` (the listing grid) and
 * `playground-community-detail.tsx` (the detail page) fall back to when the
 * real backend call fails or comes back empty, so the two pages always agree
 * on shape and content.
 *
 * Shape matches `Community` from `@/components/community/community-card`
 * exactly — the same type the real API data gets mapped into — so mock and
 * real communities render through identical UI with no special-casing.
 *
 * No logoUrl/bannerUrl are set on purpose: both the listing card and the
 * detail hero already fall back to an initial-letter badge / gradient block
 * when those are undefined, so mock data leans on that instead of inventing
 * placeholder image URLs.
 */
export const MOCK_COMMUNITIES: Community[] = [
    {
        id: "code-collective",
        slug: "code-collective",
        name: "Code Collective",
        category: "Technology",
        memberCount: 842,
        shortDescription:
            "Weekly build nights, hackathon squads, and a no-judgment channel for ‘why is my code broken.’",
        description:
            "Code Collective is a student-run coding club for anyone who wants to build things, ship side projects, and get better at software with people around them. We run weekly build nights, form hackathon teams every semester, and host casual talks from alumni now working in the industry. No prerequisites — just bring a laptop and curiosity.",
        members: [],
    },
    {
        id: "case-crackers",
        slug: "case-crackers",
        name: "Case Crackers",
        category: "Business",
        memberCount: 316,
        shortDescription: "Case-competition training squad — we drill frameworks and travel to compete.",
        description:
            "Case Crackers preps students for regional and national case competitions. We meet twice a week to drill consulting frameworks, run mock cases against alumni judges, and field teams for competitions across the country. Open to all majors — the best case teams mix engineers, business students, and designers.",
        members: [],
    },
    {
        id: "design-collective",
        slug: "design-collective",
        name: "Design Collective",
        category: "Arts & Culture",
        memberCount: 204,
        shortDescription: "A studio for product design, illustration, and portfolio critique nights.",
        description:
            "Design Collective is home for anyone who makes things look (and feel) good — product designers, illustrators, photographers, and typography nerds. We run monthly portfolio critiques, pair juniors with seniors for mentorship, and collaborate with other clubs on real hackathon UI.",
        members: [],
    },
    {
        id: "intramural-hoopers",
        slug: "intramural-hoopers",
        name: "Intramural Hoopers",
        category: "Sports",
        memberCount: 128,
        shortDescription: "Pickup basketball, an intramural league team, and zero pressure to be good.",
        description:
            "Intramural Hoopers runs a rec-league basketball team plus twice-weekly pickup games open to any skill level. We compete in the campus intramural league every fall and winter term, and we're always short a few players for pickup — new faces welcome any week.",
        members: [],
    },
    {
        id: "debate-society",
        slug: "debate-society",
        name: "Debate Society",
        category: "Academic",
        memberCount: 187,
        shortDescription: "British parliamentary debate, weekly practice rounds, and tournament travel.",
        description:
            "The Debate Society trains and competes in British Parliamentary format. We run weekly practice rounds open to beginners and veterans alike, host a novice tournament every fall, and send competitive teams to regionals and nationals. Come for the arguments, stay for the friendships.",
        members: [],
    },
    {
        id: "mindful-campus",
        slug: "mindful-campus",
        name: "Mindful Campus",
        category: "Health & Wellness",
        memberCount: 391,
        shortDescription: "Free weekly meditation sessions and a peer support circle during exam season.",
        description:
            "Mindful Campus runs free, drop-in meditation sessions every week and organizes a peer support circle during midterms and finals. We're not therapists — just students who wanted a low-key space to decompress that isn't a bar. All sessions are donation-optional and open to everyone.",
        members: [],
    },
    {
        id: "night-market-social",
        slug: "night-market-social",
        name: "Night Market Social",
        category: "Social",
        memberCount: 563,
        shortDescription: "Monthly campus night markets, food crawls, and first-year friend-making events.",
        description:
            "Night Market Social throws the events that actually get people off their laptops — monthly night markets with local vendors, seasonal food crawls, and a first-week mixer built specifically so new students leave with phone numbers, not just a lanyard.",
        members: [],
    },
    {
        id: "future-founders",
        slug: "future-founders",
        name: "Future Founders",
        category: "Professional",
        memberCount: 275,
        shortDescription:
            "Pitch nights, founder office hours, and a small pre-seed fund for student startups.",
        description:
            "Future Founders supports student entrepreneurs from idea to first customer. We run monthly pitch nights, pair members with alumni founders for office hours, and administer a small pre-seed fund for student startups. You don't need a company yet — just an idea you can't stop thinking about.",
        members: [],
    },
];

/** Look up a mock community by its doc-style id or its slug — mirrors the real `/public/communities/:identifier` lookup, which accepts either. */
export function getMockCommunityById(id: string): Community | undefined {
    return MOCK_COMMUNITIES.find((c) => c.id === id || c.slug === id);
}
