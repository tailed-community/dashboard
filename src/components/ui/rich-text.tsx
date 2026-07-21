import React from "react";
import { cn } from "@/lib/utils";
import { isBlankHtml } from "@/lib/html";

/**
 * Renders the HTML produced by `<RichTextEditor>` (tiptap) using the joy theme.
 *
 * The markup is parsed and rebuilt as React elements against a tag allowlist
 * rather than injected with `dangerouslySetInnerHTML`. Two consequences worth
 * knowing: every attribute is dropped except `href` on links (scheme-checked),
 * and any tag outside the allowlist is unwrapped to its text. So a stored
 * payload like `<img onerror=...>` renders as nothing at all — the renderer is
 * the sanitizer, and it can't be regex-bypassed the way string scrubbing can.
 *
 * Author-side tags come from StarterKit, so the list below is deliberately
 * small; anything richer should be added to the editor first.
 */

/** Tag -> classes. Membership in this map *is* the allowlist. */
const TAG_STYLES: Record<string, string> = {
    p: "text-[15px] leading-relaxed text-joy-ink/80 [&:not(:first-child)]:mt-4",
    h1: "joy-display text-xl font-bold text-joy-ink [&:not(:first-child)]:mt-6",
    h2: "joy-display text-lg font-bold text-joy-ink [&:not(:first-child)]:mt-6",
    h3: "joy-display text-base font-bold text-joy-ink [&:not(:first-child)]:mt-5",
    h4: "joy-display text-sm font-bold text-joy-ink [&:not(:first-child)]:mt-4",
    ul: "list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-joy-ink/80 [&:not(:first-child)]:mt-4 marker:text-joy-grass",
    ol: "list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-joy-ink/80 [&:not(:first-child)]:mt-4 marker:text-joy-ink-muted",
    li: "pl-1",
    blockquote:
        "border-l-2 border-joy-grass/40 pl-4 text-[15px] italic leading-relaxed text-joy-ink-muted [&:not(:first-child)]:mt-4",
    strong: "font-bold text-joy-ink",
    em: "italic",
    s: "line-through text-joy-ink-muted",
    code: "joy-mono rounded bg-joy-ink/5 px-1.5 py-0.5 text-[0.9em] text-joy-ink",
    pre: "joy-mono overflow-x-auto rounded-xl bg-joy-ink/5 p-4 text-xs leading-relaxed text-joy-ink [&:not(:first-child)]:mt-4",
    a: "font-bold text-joy-grass underline underline-offset-2 hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 rounded",
    br: "",
    hr: "my-6 border-joy-ink/10",
};

/** Tiptap emits `b`/`i`/`u`; normalize onto the semantic tags we style. */
const TAG_ALIASES: Record<string, string> = {
    b: "strong",
    i: "em",
    strike: "s",
    del: "s",
    div: "p",
};

const VOID_TAGS = new Set(["br", "hr"]);

/** Only these schemes may survive on a link — blocks `javascript:` and `data:`. */
function safeHref(raw: string | null): string | undefined {
    if (!raw) return undefined;
    const href = raw.trim();
    // Relative and anchor links are same-origin by construction, so always fine.
    if (/^(\/|#|\.)/.test(href)) return href;
    return /^(https?:|mailto:|tel:)/i.test(href) ? href : undefined;
}

function renderNode(node: Node, key: React.Key): React.ReactNode {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const el = node as Element;
    const rawTag = el.tagName.toLowerCase();
    const tag = TAG_ALIASES[rawTag] ?? rawTag;
    const children = renderChildren(el);

    // Not on the allowlist: keep the words, drop the element and its attributes.
    if (!(tag in TAG_STYLES)) return <React.Fragment key={key}>{children}</React.Fragment>;

    if (VOID_TAGS.has(tag)) {
        return React.createElement(tag, { key, className: TAG_STYLES[tag] || undefined });
    }

    if (tag === "a") {
        const href = safeHref(el.getAttribute("href"));
        // A link with no usable href is still worth showing as text.
        if (!href) return <React.Fragment key={key}>{children}</React.Fragment>;
        return (
            <a
                key={key}
                href={href}
                className={TAG_STYLES.a}
                target="_blank"
                rel="noopener noreferrer nofollow"
            >
                {children}
            </a>
        );
    }

    return React.createElement(tag, { key, className: TAG_STYLES[tag] }, children);
}

function renderChildren(parent: Node): React.ReactNode[] {
    return Array.from(parent.childNodes).map((child, i) => renderNode(child, i));
}

interface RichTextProps {
    /** HTML string from the rich-text editor. */
    content: string | null | undefined;
    className?: string;
    /** Shown when the description is missing or renders to nothing. */
    fallback?: React.ReactNode;
}

export function RichText({ content, className, fallback = null }: RichTextProps) {
    const body = React.useMemo(() => {
        if (!content || isBlankHtml(content)) return null;

        // Descriptions predating the rich-text editor are plain text, where the
        // only structure is the author's own line breaks. Parsing those as HTML
        // would collapse every newline, so keep them whole.
        if (!/<[a-z][\s\S]*>/i.test(content)) {
            return (
                <p className={cn(TAG_STYLES.p, "whitespace-pre-line")}>{content.trim()}</p>
            );
        }

        // DOMParser builds an inert document — scripts don't execute and
        // resources aren't fetched during parsing.
        if (typeof DOMParser === "undefined") return content.replace(/<[^>]*>/g, "");
        const doc = new DOMParser().parseFromString(content, "text/html");
        return renderChildren(doc.body);
    }, [content]);

    if (body === null) return <>{fallback}</>;

    return <div className={cn("text-joy-ink/80", className)}>{body}</div>;
}
