import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { completeSignIn } from "@/lib/auth";

export default function AuthCallback() {
  // https://tailed-451211.firebaseapp.com/__/auth/action?apiKey=AIzaSyDJ9TwerI7yAb5Wsqcys38O9K1gQISaNgI&mode=signIn&oobCode=bafVxevTfHO5JRvnkorbvD1EDGhSJSAZYab7KpqXj1sAAAGVNj4Xfg&continueUrl=http://localhost:3000/auth/callback&lang=en

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
