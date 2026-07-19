import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { deleteAlert, type JobAlert } from "@/lib/alerts";
import { trackEvent } from "@/lib/analytics";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { alertTitle } from "@/components/alerts/alert-shared";

/**
 * Delete-confirmation for a single alert. shadcn `AlertDialog` → `deleteAlert`
 * → toast → `onDeleted()` (parent refetches the list or navigates back).
 */
export function AlertDeleteDialog({
    alert,
    open,
    onOpenChange,
    onDeleted,
}: {
    alert: JobAlert;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDeleted: () => void;
}) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteAlert(alert.id);
            trackEvent("alert_deleted", { alertId: alert.id });
            toast.success("Alert deleted", {
                description: "You won't receive any more digests for it.",
            });
            onDeleted();
        } catch (error) {
            console.error("Failed to delete alert:", error);
            toast.error("Couldn't delete alert", {
                description: error instanceof Error ? error.message : "Please try again",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent style={{ colorScheme: "light" }}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete this alert?</AlertDialogTitle>
                    <AlertDialogDescription>
                        &ldquo;{alertTitle(alert)}&rdquo; and its digest history will be permanently
                        removed. This can&apos;t be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            // Keep the dialog mounted while the request is in flight;
                            // the parent closes it via onDeleted.
                            e.preventDefault();
                            handleDelete();
                        }}
                        disabled={isDeleting}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            "Delete alert"
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
