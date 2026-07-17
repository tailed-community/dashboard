import { UnderConstruction } from "@/components/ui/under-construction";
import { Seo } from "@/components/seo";

export default function CompaniesPage() {
    return (
        <>
            <Seo
                title="Companies Hiring Students"
                description="Explore companies hiring interns and new grads through Tail'ed."
                path="/companies"
            />
            <UnderConstruction
                title="Discover Companies"
                description="Explore companies hiring students and new grads. Learn about their culture, tech stack, and open positions. Coming soon!"
            />
        </>
    );
}
