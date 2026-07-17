import { UnderConstruction } from "@/components/ui/under-construction";
import { Seo } from "@/components/seo";

export default function SpotlightPage() {
    return (
        <>
            <Seo
                title="Spotlight"
                description="Student and community spotlights from the Tail'ed network."
                path="/spotlight"
            />
            <UnderConstruction
                title="Student Spotlight"
                description="Showcase your projects, achievements, and contributions. Get recognized for your work and inspire others in the community!"
            />
        </>
    );
}
