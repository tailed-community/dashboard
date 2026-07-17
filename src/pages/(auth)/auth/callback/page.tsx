import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { completeSignIn } from "@/lib/auth";
import { apiFetch } from "@/lib/fetch";
import { useSidebarContext } from "@/contexts/sidebar-context";
import { trackEvent } from "@/lib/analytics";

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasCompletedRef = useRef(false); // Track if sign-in has been attempted
  const { refresh } = useSidebarContext(); // Get the refresh function

  // look for redirectUrl param and pass it to completeSignIn
  const url = new URL(window.location.href);
  const redirectUrl = url.searchParams.get("redirectUrl");

  useEffect(() => {
    if (hasCompletedRef.current) return; // Prevent multiple calls
    hasCompletedRef.current = true;

    completeSignIn()
      .then(async (user) => {
        if (user) {
          // Ensure a profiles/{uid} doc exists for email-link sign-ins (Google
          // sign-in already calls this from login-form.tsx). Never strand the
          // user on failure here — log and continue regardless.
          try {
            await apiFetch("/auth/ensure-account", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
          } catch (ensureError) {
            console.error("ensure-account failed:", ensureError);
          }

          trackEvent("auth_completed", { method: "email_link" });
          await refresh(); // Refresh user data in context
          navigate(redirectUrl || "/dashboard"); // Redirect to the specified URL or dashboard after login
        }
      })
      .catch((error) => {
        console.error("Sign-in error:", error);
      });
  }, [navigate]);

  return null;
}
