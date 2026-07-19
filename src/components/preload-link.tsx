import { forwardRef, useCallback } from "react";
import type { FocusEvent, MouseEvent, TouchEvent } from "react";
import { Link } from "react-router-dom";
import type { LinkProps } from "react-router-dom";
import { preloadRoute } from "@/lib/route-preload";

/**
 * Returns event handlers that fire `preloadRoute(to)` on hover/focus/touch —
 * "intent" signals that a visitor is likely about to navigate there. Useful
 * for components that can't wrap `<Link>` directly (e.g. spread onto a
 * custom button). `preloadRoute` is a no-op for paths that aren't in the
 * lazy-route registry (static routes, design-lab pages), so this is safe to
 * attach anywhere.
 */
export function usePreloadOnIntent(to: string) {
    const trigger = useCallback(() => preloadRoute(to), [to]);
    return {
        onMouseEnter: trigger,
        onFocus: trigger,
        onTouchStart: trigger,
    };
}

/**
 * Thin wrapper around react-router's `Link` that also preloads the target
 * route's chunk on hover/focus/touchstart. Drop-in replacement for `Link` —
 * forwards its ref (needed for Radix `asChild` usage in DropdownMenuItem /
 * SheetClose) and passes every other prop straight through.
 */
export const PreloadLink = forwardRef<HTMLAnchorElement, LinkProps>(
    function PreloadLink({ to, onMouseEnter, onFocus, onTouchStart, ...props }, ref) {
        const toPath = typeof to === "string" ? to : (to.pathname ?? "");

        const handleMouseEnter = useCallback(
            (event: MouseEvent<HTMLAnchorElement>) => {
                preloadRoute(toPath);
                onMouseEnter?.(event);
            },
            [toPath, onMouseEnter]
        );
        const handleFocus = useCallback(
            (event: FocusEvent<HTMLAnchorElement>) => {
                preloadRoute(toPath);
                onFocus?.(event);
            },
            [toPath, onFocus]
        );
        const handleTouchStart = useCallback(
            (event: TouchEvent<HTMLAnchorElement>) => {
                preloadRoute(toPath);
                onTouchStart?.(event);
            },
            [toPath, onTouchStart]
        );

        return (
            <Link
                ref={ref}
                to={to}
                onMouseEnter={handleMouseEnter}
                onFocus={handleFocus}
                onTouchStart={handleTouchStart}
                {...props}
            />
        );
    }
);
