import { Link } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * Chunky, joyful button: rounded, green primary with a pressed bottom-shadow
 * edge. Single implementation of what used to be a copy-pasted `Button` in
 * every design-lab playground page. Renders an `<a>` when `href` is set (for
 * external links like "Apply now"), a router `<Link>` when `to` is set, or a
 * plain `<button>` otherwise.
 */
export function PlaygroundButton({
    children,
    to,
    href,
    variant = "primary",
    className = "",
    onClick,
    type = "button",
}: {
    children: ReactNode;
    to?: string;
    href?: string;
    variant?: "primary" | "quiet" | "outline";
    className?: string;
    onClick?: () => void;
    type?: "button" | "submit";
}) {
    const base =
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60";
    const styles: Record<string, string> = {
        primary:
            "bg-joy-grass text-white shadow-[0_3px_0_var(--joy-grass-deep)] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_var(--joy-grass-deep)]",
        outline: "border-2 border-joy-ink/12 bg-white text-joy-ink hover:border-joy-grass/50 active:translate-y-px",
        quiet: "text-joy-ink-muted hover:text-joy-ink",
    };
    const cls = `${base} ${styles[variant]} ${className}`;
    if (href) {
        return (
            <a href={href} target="_blank" rel="noreferrer" className={cls}>
                {children}
            </a>
        );
    }
    if (to) {
        return (
            <Link to={to} className={cls}>
                {children}
            </Link>
        );
    }
    return (
        <button type={type} onClick={onClick} className={cls}>
            {children}
        </button>
    );
}
