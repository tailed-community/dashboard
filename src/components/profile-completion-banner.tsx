import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch";
import { getStorageTimestamp, setStorageTimestamp } from "@/lib/storage-flags";

const DISMISSED_AT_KEY = "profileBannerDismissedAt";
const RESHOW_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Compact, dismissible nudge to finish the profile (school & program).
 * Never blocks anything — purely informational, shown only on /dashboard
 * when the profile is missing basic identity fields.
 */
export function ProfileCompletionBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const dismissedAt = getStorageTimestamp("local", DISMISSED_AT_KEY);
        if (dismissedAt && Date.now() - dismissedAt < RESHOW_AFTER_MS) {
            return;
        }

        apiFetch("/profile")
            .then((res) => (res.ok ? res.json() : null))
            .then((profile) => {
                if (cancelled || !profile) return;
                const incomplete =
                    !profile.firstName || !profile.school || !profile.program;
                setVisible(incomplete);
            })
            .catch((error) => {
                console.error("Failed to load profile completeness:", error);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (!visible) return null;

    const handleDismiss = () => {
        setStorageTimestamp("local", DISMISSED_AT_KEY);
        setVisible(false);
    };

    return (
        <Card className="border-brand-orange/30 bg-brand-orange/5">
            <CardContent className="flex items-center justify-between gap-4 p-4">
                <p className="text-sm">
                    Add your school & program so employers and communities can
                    find you — 30 seconds.
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Button asChild size="sm">
                        <Link to="/account">Complete profile</Link>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDismiss}
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
