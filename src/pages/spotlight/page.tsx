import { Sparkles } from "lucide-react";
import { Seo } from "@/components/seo";
import { PlaygroundButton } from "@/components/playground/playground-button";

export default function SpotlightPage() {
    return (
        <div style={{ colorScheme: "light" }}>
            <Seo
                title="Spotlight"
                description="Student and community spotlights from the Tail'ed Community network."
                path="/spotlight"
            />
            <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-8 px-6 py-12">
                <div className="flex max-w-md flex-col items-center gap-6 text-center">
                    <div className="flex size-24 items-center justify-center rounded-3xl bg-joy-sun/25 shadow-sm">
                        <Sparkles className="h-12 w-12 text-joy-sun-ink" />
                    </div>
                    <div className="space-y-3">
                        <h1 className="joy-display text-4xl font-extrabold tracking-tight text-joy-ink">
                            Student Spotlight
                        </h1>
                        <p className="text-lg leading-relaxed text-joy-ink-muted">
                            Showcase your projects, achievements, and contributions. Get recognized for your work and inspire others in the community!
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <PlaygroundButton to="/" variant="outline">
                        Go Home
                    </PlaygroundButton>
                    <PlaygroundButton to="/jobs">Browse Jobs</PlaygroundButton>
                </div>
            </div>
        </div>
    );
}
