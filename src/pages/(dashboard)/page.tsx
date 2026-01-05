import { UnifiedJobBoard } from "@/components/unified-job-board";

export default function Page() {
    return (
        <div className="flex flex-1 flex-col gap-6 p-6">
            <div className="max-w-6xl mx-auto w-full">
                <h1 className="text-3xl font-bold mb-2">Your Dashboard</h1>
                <p className="text-muted-foreground mb-6">Track your applications and discover new opportunities</p>
                <UnifiedJobBoard limit={10} />
            </div>
        </div>
    );
}