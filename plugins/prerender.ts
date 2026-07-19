import fs from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

const SITE_URL = "https://community.tailed.ca";

// Same feed URL as src/lib/external-jobs.ts. Duplicated here because this
// file runs standalone in the Node build process and cannot import from src/.
const JOBS_FEED_URL =
    "https://raw.githubusercontent.com/tailed-community/tailed-internships-new-grad/refs/heads/main/data/jobs.json";

const FEED_TIMEOUT_MS = 15000;
const MAX_SITEMAP_URLS = 45000;

type StaticRoute = {
    path: string;
    title: string;
    description: string;
};

const STATIC_ROUTES: StaticRoute[] = [
    {
        path: "/jobs",
        title: "Tech Internships & New-Grad Jobs for Students | Tail'ed",
        description:
            "Browse thousands of tech internships and new-grad jobs. Updated daily. Free forever — no account required to search.",
    },
    {
        path: "/communities",
        title: "Student Tech Communities | Tail'ed",
        description: "Discover and join student tech clubs and communities across Canada — hackathon teams, campus clubs, and more.",
    },
    {
        path: "/events",
        title: "Student Hackathons & Tech Events | Tail'ed",
        description: "Hackathons, workshops, and student tech events. Find your next event and register free.",
    },
    {
        path: "/companies",
        title: "Companies Hiring Students | Tail'ed",
        description: "Explore companies hiring interns and new grads through Tail'ed.",
    },
    {
        path: "/about",
        title: "About Tail'ed Community — a Non-Profit Built by Students",
        description: "Tail'ed Community is a non-profit platform built by students, for students: thousands of job listings, hackathons, and communities. Free forever.",
    },
    {
        path: "/explore",
        title: "Explore | Tail'ed",
        description: "Explore student communities, events, and opportunities on Tail'ed.",
    },
    {
        path: "/spotlight",
        title: "Spotlight | Tail'ed",
        description: "Student and community spotlights from the Tail'ed Community network.",
    },
];

interface ExternalJobLike {
    id: string;
    active?: boolean;
    date_added?: string;
}

