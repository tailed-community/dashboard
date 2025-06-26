import { createContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { studentAuth } from "./auth";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
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

  if (loading) return null; // ⏳ Delay rendering until auth state is ready

  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
};
