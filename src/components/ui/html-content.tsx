import { cn } from "@/lib/utils";
import React from "react";

interface HTMLContentProps {
  content: string;
  className?: string;
}

/**
 * Component to safely render HTML content from rich text editor
 * Uses dangerouslySetInnerHTML with sanitized content
 */
export const HTMLContent: React.FC<HTMLContentProps> = ({
  content,
  className,
}) => {
  // Basic sanitization - remove script tags and dangerous attributes
  const sanitizeHTML = (html: string): string => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/on\w+="[^"]*"/g, "")
      .replace(/on\w+='[^']*'/g, "");
  };

  const sanitizedContent = sanitizeHTML(content);

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        // Headings - more explicit sizing and weight
        "prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground",
        "prose-h1:text-3xl prose-h1:font-bold prose-h1:my-4 first:prose-h1:mt-0",
        "prose-h2:text-2xl prose-h2:font-bold prose-h2:!mt-6 prose-h2:mb-3 first:prose-h2:mt-0",
        "prose-h3:text-xl prose-h3:font-semibold prose-h3:my-2 first:prose-h3:mt-0",
        // Paragraphs
        "prose-p:my-3 prose-p:leading-relaxed prose-p:text-foreground",
        // Lists
        "prose-ul:my-3 prose-ol:my-3 prose-ul:text-foreground prose-ol:text-foreground",
        "prose-li:my-1 prose-li:text-foreground",
        // Code
        "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:text-foreground prose-code:font-mono",
        // Blockquotes
        "prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground",
        // Text formatting
        "prose-strong:font-bold prose-strong:text-foreground",
        "prose-a:text-primary prose-a:underline prose-a:font-medium hover:prose-a:text-primary/80",
        "prose-em:italic prose-em:text-foreground",
        // Direct element targeting for better control
        "[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:my-4 first:[&_h1]:mt-0",
        "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:!mt-6 [&_h2]:mb-3 first:[&_h2]:mt-0",
        "[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:my-2 first:[&_h3]:mt-0",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3",
        "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3",
        "[&_li]:my-1",
        "[&_strong]:font-bold",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};
