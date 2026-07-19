import { UnifiedJobBoard } from "@/components/unified-job-board";
import { Seo } from "@/components/seo";

export default function JobsPage() {
    return (
        <>
            <Seo
                title="Tech Internships & New-Grad Jobs for Students"
                description="Browse thousands of tech internships and new-grad jobs. Updated daily. Free forever — no account required to search."
                path="/jobs"
            />
            <div className="flex flex-1 flex-col gap-6 p-6">
                <div className="max-w-6xl mx-auto w-full">
                    <h1 className="text-3xl font-bold mb-2">All Opportunities</h1>
                    <p className="text-muted-foreground mb-6">Browse all available positions</p>
                    <UnifiedJobBoard />
                </div>
            </div>
        </>
    );
}
