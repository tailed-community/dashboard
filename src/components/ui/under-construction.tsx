import { Construction } from "lucide-react";
import { Button } from "./button";
import { Link } from "react-router-dom";

interface UnderConstructionProps {
    title: string;
    description?: string;
    showBackButton?: boolean;
}

export function UnderConstruction({
    title,
    description = "We're working hard to bring you this feature. Check back soon!",
    showBackButton = true,
}: UnderConstructionProps) {
    return (
        <div className="container flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-8 py-12 px-6">
            <div className="flex flex-col items-center gap-6 text-center max-w-md">
                <div className="rounded-full bg-muted p-8">
                    <Construction className="h-16 w-16 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                    <h1 className="text-4xl font-bold tracking-tight">
                        {title}
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>
            {showBackButton && (
                <div className="flex gap-4">
                    <Button asChild variant="outline" size="lg" className="rounded-full">
                        <Link to="/">Go Home</Link>
                    </Button>
                    <Button asChild size="lg" className="rounded-full">
                        <Link to="/jobs">Browse Jobs</Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
