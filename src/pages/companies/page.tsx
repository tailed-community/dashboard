import { Building2 } from "lucide-react";
import { Seo } from "@/components/seo";
import { PlaygroundButton } from "@/components/playground/playground-button";

export default function CompaniesPage() {
    return (
        <>
            <Seo
                title="Companies Hiring Students"
                description="Explore companies hiring interns and new grads through Tail'ed."
                path="/companies"
            />
            <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-8 px-6 py-12 text-center">
                <div className="flex max-w-md flex-col items-center gap-6">
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-joy-grass/10 text-joy-grass">
                        <Building2 className="h-14 w-14" />
                    </div>
                    <div className="space-y-3">
                        <h1 className="joy-display text-4xl font-extrabold tracking-tight text-joy-ink">
                            Discover Companies
                        </h1>
                        <p className="text-lg leading-relaxed text-joy-ink-muted">
                            Explore companies hiring students and new grads.
                            Learn about their culture, tech stack, and open
                            positions. Coming soon!
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                    <PlaygroundButton to="/" variant="outline">
                        Go Home
                    </PlaygroundButton>
                    <PlaygroundButton to="/jobs">Browse Jobs</PlaygroundButton>
                </div>
            </div>
        </>
    );
}
