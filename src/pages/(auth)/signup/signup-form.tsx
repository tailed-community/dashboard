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
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Zod schema for signup validation
const signUpSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
});

type SignUpData = z.infer<typeof signUpSchema>;

interface SignUpFormProps extends React.ComponentProps<"div"> {}

export function SignUpForm({ className, ...props }: SignUpFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectUrl = searchParams.get("redirectUrl") || undefined;

    // React Hook Form setup with Zod validation
    const form = useForm<SignUpData>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
        },
    });

    const onSubmit = async (data: SignUpData) => {
        setIsLoading(true);

        try {
            // First, check if the user already exists
            const checkResponse = await apiFetch("/auth/check-user-exists", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email: data.email }),
            });

            const checkResult = await checkResponse.json();

            if (checkResult.exists) {
                toast.error("Account already exists", {
                    description:
                        "An account with this email already exists. Please sign in instead.",
                    action: {
                        label: "Go to Sign In",
                        onClick: () => navigate("/sign-in"),
                    },
                });
                setIsLoading(false);
                return;
            }

            // If user doesn't exist, create the account
            const createResponse = await apiFetch("/auth/create-account", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                }),
            });

            const createResult = await createResponse.json();

            if (!createResponse.ok) {
                toast.error("Sign up failed", {
                    description:
                        createResult.message ||
                        "Failed to create account. Please try again.",
                });
                setIsLoading(false);
                return;
            }

            // Send login link after successful account creation
            await sendLoginLink(data.email, TENANT_IDS.STUDENTS, redirectUrl);

            toast.success("Account created successfully!", {
                description:
                    "Check your email for a login link to access your account.",
            });

            // Redirect to sign-in page after a short delay
            setTimeout(() => {
                navigate("/sign-in");
            }, 2000);
        } catch (error) {
            console.error("Sign up error:", error);
            toast.error("Sign up failed", {
                description: "An unexpected error occurred. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className={cn(
                "flex flex-col gap-6 w-full max-w-2xl mx-auto",
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
                                    Create Your Account
                                </h1>
                                <p className="text-balance text-muted-foreground">
                                    Join the community and get started
                                </p>
                            </div>

                            {/* Name Fields - Side by side */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="firstName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>First Name *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="John"
                                                    disabled={isLoading}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="lastName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Last Name *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Doe"
                                                    disabled={isLoading}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Email */}
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email *</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="john.doe@example.com"
                                                disabled={isLoading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Submit Button */}
                            <div className="flex flex-col gap-3">
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Create Account
                                </Button>
                            </div>

                            <div className="text-center text-sm">
                                Already have an account?{" "}
                                <Link
                                    to={redirectUrl ? `/sign-in?redirectUrl=${encodeURIComponent(redirectUrl)}` : "/sign-in"}
                                    className="underline underline-offset-4"
                                >
                                    Sign in
                                </Link>
                            </div>
                        </form>
                    </Form>
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
