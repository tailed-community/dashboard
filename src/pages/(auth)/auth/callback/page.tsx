import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { completeSignIn } from "@/lib/auth";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    completeSignIn()
      .then((user) => {
        if (user) {
          navigate("/dashboard"); // Redirect to your dashboard after login
        }
      })
      .catch((error) => {
        console.error("Sign-in error:", error);
      });
  }, [navigate]);

  return null;
}
