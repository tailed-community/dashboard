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
import { apiFetch } from "@/lib/fetch";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
}

// add redirectUrl field to form
export function EmailLoginForm({
    className,
    onChangeLoginType,
    redirectUrl,
    ...props
}: EmailLoginProps) {
    const [isLoading, setIsLoading] = useState(false);

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

        try {
            // First, check if the user exists
            const checkResponse = await apiFetch("/auth/check-user-exists", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email: data.email }),
            });

            const checkResult = await checkResponse.json();

            if (!checkResult.exists) {
                toast.error("Account not found", {
                    description:
                        "No account exists with this email. Please sign up first.",
                });
                setIsLoading(false);
                return;
            }

            // If the account exists, send the login link
            await sendLoginLink(
                data.email,
                TENANT_IDS.STUDENTS,
                data.redirectUrl
            );

            toast.success("Login link sent", {
                description: "Check your email for the login link",
            });
        } catch (error) {
            console.error("Login error:", error);

            // Handle Firebase Auth errors
            if (error && typeof error === "object" && "code" in error) {
                const errorCode = (error as { code: string }).code;

                if (
                    errorCode === "auth/user-not-found" ||
                    errorCode === "auth/admin-restricted-operation"
                ) {
                    toast.error("User not found", {
                        description:
                            "No account exists with this email address. Please sign up first.",
                    });
                } else if (errorCode === "auth/too-many-requests") {
                    toast.error("Too many requests", {
                        description: "Please wait a moment before trying again",
                    });
                } else {
                    toast.error("Login failed", {
                        description: "An error occurred during login",
                    });
                }
            } else {
                toast.error("Login failed", {
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
                                    {m.welcome_back()}
                                </h1>
                                <p className="text-balance text-muted-foreground">
                                    {m.login_to_your_account()}
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
                                    {m.login() + " / " + m.sign_up()}
                                </Button>

                                <Button
                                    type="button"
                                    className="cursor-pointer"
                                    variant="link"
                                    onClick={onChangeLoginType}
                                    disabled={isLoading}
                                >
                                    Back to social login
                                </Button>
                            </div>

                            <div className="text-center text-sm">
                                Don't have an account?{" "}
                                <Link
                                    to="/sign-up"
                                    className="underline underline-offset-4"
                                >
                                    Sign up
                                </Link>
                            </div>
                        </form>
                    </Form>
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
