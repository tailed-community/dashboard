import { Link } from "react-router-dom";
import { LAB_VARIANTS } from "./lab-shared";

const PLAYGROUND_PAGES = [
    { to: "/design-lab/playground/jobs", label: "Jobs" },
    { to: "/design-lab/playground/events", label: "Events" },
    { to: "/design-lab/playground/communities", label: "Communities" },
];

/**
 * Design-lab index: internal prototype gallery for landing redesign
 * directions. Not linked from anywhere in the product on purpose.
 */
export default function DesignLabPage() {
    return (
        <div className="min-h-screen bg-gray-950 px-6 py-16 text-white">
            <div className="mx-auto max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Internal · Prototypes
                </p>
                <h1 className="mt-2 text-4xl font-bold tracking-tight">
                    Tail'ed design lab
                </h1>
                <p className="mt-3 text-gray-400">
                    Standalone landing-page redesign directions, each using live
                    feed data. Pick one:
                </p>
                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                    {LAB_VARIANTS.map((v) => (
                        <Link
                            key={v.slug}
                            to={`/design-lab/${v.slug}`}
                            className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/30 hover:bg-white/10"
                        >
                            <h2 className="text-lg font-semibold group-hover:underline">
                                {v.label}
                            </h2>
                            <p className="mt-1 text-sm text-gray-400">{v.blurb}</p>
                        </Link>
                    ))}
                </div>

                <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
                        Playground, expanded
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">
                        The Playground direction applied to the rest of the product, not just the landing page.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        {PLAYGROUND_PAGES.map((p) => (
                            <Link
                                key={p.to}
                                to={p.to}
                                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-gray-300 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                            >
                                {p.label}
                            </Link>
                        ))}
                    </div>
                </div>
                <p className="mt-10 text-sm text-gray-600">
                    <Link to="/" className="underline hover:text-gray-400">
                        ← back to current landing
                    </Link>
                </p>
            </div>
        </div>
    );
}
