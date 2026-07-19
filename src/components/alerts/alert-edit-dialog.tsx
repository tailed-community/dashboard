import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateAlert, type AlertPatch, type JobAlert } from "@/lib/alerts";
import { trackEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

/** Sentinel Select value standing in for "no job-type filter" (patch → null). */
const ANY_JOB_TYPE = "any";

const editAlertSchema = z.object({
    query: z.string().max(200, "Keep the search under 200 characters").optional(),
    jobType: z.enum([ANY_JOB_TYPE, "internship", "new-grad"]),
    locations: z.string().max(500, "Too many locations").optional(),
    frequency: z.enum(["daily", "weekly"]),
});

type EditAlertFormData = z.infer<typeof editAlertSchema>;

/** Split a comma-separated locations field into a trimmed, de-duped list (≤10). */
function parseLocations(raw: string | undefined): string[] | null {
    const list = (raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
    return list.length > 0 ? list : null;
}

/**
 * Shared edit affordance for a single alert. shadcn `Dialog` + react-hook-form
 * + zod (mirrors `communities/create/page.tsx`). On success it calls
 * `updateAlert`, toasts, fires `alert_edited`, then `onSaved()` (the parent
 * refetches + closes).
 */
export function AlertEditDialog({
    alert,
    open,
    onOpenChange,
    onSaved,
}: {
    alert: JobAlert;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<EditAlertFormData>({
        resolver: zodResolver(editAlertSchema),
        defaultValues: {
            query: alert.query ?? "",
            jobType: alert.jobType ?? ANY_JOB_TYPE,
            locations: (alert.locations ?? []).join(", "),
            frequency: alert.frequency,
        },
    });

    // Re-seed the form whenever a different alert is opened (the dialog instance
    // is reused across rows on the list page).
    useEffect(() => {
        if (open) {
            form.reset({
                query: alert.query ?? "",
                jobType: alert.jobType ?? ANY_JOB_TYPE,
                locations: (alert.locations ?? []).join(", "),
                frequency: alert.frequency,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, alert.id]);

    const onSubmit = async (data: EditAlertFormData) => {
        setIsSubmitting(true);
        try {
            const query = data.query?.trim() ?? "";
            const patch: AlertPatch = {
                query: query.length > 0 ? query : null,
                jobType: data.jobType === ANY_JOB_TYPE ? null : data.jobType,
                locations: parseLocations(data.locations),
                frequency: data.frequency,
            };

            await updateAlert(alert.id, patch);
            trackEvent("alert_edited", { alertId: alert.id });
            toast.success("Alert updated", {
                description: "Your next digest will use the new criteria.",
            });
            onSaved();
        } catch (error) {
            console.error("Failed to update alert:", error);
            toast.error("Couldn't update alert", {
                description: error instanceof Error ? error.message : "Please try again",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent style={{ colorScheme: "light" }}>
                <DialogHeader>
                    <DialogTitle>Edit alert</DialogTitle>
                    <DialogDescription>
                        Tune what this alert watches for. Changes apply to your next digest.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        <FormField
                            control={form.control}
                            name="query"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Search</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. software engineer" {...field} />
                                    </FormControl>
                                    <FormDescription>Leave blank to match all jobs.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="jobType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Job type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Any" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value={ANY_JOB_TYPE}>Any</SelectItem>
                                            <SelectItem value="internship">Internship</SelectItem>
                                            <SelectItem value="new-grad">New grad</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="locations"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Locations</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Toronto, Remote, Montreal" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Comma-separated. Leave blank for any location.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="frequency"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Frequency</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="daily">Daily</SelectItem>
                                            <SelectItem value="weekly">Weekly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save changes"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
