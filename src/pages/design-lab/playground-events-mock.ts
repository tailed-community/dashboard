import { DateTime } from "luxon";
import type { EventItem, Mode } from "@/pages/design-lab/playground-events";

/**
 * "Today" / "Tomorrow" / "Wed" / "In 12d" / "Mar 4" — deliberately duplicated
 * from `playground-events.tsx`'s `formatEventWhen` rather than imported: that
 * file imports `MOCK_EVENTS` from this one, so importing a *value* back from
 * it would create a circular runtime dependency. Types (`EventItem`, `Mode`
 * above) are import-type-only and erased at compile time, so those are safe.
 */
function formatEventWhen(startDate: string, startTime: string): { date: string; time: string; relative: string; daysUntil: number } {
    const dt = DateTime.fromISO(`${startDate}T${startTime}`);
    const now = DateTime.now();
    const diffDays = Math.ceil(dt.diff(now, "days").days || 0);
    let relative: string;
    if (diffDays <= 0) relative = "Today";
    else if (diffDays === 1) relative = "Tomorrow";
    else if (diffDays <= 7) relative = dt.toFormat("ccc");
    else if (diffDays <= 30) relative = `In ${diffDays}d`;
    else relative = dt.toFormat("MMM d");
    return {
        date: dt.isValid ? dt.toFormat("MMM d, yyyy") : "TBA",
        time: dt.isValid ? dt.toFormat("h:mm a") : "",
        relative,
        daysUntil: diffDays,
    };
}

/**
 * Mock event data for the Playground design-lab prototype.
 *
 * The real backend isn't running in local dev, so `GET /public/events`
 * always fails/returns nothing there — which meant the Playground events
 * grid and detail page could never be previewed populated. This file is the
 * single source of truth for sample events: `playground-events.tsx` falls
 * back to `MOCK_EVENTS` when the live fetch fails or returns zero events,
 * and `playground-event-detail.tsx` falls back to `getMockEventById` when
 * there's no matching real event.
 *
 * Dates are generated relative to "now" (via `daysFromNow`) rather than
 * hardcoded, so the "Today" / "Tomorrow" / "In Nd" labels stay believable
 * no matter when this is opened.
 */

/**
 * Extends the page's normalized `EventItem` with the richer copy a detail page needs.
 * `description` is redeclared as paragraphs (`string[]`) instead of `EventItem`'s free-text
 * `string | undefined`, so the field is `Omit`-ed off before extending.
 */
export interface MockEventItem extends Omit<EventItem, "description"> {
    /** 2-3 paragraphs of body copy, written up front rather than invented at render time. */
    description: string[];
    /** Human price label for the detail page, e.g. "Free" or "$12 · student rate". */
    priceLabel: string;
}

interface MockEventSeed {
    id: string;
    title: string;
    /** Whole days from now the event starts. */
    daysFromNow: number;
    /** 24h "HH:mm" local start time. */
    startTime: string;
    mode: Mode;
    location: string;
    city?: string;
    category: string;
    isPaid: boolean;
    priceLabel: string;
    host: string;
    attendees: number;
    description: string[];
}

