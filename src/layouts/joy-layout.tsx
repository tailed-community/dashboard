import { Outlet } from "react-router-dom";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";

/**
 * Thin layout that supplies the joy chrome (PlaygroundShell header/footer) to
 * pages that do NOT render their own shell. Reuses the exact same PlaygroundShell
 * as the self-shelling joy pages, wired to the live route map. `showSwitcher` is
 * false so the design-lab switcher never leaks onto live routes.
 */
export function JoyLayout() {
    return (
        <PlaygroundShell routes={LIVE_ROUTES} showSwitcher={false}>
            <Outlet />
        </PlaygroundShell>
    );
}
