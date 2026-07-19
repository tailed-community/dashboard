import type { ReactNode } from "react";
import { LabSwitcher } from "@/pages/design-lab/lab-shared";
import { PlaygroundHeader, type PlaygroundActiveNav, type PlaygroundHeaderCta } from "@/components/playground/playground-header";
import { PlaygroundFooter } from "@/components/playground/playground-footer";
import { PlaygroundRoutesProvider, LAB_ROUTES, type PlaygroundRoutes } from "@/components/playground/playground-routes";

/**
 * Full-page shell: header + body + footer, wrapped in the route-map provider
 * so every nested chrome/primitive component (nav links, CTAs, job result
 * rows, ...) resolves paths through `routes` instead of hardcoding them.
 *
 * `showSwitcher` must be passed explicitly by callers — it must never be
 * inferred from the current path, so the LabSwitcher can't leak onto live
 * routes once those are mounted with this same shell.
 */
export function PlaygroundShell({
    routes = LAB_ROUTES,
    showSwitcher,
    activeNav = null,
    variant = "full",
    cta,
    children,
}: {
    routes?: PlaygroundRoutes;
    showSwitcher: boolean;
    activeNav?: PlaygroundActiveNav;
    variant?: "full" | "wordmark";
    cta?: PlaygroundHeaderCta;
    children: ReactNode;
}) {
    return (
        <PlaygroundRoutesProvider routes={routes}>
            <div className="font-joy-body min-h-screen w-full overflow-x-hidden bg-joy-surface text-joy-ink">
                <PlaygroundHeader activeNav={activeNav} variant={variant} cta={cta} />
                {children}
                <PlaygroundFooter />
                {showSwitcher && <LabSwitcher />}
            </div>
        </PlaygroundRoutesProvider>
    );
}