const MOCK_SEEDS: MockEventSeed[] = [
    {
        id: "mock-resume-roast",
        title: "Resume Roast: Live Feedback Session",
        daysFromNow: 1,
        startTime: "18:00",
        mode: "Online",
        location: "Virtual — link sent on RSVP",
        category: "Career",
        isPaid: false,
        priceLabel: "Free",
        host: "Toronto CS Society",
        attendees: 85,
        description: [
            "Bring your resume, leave with a better one. Every RSVP gets a 5-minute live slot where a panel of new-grad hires and a couple of student-club alumni now working at tech companies will roast (kindly) and rewrite your bullet points on the spot.",
            "We'll cover the usual suspects — vague impact statements, buried keywords, formatting that eats an ATS parser alive — plus a quick pass on tailoring the same resume for internship vs. new-grad postings.",
            "Can't grab a live slot? Drop your resume in the shared doc before the session and we'll get to as many async reviews as we can in the last 20 minutes.",
        ],
    },
    {
        id: "mock-design-sprint-saturday",
        title: "Design Sprint Saturday",
        daysFromNow: 3,
        startTime: "10:00",
        mode: "In Person",
        location: "OCAD U, Room 220",
        city: "Toronto",
        category: "Design",
        isPaid: false,
        priceLabel: "Free",
        host: "OCAD Design Guild",
        attendees: 40,
        description: [
            "A one-day sprint for students who want a portfolio piece they can actually talk about in interviews — not another half-finished Figma file. You'll form a team of 3-4 in the first 15 minutes and ship a clickable prototype by 5pm.",
            "This round's brief: redesign a clunky part of student life (course registration, campus wayfinding, club sign-ups — your call). Mentors from local product and design teams will circulate throughout the day for quick critiques.",
            "Laptops required, Figma preferred but not mandatory. Coffee, snacks, and a closing show-and-tell are covered — just show up ready to build.",
        ],
    },
    {
        id: "mock-ai-demo-night",
        title: "AI Demo Night: Student Builds",
        daysFromNow: 4,
        startTime: "19:00",
        mode: "Online",
        location: "Virtual — streamed live, link sent on RSVP",
        category: "AI",
        isPaid: false,
        priceLabel: "Free",
        host: "Waterloo AI Society",
        attendees: 300,
        description: [
            "Ten students, five minutes each, one shared screen: this is the demo night for whatever you've been building with a model API, a fine-tune, or a scrappy agent script at 2am between assignments.",
            "No slides required — we'd rather watch it run live and break a little. Past demo nights have featured a lecture-note summarizer, a dining-hall menu bot, and a genuinely unsettling roommate-chore mediator.",
            "Watching counts too. Come for the demos, stay for the Discord afterparty where half the audience ends up recruiting teammates for the next build.",
        ],
    },
    {
        id: "mock-hackathon-beat-the-bracket",
        title: "Beat the Bracket: 24-Hour Hackathon",
        daysFromNow: 6,
        startTime: "09:00",
        mode: "In Person",
        location: "University of Waterloo, William G. Davis Centre",
        city: "Waterloo",
        category: "Hackathon",
        isPaid: false,
        priceLabel: "Free",
        host: "HackWaterloo",
        attendees: 240,
        description: [
            "24 hours, any stack, whatever you can ship. Beat the Bracket runs on a single-elimination format — every few hours teams present a checkpoint to a rotating panel of judges, and the bottom teams get merged into stronger ones instead of going home.",
            "It sounds brutal on paper but it's actually the friendliest hackathon format we run: nobody sits in a corner all night with a project nobody sees, and the finals stage ends up genuinely competitive.",
            "Meals, a nap zone, and enough energy drinks to be mildly concerning are all provided. Sponsor tables run Saturday afternoon if you want to talk to recruiters between commits.",
        ],
    },
    {
        id: "mock-break-into-big-tech-panel",
        title: "Break Into Big Tech: Panel + Q&A",
        daysFromNow: 14,
        startTime: "17:30",
        mode: "Hybrid",
        location: "UBC Nest, Room 3505 (streamed for remote RSVPs)",
        city: "Vancouver",
        category: "Career",
        isPaid: false,
        priceLabel: "Free",
        host: "UBC Computer Science Club",
        attendees: 150,
        description: [
            "Four new-grad engineers — two from big tech, one from a fast-growing startup, one who took the non-traditional route through a bootcamp — on what actually got them hired, versus what they thought would.",
            "We're structuring this one around real timelines: what their applications looked like in second year, how many rejections came before the offer, and what they'd change about their resume or interview prep in hindsight.",
            "Join in person at the Nest or stream it live with a synced Q&A queue — remote attendees get called on in the same order as the room.",
        ],
    },
    {
        id: "mock-founders-and-fries",
        title: "Founders & Fries: Startup Mixer",
        daysFromNow: 21,
        startTime: "18:30",
        mode: "In Person",
        location: "Notman House",
        city: "Montréal",
        category: "Startups",
        isPaid: true,
        priceLabel: "$12 · student rate",
        host: "McGill Founders Collective",
        attendees: 60,
        description: [
            "A low-key mixer for students building something on the side — or just curious what that's like. Expect a room split roughly evenly between solo founders, small teams looking for a technical cofounder, and people who just want to steal ideas over fries.",
            "We'll open with three 4-minute lightning pitches from current student founders (all pre-seed or earlier, all built while still in school), then it's open floor for the rest of the night.",
            "Ticket covers the venue and a fry bar that has, in past events, been the single most-discussed line item in the feedback survey. Come hungry, leave with three new Discord DMs.",
        ],
    },
];

function buildMockEvent(seed: MockEventSeed): MockEventItem {
    const startDate = DateTime.now().plus({ days: seed.daysFromNow }).toISODate() ?? "";
    const { date, time, relative, daysUntil } = formatEventWhen(startDate, seed.startTime);
    return {
        id: seed.id,
        slug: seed.id,
        title: seed.title,
        date,
        time,
        relative,
        daysUntil,
        mode: seed.mode,
        location: seed.location,
        city: seed.city,
        category: seed.category,
        isPaid: seed.isPaid,
        host: seed.host,
        attendees: seed.attendees,
        description: seed.description,
        priceLabel: seed.priceLabel,
    };
}

/** Sample events, ordered soonest-first — used whenever live `/public/events` data is unavailable or empty. */
export const MOCK_EVENTS: MockEventItem[] = MOCK_SEEDS.map(buildMockEvent);

/** Looks up a single mock event by id (or slug — mock ids double as slugs). Returns undefined if there's no match. */
export function getMockEventById(id: string): MockEventItem | undefined {
    return MOCK_EVENTS.find((event) => event.id === id || event.slug === id);
}
