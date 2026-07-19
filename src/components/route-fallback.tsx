/**
 * App-wide Suspense fallback for lazy route chunks (see App.tsx). Only shows
 * on a "cold" entry into a still-lazy route — a deep link straight to
 * /account, a hard reload on a lazy page, etc. — since client-side
 * navigation between already-mounted routes stays on the old page under
 * react-router v7's default startTransition wrapping (the top-of-viewport
 * NavProgressBar covers that in-flight case instead; see
 * src/components/nav-progress-bar.tsx).
 *
 * Styled as a calm branded skeleton — joy-surface background, a header-shape
 * placeholder matching PlaygroundHeader's proportions, and gently pulsing
 * rounded content blocks — rather than a spinner, so it reads as
 * "intentional" whether it's on screen for 50ms or 2s.
 */
export function RouteFallback() {
    return (
        <div className="min-h-screen w-full bg-joy-surface" aria-busy="true">
            <span className="sr-only">Loading</span>

            {/* Header placeholder, same shape/height as PlaygroundHeader so the real header doesn't jump into place. */}
            <div
                className="sticky top-0 z-40 bg-gradient-to-b from-joy-mint/95 via-joy-surface/92 to-joy-surface/75 backdrop-blur-md"
                aria-hidden="true"
            >
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
                    <div className="h-8 w-[105px] animate-pulse rounded-md bg-joy-ink/10" />
                    <div className="hidden items-center gap-2 md:flex">
                        <div className="h-8 w-16 animate-pulse rounded-lg bg-joy-ink/8" />
                        <div className="h-8 w-16 animate-pulse rounded-lg bg-joy-ink/8" />
                        <div className="h-8 w-20 animate-pulse rounded-lg bg-joy-ink/8" />
                    </div>
                    <div className="h-8 w-8 animate-pulse rounded-full bg-joy-ink/10" />
                </div>
            </div>

            {/* Content skeleton — generic rounded blocks, calm at both card-grid and form-page scale. */}
            <div className="mx-auto max-w-6xl px-5 py-10" aria-hidden="true">
                <div className="mb-8 h-8 w-2/3 max-w-sm animate-pulse rounded-lg bg-joy-ink/8 sm:w-1/3" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-40 animate-pulse rounded-2xl bg-joy-ink/6"
                            style={{ animationDelay: `${i * 75}ms` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
