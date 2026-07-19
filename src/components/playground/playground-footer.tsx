import { Link } from "react-router-dom";
import { Github } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { usePlaygroundRoutes } from "@/components/playground/playground-routes";

/**
 * Footer bar shared by every Playground page. The 7 source pages had drifted
 * into three slightly different versions of this (icon+text vs. icon-only vs.
 * text-only GitHub/Discord links) — this reconciles on the icon+text version,
 * which was already the plurality (jobs, job-detail, community-detail).
 */
export function PlaygroundFooter() {
    const routes = usePlaygroundRoutes();
    return (
        <footer className="border-t border-joy-ink/8 px-5 py-8">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
                <div className="flex items-center gap-2 text-joy-ink">
                    <span className="joy-display text-sm font-bold">Tail&apos;ed Community</span>
                    <span className="text-xs text-joy-ink/40">· built by students, for students</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-joy-ink-muted">
                    <a
                        href="https://github.com/tailed-community"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                    >
                        <Github className="h-4 w-4" aria-hidden="true" />
                        GitHub
                    </a>
                    <a
                        href="https://discord.gg/gpbtFXTgNQ"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                    >
                        <SiDiscord className="h-4 w-4" aria-hidden="true" />
                        Discord
                    </a>
                    <Link
                        to={routes.signIn}
                        className="rounded hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                    >
                        Sign in
                    </Link>
                </div>
            </div>
        </footer>
    );
}
