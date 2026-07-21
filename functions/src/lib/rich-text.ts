/**
 * Write-time sanitization for the rich-text `description` fields that the
 * tiptap editor posts as HTML (communities, events).
 *
 * This is defense in depth, not the primary control. The client renderer
 * (`src/components/ui/rich-text.tsx`) rebuilds description HTML as React
 * elements against its own allowlist and drops every attribute, so a hostile
 * payload can't execute even if it reaches Firestore. What this adds is that
 * such payloads shouldn't *be* in Firestore in the first place — they leak into
 * ICS exports, emails, and anything else that consumes the field directly.
 *
 * Keep the tag allowlist below in sync with `TAG_STYLES` in the renderer;
 * anything permitted here that the renderer doesn't style will simply be
 * unwrapped to its text on screen.
 */

import { z } from "zod";

/** Tags that survive sanitization. Mirrors the editor's StarterKit output. */
const ALLOWED_TAGS = new Set([
  "p", "br", "hr",
  "h1", "h2", "h3", "h4",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "strong", "b", "em", "i", "s", "strike", "del", "u",
  "a",
]);

/** Elements whose *contents* are dropped along with the tag, not unwrapped to text. */
const DROP_CONTENT =
  /<(script|style|iframe|object|embed|template|noscript|svg|math)\b[\s\S]*?(?:<\/\1\s*>|$)/gi;

const HREF_ATTR = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/**
 * Only these schemes may survive on a link — blocks `javascript:` and `data:`.
 *
 * Control characters and whitespace are stripped before the scheme is checked:
 * URL parsers ignore them, so `java<TAB>script:` would otherwise slip past a
 * naive prefix test and still execute in a browser.
 */
function safeHref(raw: string | undefined): string | null {
  if (!raw) return null;
  const href = Array.from(raw.trim())
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 0x20 && code !== 0x7f;
    })
    .join("");
  if (!href) return null;
  if (/^(\/|#|\.)/.test(href)) return href;
  if (!/^(https?:|mailto:|tel:)/i.test(href)) return null;
  return href.replace(/"/g, "&quot;");
}

/**
 * Strip everything outside the allowlist from rich-text HTML.
 *
 * Disallowed tags are unwrapped (their text is kept) rather than deleted, so a
 * description wrapped in unexpected markup doesn't silently become empty. All
 * attributes are dropped except a scheme-checked `href` on links.
 */
export function sanitizeRichText(html: string): string {
  return html
    .replace(DROP_CONTENT, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g,
      (_m, slash: string, rawTag: string, attrs: string) => {
        const tag = rawTag.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) return "";
        if (slash) return `</${tag}>`;

        if (tag === "a") {
          const found = HREF_ATTR.exec(attrs);
          const href = safeHref(found?.[1] ?? found?.[2] ?? found?.[3]);
          // Keep the anchor only when it still points somewhere usable.
          return href ? `<a href="${href}">` : "<a>";
        }

        // Everything else keeps its tag and loses every attribute, which is
        // where `onerror=`, `style=`, and friends would otherwise live.
        return `<${tag}>`;
      }
    )
    // A payload can leave behind a bare `<` that never formed a tag.
    .replace(/<(?![a-zA-Z/])/g, "&lt;")
    .trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

/**
 * Flatten rich-text HTML to plain text, keeping block breaks as newlines.
 *
 * For consumers that can't render markup at all — ICS invites, email bodies,
 * anything read as text. The browser-side twin lives in `src/lib/html.ts`.
 */
export function richTextToPlain(html: string): string {
  return html
    .replace(DROP_CONTENT, "")
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote|pre|tr)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === "#") {
        const code = entity[1] === "x" || entity[1] === "X"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Visible-text length, for validating a description that is mostly markup. */
export function richTextLength(html: string): number {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/**
 * Zod field for a rich-text description posted by the tiptap editor.
 *
 * Sanitizes before validating, and measures length against the *visible* text
 * so a description made mostly of markup can't clear the minimum on tags alone.
 * The raw cap is deliberately looser than the visible cap to leave room for
 * that markup.
 */
export const richTextField = z
  .string()
  .max(20000, "Description is too long")
  .transform(sanitizeRichText)
  .refine((value) => richTextLength(value) >= 10, {
    message: "Description must be at least 10 characters",
  })
  .refine((value) => richTextLength(value) <= 5000, {
    message: "Description must be at most 5000 characters",
  });
