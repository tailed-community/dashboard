import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { doneNavProgress, subscribeNavProgress } from "@/lib/nav-progress";

// Delay before the bar is allowed to become visible at all — navigations
// that resolve faster than this (already-loaded chunk, static route) show
// nothing, which is the point: instant navs shouldn't flash UI.
const SHOW_DELAY_MS = 150;
// Trickle timing once visible: fast hop to 60%, slower crawl to 85%, then
// hold — real completion (done()) jumps the rest of the way to 100%.
const CRAWL_DELAY_MS = 350;
const HOLD_BEFORE_FADE_MS = 150;
const FADE_MS = 200;

/**
 * Thin (3px) top-of-viewport progress bar reflecting pending client-side
 * navigations. Purely a subscriber to src/lib/nav-progress.ts's start/done
 * pub/sub — see that file for why the start/done signals are sourced the
 * way they are. Renders nothing until a navigation has been pending for
 * SHOW_DELAY_MS, so instant/already-loaded navigations stay silent.
 */
export function NavProgressBar() {
    const [width, setWidth] = useState(0);
    const [visible, setVisible] = useState(false);
    const [fading, setFading] = useState(false);
    const visibleRef = useRef(false);
    const timers = useRef<{
        show?: ReturnType<typeof setTimeout>;
        crawl?: ReturnType<typeof setTimeout>;
        hold?: ReturnType<typeof setTimeout>;
        fade?: ReturnType<typeof setTimeout>;
    }>({});

    useEffect(() => {
        const clearTimers = () => {
            const t = timers.current;
            clearTimeout(t.show);
            clearTimeout(t.crawl);
            clearTimeout(t.hold);
            clearTimeout(t.fade);
            timers.current = {};
        };

        const unsubscribe = subscribeNavProgress((active) => {
            if (active) {
                clearTimers();
                setFading(false);
                timers.current.show = setTimeout(() => {
                    visibleRef.current = true;
                    setVisible(true);
                    setWidth(0);
                    // Two rAFs so the browser paints width:0 before we
                    // transition to 60 — otherwise the transition can get
                    // coalesced into the initial paint and just appear at 60%.
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => setWidth(60));
                    });
                    timers.current.crawl = setTimeout(() => setWidth(85), CRAWL_DELAY_MS);
                }, SHOW_DELAY_MS);
            } else {
                clearTimers();
                if (!visibleRef.current) return; // resolved before it ever became visible — nothing to fade
                setWidth(100);
                timers.current.hold = setTimeout(() => {
                    setFading(true);
                    timers.current.fade = setTimeout(() => {
                        visibleRef.current = false;
                        setVisible(false);
                        setWidth(0);
                        setFading(false);
                    }, FADE_MS);
                }, HOLD_BEFORE_FADE_MS);
            }
        });

        return () => {
            unsubscribe();
            clearTimers();
        };
    }, []);

    return (
        <div
            role="progressbar"
            aria-hidden={!visible}
            aria-label="Page loading"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={visible ? width : undefined}
            className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
        >
            <div
                className="h-full bg-joy-grass-bright"
                style={{
                    width: `${width}%`,
                    opacity: visible && !fading ? 1 : 0,
                    transition: fading
                        ? `opacity ${FADE_MS}ms ease-out`
                        : `width ${width >= 100 ? 150 : 400}ms ease-out, opacity 150ms ease-in`,
                }}
            />
        </div>
    );
}

/**
 * Mounted once inside <Router>. Fires doneNavProgress() on every commited
 * location change — see src/lib/nav-progress.ts for why that lines up with
 * "the pending navigation actually finished" under v7's default
 * startTransition behavior. Renders nothing.
 */
export function NavProgressReset() {
    const location = useLocation();

    useEffect(() => {
        doneNavProgress();
        // Intentionally re-runs on every commited location change (pathname,
        // search, and hash all count as "the navigation resolved").
    }, [location.pathname, location.search, location.hash]);

    return null;
}
