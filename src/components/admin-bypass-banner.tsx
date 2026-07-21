import { ShieldAlert } from "lucide-react";

interface AdminBypassBannerProps {
    /** What is being edited, e.g. "event" or "community". */
    resource: string;
    className?: string;
}

/**
 * Shown when a platform admin is editing something they don't own.
 *
 * Admins reach owner forms through a permission bypass, which makes it easy to
 * forget you're editing someone else's content — the form looks identical to
 * the owner's. This states plainly whose chair you're sitting in and that the
 * change is recorded, so the audit trail is never a surprise after the fact.
 */
export function AdminBypassBanner({ resource, className }: AdminBypassBannerProps) {
    return (
        <div
            role="status"
            className={`flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 ${className ?? ""}`}
        >
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="text-sm">
                <p className="font-semibold">You're editing as a platform admin</p>
                <p className="mt-1 text-amber-800">
                    You don't own this {resource}. Your changes will be saved to the audit
                    log along with your account and what you changed.
                </p>
            </div>
        </div>
    );
}
