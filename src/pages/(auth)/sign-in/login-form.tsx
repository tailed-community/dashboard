import { cn } from "@/lib/utils";
import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { SiLinkedin, SiApple } from "react-icons/si";
import { Loader2, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { m } from "@/paraglide/messages.js";
import { signInWithGoogle } from "@/lib/auth";
import { apiFetch } from "@/lib/fetch";
import { EmailLoginForm } from "./email-login-form";

//TODO: Add github?

interface LoginProps extends React.ComponentProps<"div"> {
  onChangeLoginType: () => void;
}

const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type SignUpData = z.infer<typeof signUpSchema>;

export function LoginForm({
  className,
  onChangeLoginType,
  ...props
}: LoginProps) {
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // If showing email login, render the EmailLoginForm component
  if (showEmailLogin) {
    return (
      <EmailLoginForm
        className={className}
        onChangeLoginType={() => setShowEmailLogin(false)}
        {...props}
      />
    );
  }

  const handleGoogleSignIn = async () => {
    try {
      setAuthLoading(true);
      setAuthError(null);

      const { user } = await signInWithGoogle();

      // TODO: Call api to add student in db
      // TODO: Check if user exists, if not, create account
      const userData: SignUpData = {
        email: user.email || "",
      };

      await apiFetch("/auth/create-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      window.location.href = "/dashboard";
    } catch (err) {
      setAuthError("Authentication failed. Please try again.");
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };
  return (
    <div
      className={cn("flex flex-col gap-6 w-full max-w-md mx-auto", className)}
      {...props}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center text-center">
              <img
                src="/tailed-logo-fixed-shadow.svg"
                alt="Logo"
                width={155}
                height={65}
                className="mb-4"
              />

              <h1 className="text-2xl font-bold">{m.welcome_back()}</h1>
              <p className="text-balance text-muted-foreground">
                {m.login_to_your_account()}
              </p>
              {authError && (
                <p className="text-sm text-red-600 mt-2">{authError}</p>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
            >
              {authLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FcGoogle className="mr-2 h-4 w-4" />
              )}
              Continue with Google
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowEmailLogin(true)}
            >
              <Mail className="mr-2 h-4 w-4" />
              Continue with Email
            </Button>

            <Button variant="outline" className="w-full" disabled>
              {authLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SiLinkedin className="mr-2 h-4 w-4" />
              )}
              Continue with LinkedIn
            </Button>

            <Button variant="outline" className="w-full" disabled>
              {authLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SiApple className="mr-2 h-4 w-4" />
              )}
              Continue with Apple
            </Button>
          </div>
          <a href="https://tailed.ca/sign-in">
            <Button variant="secondary" className="mt-8 w-full">
              I represent a company - Go to Company Portal
            </Button>
          </a>
        </CardContent>
      </Card>
      <div className="mt-4 text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        {m.by_clicking_continue_you_agree_to_our()}{" "}
        <Link to="/terms-and-conditions">{m.terms_of_service()}</Link> {m.and()}{" "}
        <Link to="/privacy">{m.privacy_policy()}</Link>.
      </div>
    </div>
  );
}
