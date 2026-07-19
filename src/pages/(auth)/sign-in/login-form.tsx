import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { Loader2, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { m } from "@/paraglide/messages.js";
import { signInWithGoogle } from "@/lib/auth";
import { apiFetch } from "@/lib/fetch";
import { trackEvent } from "@/lib/analytics";
import { EmailLoginForm } from "./email-login-form";

interface LoginProps extends React.ComponentProps<"div"> {
    /** Both /sign-in and /sign-up render this same component; mode only changes copy. */
    mode?: "sign-in" | "sign-up";
}

export function LoginForm({ className, mode = "sign-in", ...props }: LoginProps) {
    const [showEmailLogin, setShowEmailLogin] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectUrl = searchParams.get("redirectUrl") || undefined;
    const isSignUp = mode === "sign-up";

    // If showing email login, render the EmailLoginForm component
    if (showEmailLogin) {
        return (
            <EmailLoginForm
                className={className}
                onChangeLoginType={() => setShowEmailLogin(false)}
                redirectUrl={redirectUrl}
                mode={mode}
                {...props}
            />
        );
    }

    const handleGoogleSignIn = async () => {
        try {
            setAuthLoading(true);
            setAuthError(null);
            trackEvent("auth_started", { method: "google" });

            const { user } = await signInWithGoogle();

            // Parse displayName/photoURL so the profile doc has a name from the start.
            // Never blocks navigation: ensure-account failures are logged, not fatal.
            const [firstName, ...rest] = (user.displayName || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean);
            const lastName = rest.join(" ");

            try {
                await apiFetch("/auth/ensure-account", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...(firstName ? { firstName } : {}),
                        ...(lastName ? { lastName } : {}),
                        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
                    }),
                });
            } catch (ensureError) {
                console.error("ensure-account failed:", ensureError);
            }

            trackEvent("auth_completed", { method: "google" });
            navigate(redirectUrl || "/dashboard");
        } catch (err) {
            console.error(err);
            setAuthError(
                "Google sign-in failed. Please try again or continue with email instead."
            );
        } finally {
            setAuthLoading(false);
        }
    };

    return (
        <div
            className={cn(
                "flex flex-col gap-6 w-full max-w-md mx-auto",
                className
            )}
            {...props}
        >
            <Card className="overflow-hidden">
                <CardContent className="p-8">
                    <div className="flex flex-col gap-4 margin-bottom-4">
                        <div className="flex flex-col items-center text-center">
                            <img
                                src="/Tailed_Community_logo.png"
                                alt="Logo"
                                width={155}
                                height={65}
                                className="mb-4"
                            />

                            <h1 className="text-2xl font-bold">
                                {isSignUp
                                    ? "Join Tail'ed Community — free forever"
                                    : m.welcome_back()}
                            </h1>
                            <p className="text-balance text-muted-foreground">
                                {isSignUp
                                    ? "One click to get live jobs, events, and communities."
                                    : m.login_to_your_account()}
                            </p>
                            {authError && (
                                <p className="text-sm text-red-600 mt-2">
                                    {authError}
                                </p>
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
                            disabled={authLoading}
                        >
                            <Mail className="mr-2 h-4 w-4" />
                            Continue with Email
                        </Button>
                    </div>
                    <div className="text-center text-sm mt-4">
                        {isSignUp ? (
                            <>
                                Already have an account?{" "}
                                <Link
                                    to={
                                        redirectUrl
                                            ? `/sign-in?redirectUrl=${encodeURIComponent(redirectUrl)}`
                                            : "/sign-in"
                                    }
                                    className="underline underline-offset-4"
                                >
                                    Sign in
                                </Link>
                            </>
                        ) : (
                            <>
                                Don't have an account?{" "}
                                <Link
                                    to={
                                        redirectUrl
                                            ? `/sign-up?redirectUrl=${encodeURIComponent(redirectUrl)}`
                                            : "/sign-up"
                                    }
                                    className="underline underline-offset-4"
                                >
                                    Sign up
                                </Link>
                            </>
                        )}
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
                <Link to="/terms-and-conditions">{m.terms_of_service()}</Link>{" "}
                {m.and()} <Link to="/privacy">{m.privacy_policy()}</Link>.
            </div>
        </div>
    );
}
