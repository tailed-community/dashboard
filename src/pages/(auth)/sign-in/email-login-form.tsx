import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { sendLoginLink, TENANT_IDS } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { m } from "@/paraglide/messages.js";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Zod schema for email validation
const emailLoginSchema = z.object({
    email: z.string().email("Invalid email address"),
    redirectUrl: z.string().optional(),
});

type EmailLoginData = z.infer<typeof emailLoginSchema>;

interface EmailLoginProps extends React.ComponentProps<"div"> {
    onChangeLoginType: () => void;
    redirectUrl?: string; // Add optional redirectUrl prop
    /** Both /sign-in and /sign-up render this same component; mode only changes copy. */
    mode?: "sign-in" | "sign-up";
}

// add redirectUrl field to form
export function EmailLoginForm({
    className,
    onChangeLoginType,
    redirectUrl,
    mode = "sign-in",
    ...props
}: EmailLoginProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [linkSent, setLinkSent] = useState(false);
    const isSignUp = mode === "sign-up";

    // React Hook Form setup with Zod validation
    const form = useForm<EmailLoginData>({
        resolver: zodResolver(emailLoginSchema),
        defaultValues: {
            email: "",
            redirectUrl: redirectUrl || "",
        },
    });

    const onSubmit = async (data: EmailLoginData) => {
        setIsLoading(true);
        trackEvent("auth_started", { method: "email_link" });

        try {
            // No existence pre-check, no rejection: always send the link.
            // Firebase creates the auth user on completion for new emails.
            await sendLoginLink(
                data.email,
                TENANT_IDS.STUDENTS,
                data.redirectUrl
            );

            setLinkSent(true);
            toast.success("Check your email", {
                description:
                    "We sent you a sign-in link. New here? Clicking it creates your free account.",
            });
        } catch (error) {
            console.error("Login error:", error);

            // Handle Firebase Auth errors
            if (error && typeof error === "object" && "code" in error) {
                const errorCode = (error as { code: string }).code;

                if (errorCode === "auth/too-many-requests") {
                    toast.error("Too many requests", {
                        description: "Please wait a moment before trying again",
                    });
                } else if (errorCode === "auth/invalid-email") {
                    toast.error("Invalid email", {
                        description: "Please double-check the email address",
                    });
                } else {
                    toast.error("Couldn't send the link", {
                        description: "An error occurred. Please try again.",
                    });
                }
            } else {
                toast.error("Couldn't send the link", {
                    description: "An unexpected error occurred",
                });
            }
        } finally {
            setIsLoading(false);
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
                    {linkSent ? (
                        <div className="flex flex-col items-center text-center gap-4 py-4">
                            <img
                                src="/Tailed_Community_logo.png"
                                alt="Logo"
                                width={155}
                                height={65}
                                className="mb-2"
                            />
                            <Mail className="h-10 w-10 text-muted-foreground" />
                            <h1 className="text-2xl font-bold">
                                Check your email
                            </h1>
                            <p className="text-balance text-muted-foreground">
                                We sent a sign-in link to your inbox. New here?
                                Clicking it creates your free account — nothing
                                else to fill in.
                            </p>
                            <Button
                                type="button"
                                variant="link"
                                onClick={() => setLinkSent(false)}
                            >
                                Use a different email
                            </Button>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form
                                className="flex flex-col gap-6"
                                onSubmit={form.handleSubmit(onSubmit)}
                            >
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
                                            ? "Join Tail'ed — free forever"
                                            : m.welcome_back()}
                                    </h1>
                                    <p className="text-balance text-muted-foreground">
                                        We'll email you a sign-in link. New
                                        here? This creates your free account.
                                    </p>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{m.email()}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="email"
                                                    placeholder="m@example.com"
                                                    disabled={isLoading}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex flex-col">
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Continue with email
                                    </Button>

                                    <Button
                                        type="button"
                                        className="cursor-pointer"
                                        variant="link"
                                        onClick={onChangeLoginType}
                                        disabled={isLoading}
                                    >
                                        Back
                                    </Button>
                                </div>

                                <div className="text-center text-sm">
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
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>{" "}
            <div className="mt-4 text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
                {m.by_clicking_continue_you_agree_to_our()}{" "}
                <Link to="/terms-and-conditions">{m.terms_of_service()}</Link>{" "}
                {m.and()} <Link to="/privacy">{m.privacy_policy()}</Link>.
            </div>
        </div>
    );
}
