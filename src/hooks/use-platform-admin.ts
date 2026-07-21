import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

interface PlatformAdminState {
    isPlatformAdmin: boolean;
    loading: boolean;
}

/**
 * usePlatformAdmin - Reads the `platformAdmin` custom claim off the signed-in
 * user's Firebase ID token.
 *
 * Custom claims aren't available on the `User` object itself — they only
 * come back via `getIdTokenResult()`, which is why this can't just read a
 * field off `useAuth().user`. Results are memoized per user id so switching
 * between two already-fetched users (or the same user across remounts)
 * doesn't refetch the token result unnecessarily; a fresh sign-in/sign-out
 * (or a different uid) always re-resolves.
 *
 * `loading` is true both while auth itself is still resolving AND while the
 * claim lookup for the current user is in flight, so callers (e.g.
 * AdminRoute) can gate on a single flag.
 */
export function usePlatformAdmin(): PlatformAdminState {
    const { user, loading: authLoading } = useAuth();
    const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
    const [claimLoading, setClaimLoading] = useState(true);
    // Tracks which uid the current isPlatformAdmin value was resolved for, so
    // we can skip refetching when the same user re-renders this hook.
    const resolvedForUid = useRef<string | null>(null);

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (!user) {
            resolvedForUid.current = null;
            setIsPlatformAdmin(false);
            setClaimLoading(false);
            return;
        }

        if (resolvedForUid.current === user.uid) {
            setClaimLoading(false);
            return;
        }

        let cancelled = false;
        setClaimLoading(true);

        user.getIdTokenResult()
            .then((tokenResult) => {
                if (cancelled) return;
                resolvedForUid.current = user.uid;
                setIsPlatformAdmin(tokenResult.claims.platformAdmin === true);
            })
            .catch((error) => {
                console.error("Failed to resolve platform admin claim:", error);
                if (cancelled) return;
                resolvedForUid.current = null;
                setIsPlatformAdmin(false);
            })
            .finally(() => {
                if (cancelled) return;
                setClaimLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [user, authLoading]);

    return {
        isPlatformAdmin,
        loading: authLoading || claimLoading,
    };
}
