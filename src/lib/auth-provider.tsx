import { createContext, useEffect, useState, type ReactNode } from "react";
import {
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    type User,
} from "firebase/auth";
import { studentAuth } from "./auth";

interface AuthContextType {
    user: User | null;
    loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true); // 🔹 Prevents app from rendering too soon

    useEffect(() => {
        // const app = getApp(); // Ensure Firebase app is initialized

        setPersistence(studentAuth, browserLocalPersistence).then(() => {
            const unsubscribe = onAuthStateChanged(studentAuth, (user) => {
                setUser(user);
                setLoading(false); // ✅ Firebase finished checking
            });

            return () => unsubscribe();
        });
    }, []);

    // Show loading state while Firebase auth initializes
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-700">
                <div className="relative">
                    <div className="h-12 w-12 border-4 border-gray-300 rounded-full"></div>
                    <div className="absolute top-0 left-0 h-12 w-12 border-4 border-t-primary border-transparent rounded-full animate-spin"></div>
                </div>
                <p className="mt-4 text-sm font-medium text-gray-600 animate-pulse">
                    Loading, please wait...
                </p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
