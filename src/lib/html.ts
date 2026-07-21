/**
 * Helpers for the HTML that the tiptap rich-text editor stores in
 * `description` fields (communities, events).
 *
 * Anywhere we need those fields as *text* — card excerpts, meta tags, JSON-LD,
 * moderation queues — the markup has to come off first, otherwise the reader
 * sees literal `<p>` tags. Rendering them as rich content is `<RichText>`'s job.
 */

const BLOCK_BOUNDARY = /<\/(?:p|div|li|h[1-6]|blockquote|tr)\s*>|<br\s*\/?>/gi;

const NAMED_ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
};

function decodeEntities(input: string): string {
    return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
        if (entity[0] === "#") {
            const codePoint =
                entity[1] === "x" || entity[1] === "X"
                    ? Number.parseInt(entity.slice(2), 16)
                    : Number.parseInt(entity.slice(1), 10);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
        }
        return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    });
}

/**
 * Flatten rich-text HTML to a single line of plain text.
 *
 * Block-level tags become spaces so `<p>A</p><p>B</p>` reads "A B" rather than
 * "AB". Runs on plain string ops (no DOMParser) so it is safe to call during
 * the static prerender pass as well as in the browser.
 */
export function htmlToText(html: string | null | undefined): string {
    if (!html) return "";
    return decodeEntities(
        html
            .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
            .replace(BLOCK_BOUNDARY, " ")
            .replace(/<[^>]*>/g, "")
    )
        .replace(/\s+/g, " ")
        .trim();
}

/** Plain-text excerpt capped at `max` characters, broken on a word boundary. */
export function htmlToExcerpt(html: string | null | undefined, max = 160): string {
    const text = htmlToText(html);
    if (text.length <= max) return text;
    const clipped = text.slice(0, max - 1);
    const lastSpace = clipped.lastIndexOf(" ");
    return `${(lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/** True when the field holds nothing a reader would see (empty tiptap docs included). */
export function isBlankHtml(html: string | null | undefined): boolean {
    return htmlToText(html).length === 0;
}
