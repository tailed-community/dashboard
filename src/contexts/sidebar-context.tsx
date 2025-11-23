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
  name?: string;
  initials?: string;
  email?: string;
  avatar?: string;
}

interface SidebarContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  onboardingRequired: boolean;
  refresh: () => Promise<void>;
}

// Create the context
const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Combined API fetch function with onboarding status
const fetchData = async () => {
  try {
    const res = await apiFetch("/profile");
    const userData = await res.json();
    // If no name, treat as onboarding required
    const onboardingRequired = false;
    return { userData, onboardingRequired };
  } catch (error) {
    // Network or other error, treat as onboarding required but log error
    console.error("Error loading sidebar data:", error);
    return { userData: null, onboardingRequired: true, error: error.message };
  }
};

export function SidebarContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingRequired, setOnboardingRequired] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const {
      userData,
      onboardingRequired: onboarding,
      error: fetchError,
    } = await fetchData();
    // check that userData is not empty {}
    if (userData && Object.keys(userData).length > 0) {
      setUser(userData);
    } else {
      setUser(null);
    }
    setOnboardingRequired(!!onboarding);
    setError(fetchError || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SidebarContext.Provider
      value={{ user, loading, error, onboardingRequired, refresh }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
}
