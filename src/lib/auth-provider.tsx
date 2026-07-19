import { createContext, useEffect, useState, type ReactNode } from "react";
import {
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    type User,
} from "firebase/auth";
import { studentAuth } from "./auth";

const AUTH_HINT_KEY = "tailed:auth-hint";

/**
 * Best-effort read of the last-known sign-in state, written synchronously by
 * a previous session so the very first render (before Firebase's async
 * onAuthStateChanged has fired) can guess correctly instead of always
 * assuming "signed out". Guarded because localStorage throws in some privacy
 * modes (e.g. Safari private browsing, some ITP configurations).
 */
function readAuthHint(): boolean {
    try {
        return window.localStorage.getItem(AUTH_HINT_KEY) === "in";
    } catch {
        return false;
    }
}

function writeAuthHint(signedIn: boolean) {
    try {
        window.localStorage.setItem(AUTH_HINT_KEY, signedIn ? "in" : "out");
    } catch {
        // Ignore — privacy mode or storage disabled. Worst case we fall back
        // to the signed-out shell while loading next time.
    }
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    /**
     * Best-effort guess of sign-in state from a prior session, sourced from
     * localStorage and only meaningful while `loading` is true. Once
     * `loading` is false, `user` is authoritative and this should be
     * ignored. Lets chrome that switches between signed-in/signed-out UI
     * (header, avatar menu, etc.) avoid flashing the wrong state on a hard
     * reload while Firebase's async check is still in flight.
     */
    likelySignedIn: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    // Seeded synchronously from localStorage at mount so it's correct on the
    // very first render — no effect/render delay.
    const [likelySignedIn, setLikelySignedIn] = useState<boolean>(() => readAuthHint());

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        let cancelled = false;

        setPersistence(studentAuth, browserLocalPersistence)
            .catch((error) => {
                // Persistence failures shouldn't block auth state from being
                // observed — fall through and subscribe anyway.
                console.error("Failed to set auth persistence:", error);
            })
            .finally(() => {
                if (cancelled) return;
                unsubscribe = onAuthStateChanged(studentAuth, (nextUser) => {
                    setUser(nextUser);
                    setLoading(false);
                    const signedIn = !!nextUser;
                    setLikelySignedIn(signedIn);
                    writeAuthHint(signedIn);
                });
            });

        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, likelySignedIn }}>
            {children}
        </AuthContext.Provider>
    );
};
