import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { apiFetch } from "@/lib/fetch";

// Define types for our data
interface User {
  name: string;
  initials: string;
  email: string;
  avatar: string;
}

interface SidebarContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Create the context
const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Combined API fetch function
const fetchData = async () => {
  const [userData] = await Promise.all([
    apiFetch("/profile").then((res) => {
      if (!res.ok) throw new Error("Failed to fetch user profile");
      return res.json();
    }),
  ]);

  return { userData };
};

export function SidebarContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { userData } = await fetchData();
      setUser(userData);
      setError(null);
    } catch (error) {
      console.error("Error loading sidebar data:", error);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch if data isn't already loaded
    if (!user) {
      refresh();
    } else {
      setLoading(false);
    }
  }, [user, refresh]);

  return (
    <SidebarContext.Provider value={{ user, loading, error, refresh }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