function escapeHtmlAttr(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/** Replaces the text content of the first <title>...</title> tag. */
function replaceTitle(html: string, newTitle: string): string {
    return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtmlAttr(newTitle)}</title>`);
}

/**
 * Finds a <meta ...> tag whose `matchAttr` attribute equals `matchValue`
 * (attribute order within the tag is not assumed) and replaces its
 * `content="..."` attribute value with `newContent`.
 */
function replaceMetaContent(
    html: string,
    matchAttr: "name" | "property",
    matchValue: string,
    newContent: string
): string {
    const escapedMatchValue = matchValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tagRegex = new RegExp(
        `<meta\\b[^>]*\\b${matchAttr}=["']${escapedMatchValue}["'][^>]*>`,
        "i"
    );
    // Quote-aware: matches content="..." or content='...' without truncating
    // on a stray apostrophe/quote inside the value (e.g. "Tail'ed").
    const contentAttrRegex = /content=(["'])((?:(?!\1)[\s\S])*)\1/i;
    return html.replace(tagRegex, (tag) => {
        if (contentAttrRegex.test(tag)) {
            return tag.replace(contentAttrRegex, `content="${escapeHtmlAttr(newContent)}"`);
        }
        // No content attribute present (shouldn't happen given our template), append one.
        return tag.replace(/\/?>$/, ` content="${escapeHtmlAttr(newContent)}" />`);
    });
}

function injectCanonical(html: string, href: string): string {
    const link = `    <link rel="canonical" href="${escapeHtmlAttr(href)}" />\n`;
    if (html.includes("</head>")) {
        return html.replace("</head>", `${link}  </head>`);
    }
    return html + link;
}

function buildRouteHtml(baseHtml: string, route: StaticRoute): string {
    let html = baseHtml;
    html = replaceTitle(html, route.title);
    html = replaceMetaContent(html, "name", "description", route.description);
    html = replaceMetaContent(html, "property", "og:title", route.title);
    html = replaceMetaContent(html, "property", "og:description", route.description);
    html = replaceMetaContent(html, "property", "og:url", `${SITE_URL}${route.path}`);
    html = replaceMetaContent(html, "name", "twitter:title", route.title);
    html = replaceMetaContent(html, "name", "twitter:description", route.description);
    html = injectCanonical(html, `${SITE_URL}${route.path}`);
    return html;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a `date_added` string looks like `YYYY-MM-DD` before using it as a <lastmod>. */
function toIsoDate(dateAdded: string | undefined): string | undefined {
    if (!dateAdded || !ISO_DATE_RE.test(dateAdded)) return undefined;
    return dateAdded;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchExternalJobsForSitemap(): Promise<ExternalJobLike[]> {
    try {
        const res = await fetchWithTimeout(JOBS_FEED_URL, FEED_TIMEOUT_MS);
        return (await res.json()) as ExternalJobLike[];
    } catch (error) {
        console.warn(
            "[prerender] Failed to fetch external job feed for sitemap generation; emitting static routes only.",
            error
        );
        return [];
    }
}

function buildSitemapXml(jobs: ExternalJobLike[]): { xml: string; urlCount: number } {
    const urls: string[] = [];

    urls.push(`  <url>\n    <loc>${escapeXml(SITE_URL + "/")}</loc>\n  </url>`);
    for (const route of STATIC_ROUTES) {
        urls.push(`  <url>\n    <loc>${escapeXml(SITE_URL + route.path)}</loc>\n  </url>`);
    }

    const activeJobs = jobs.filter((job) => job.active !== false);
    for (const job of activeJobs) {
        if (urls.length >= MAX_SITEMAP_URLS) break;
        if (!job.id) continue;
        const loc = `${SITE_URL}/jobs/e/${encodeURIComponent(job.id)}`;
        const lastmod = toIsoDate(job.date_added);
        urls.push(
            `  <url>\n    <loc>${escapeXml(loc)}</loc>${
                lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""
            }\n  </url>`
        );
    }

    const capped = urls.slice(0, MAX_SITEMAP_URLS);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${capped.join(
        "\n"
    )}\n</urlset>\n`;
    return { xml, urlCount: capped.length };
}

/**
 * Builds an llms.txt file (https://llmstxt.org/) describing the site for AI
 * answer engines. Reuses the `jobs` array already fetched for the sitemap —
 * no second network call.
 */
function buildLlmsTxt(jobs: ExternalJobLike[]): string {
    const activeJobs = jobs.filter((job) => job.active !== false);
    // Only trust the count if the feed fetch actually returned data; an
    // empty/failed fetch (see fetchExternalJobsForSitemap's catch) falls
    // back to a qualitative line instead of a stale/zero number.
    const hasReliableJobCount = jobs.length > 0 && activeJobs.length > 0;
    const jobsDescription = hasReliableJobCount
        ? `Browse ~${activeJobs.length} active tech internship and new-grad postings, aggregated daily.`
        : "Browse actively updated tech internship and new-grad postings.";

    const jobsRoute = STATIC_ROUTES.find((route) => route.path === "/jobs");
    const otherRoutes = STATIC_ROUTES.filter((route) => route.path !== "/jobs");

    const lines: string[] = [];
    lines.push("# Tail'ed");
    lines.push("");
    lines.push(
        "> Tail'ed Community is a non-profit, free-forever platform built by students, for students, aggregating tech internships and new-grad jobs plus student communities, hackathons, and events across Canada."
    );
    lines.push("");
    lines.push(
        `No account is needed to browse jobs. Listings are aggregated from public sources and updated regularly. The canonical site is ${SITE_URL}.`
    );
    lines.push("");

    lines.push("## Jobs");
    lines.push("");
    lines.push(
        `- [${jobsRoute ? jobsRoute.title : "Jobs"}](${SITE_URL}/jobs): ${jobsDescription}`
    );
    lines.push("");

    for (const route of otherRoutes) {
        const heading = route.path.slice(1).replace(/^[a-z]/, (c) => c.toUpperCase());
        lines.push(`## ${heading}`);
        lines.push("");
        lines.push(`- [${route.title}](${SITE_URL}${route.path}): ${route.description}`);
        lines.push("");
    }

    lines.push("## Optional");
    lines.push("");
    lines.push(`- [Sitemap](${SITE_URL}/sitemap.xml): Full URL list, including individual job postings.`);
    lines.push("");

    return lines.join("\n");
}

export function prerenderPlugin(): Plugin {
    let resolvedConfig: ResolvedConfig;

    return {
        name: "tailed-prerender",
        apply: "build",
        configResolved(config) {
            resolvedConfig = config;
        },
        async closeBundle() {
            const outDir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir || "dist");
            const indexPath = path.join(outDir, "index.html");

            if (!fs.existsSync(indexPath)) {
                console.warn(`[prerender] ${indexPath} not found; skipping prerender step.`);
                return;
            }

            const baseHtml = fs.readFileSync(indexPath, "utf-8");

            let prerenderedCount = 0;
            for (const route of STATIC_ROUTES) {
                const routeHtml = buildRouteHtml(baseHtml, route);
                const routeDir = path.join(outDir, route.path);
                fs.mkdirSync(routeDir, { recursive: true });
                fs.writeFileSync(path.join(routeDir, "index.html"), routeHtml, "utf-8");
                prerenderedCount++;
            }

            const jobs = await fetchExternalJobsForSitemap();
            const { xml, urlCount } = buildSitemapXml(jobs);
            fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml, "utf-8");

            const llmsTxt = buildLlmsTxt(jobs);
            fs.writeFileSync(path.join(outDir, "llms.txt"), llmsTxt, "utf-8");

            console.log(
                `[prerender] Prerendered ${prerenderedCount} static route(s); sitemap.xml written with ${urlCount} URL(s); llms.txt written.`
            );
        },
    };
}
