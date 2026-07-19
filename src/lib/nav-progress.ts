/**
 * Lightweight pub/sub powering the top-of-viewport navigation progress bar
 * (see src/components/nav-progress-bar.tsx).
 *
 * react-router-dom's BrowserRouter (declarative mode, no data router) exposes
 * no `useNavigation()` hook and — because v7 wraps navigations in
 * `React.startTransition` by default — `useLocation()` doesn't even update
 * until the incoming route has finished rendering (the old page stays put
 * for the whole in-between). That makes "location changed" a reliable
 * *done* signal but leaves no built-in *start* signal at all.
 *
 * So the start signal is sourced imperatively instead: `startNavProgress()`
 * is called as early as possible on anything that looks like an in-tab link
 * click (PreloadLink's onClick, plus a document-level capture-phase
 * fallback for any other internal `<a>`/`<Link>` — see
 * `installGlobalNavProgressListener`) and on `popstate` (browser
 * back/forward). `doneNavProgress()` is called from a small
 * `<NavProgressReset>` component that watches `useLocation()` inside the
 * router and fires on every change — which, thanks to the startTransition
 * behavior above, lines up with "the new route actually committed" rather
 * than merely "history changed a moment ago while the old page still shows".
 *
 * A safety timeout guarantees the bar never gets stuck visible if a click
 * turns out not to correspond to a route change we ever see finish (e.g. an
 * external redirect happened instead).
 */

type Listener = (active: boolean) => void;

const SAFETY_TIMEOUT_MS = 8000;

let active = false;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
    for (const listener of listeners) listener(active);
}

/**
 * Signal that a navigation has started (or is about to). Safe to call
 * speculatively/redundantly — e.g. both PreloadLink's click handler and the
 * document-level fallback listener may fire for the same click; only the
 * first transition matters, later ones just refresh the safety timeout.
 */
export function startNavProgress(): void {
    if (safetyTimer) clearTimeout(safetyTimer);
    safetyTimer = setTimeout(doneNavProgress, SAFETY_TIMEOUT_MS);
    if (active) return;
    active = true;
    emit();
}

/** Signal that any pending navigation has resolved. Safe to call when nothing is pending (no-op). */
export function doneNavProgress(): void {
    if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
    }
    if (!active) return;
    active = false;
    emit();
}

/** Subscribe to active/inactive changes. Returns an unsubscribe function. */
export function subscribeNavProgress(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

interface TrackableClickEvent {
    defaultPrevented: boolean;
    button: number;
    metaKey: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
}

/**
 * True if `event` on `anchor` looks like a plain, same-tab, same-origin
 * link click — i.e. the kind react-router's own <Link> would intercept and
 * turn into a client-side navigation, as opposed to a modified click
 * (open-in-new-tab, save-as, non-primary button), an explicit
 * target=_blank/_parent/_top, a download link, or a cross-origin URL (full
 * page navigation).
 */
export function isTrackableLinkClick(event: TrackableClickEvent, anchor: HTMLAnchorElement): boolean {
    if (event.defaultPrevented) return false;
    if (event.button !== 0) return false;
    if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return false;
    const target = anchor.getAttribute("target");
    if (target && target !== "_self") return false;
    if (anchor.hasAttribute("download")) return false;
    if (anchor.origin !== window.location.origin) return false;
    return true;
}

let globalListenerInstalled = false;

/**
 * Fallback trigger for internal-link clicks that don't go through
 * PreloadLink (plain react-router `<Link>`/`<a>` usage elsewhere in the
 * app), plus browser back/forward (which fires no click at all). Idempotent
 * — safe to call from multiple components/effects; attaches its listeners
 * at most once per page load.
 */
export function installGlobalNavProgressListener(): void {
    if (globalListenerInstalled || typeof document === "undefined") return;
    globalListenerInstalled = true;

    document.addEventListener(
        "click",
        (event: MouseEvent) => {
            const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as
                | HTMLAnchorElement
                | null;
            if (!anchor) return;
            if (!isTrackableLinkClick(event, anchor)) return;
            startNavProgress();
        },
        { capture: true }
    );

    window.addEventListener("popstate", () => startNavProgress());
}
