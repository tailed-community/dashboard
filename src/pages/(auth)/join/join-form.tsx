import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { m } from "@/paraglide/messages.js";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sendLoginLink } from "@/lib/auth";
import { apiFetch } from "@/lib/fetch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Common country codes with flags
const countryCodes = [
  { code: "+1", country: "CA", flag: "🇨🇦" },
  { code: "+1", country: "US", flag: "🇺🇸" },
];

// Form validation schema
const formSchema = z.object({
  firstName: z.string().min(2, {
    message: "First name must be at least 2 characters.",
  }),
  lastName: z.string().min(2, {
    message: "Last name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  phone: z.string().min(10, {
    message: "Please enter a valid phone number.",
  }),
  country: z.string().default("CA"),
});

type InviteData = {
  organizationName?: string;
  isValid: boolean;
  error?: string;
};

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [country, setCountry] = useState("CA");
  const [submittedEmail, setSubmittedEmail] = useState("");

  const token = searchParams.get("token");

  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      country: "CA",
    },
  });

  // Validate the invite token
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setInviteData({ isValid: false, error: "Invalid invite link" });
        setIsLoading(false);
        return;
      }

      try {
        // Replace with your actual API endpoint
        const response = await apiFetch(`/invites/validate?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setInviteData({
            isValid: true,
            organizationName: data.organizationName,
          });
        } else {
          setInviteData({
            isValid: false,
            error: data.error || "Invalid or expired invite",
          });
        }
      } catch (error) {
        setInviteData({
          isValid: false,
          error: "Failed to validate invite",
        });
      } finally {
        setIsLoading(false);
      }
    }

    validateToken();
  }, [token]);

  // Handle form submission
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!token) return;

    setIsSubmitting(true);
    try {
      // Format the phone number with country code
      const countryCode = countryCodes.find((c) => c.country === values.country)?.code || "+1";
      const formattedPhone = `${countryCode}${values.phone.replace(/\D/g, "")}`;

      // Replace with your actual API endpoint
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...values,
            phone: formattedPhone,
            token,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Store email and set success state
        setSubmittedEmail(values.email);
        await sendLoginLink(values.email);
        setSubmitSuccess(true);
      } else {
        // Show error
        form.setError("root", {
          message: data.error || "Failed to create account",
        });
      }
    } catch (error) {
      form.setError("root", {
        message: "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitSuccess) {
    return (
        <Card className="w-full max-w-lg">
            <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
            <CardDescription>
                We've sent a magic link to your email. Click the link to complete
                your registration.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <p className="mb-4">
                You can close this page or check your inbox to continue.
            </p>
            <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/sign-in")}
            >
                Return to login
            </Button>
            </CardContent>
        </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>{m.loading()}</p>
      </div>
    );
  }

  if (!inviteData?.isValid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{m.invalid_invite()}</CardTitle>
            <CardDescription>
              {inviteData?.error ||
                "The invite link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate("/sign-in")} className="w-full">
              {m.go_to_login()}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{m.create_your_account()}</CardTitle>
          <CardDescription>
            {inviteData.organizationName
              ? `Join ${inviteData.organizationName}`
              : "Join the organization"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{m.first_name()}</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
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
                      <FormLabel>{m.last_name()}</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.email()}</FormLabel>
                    <FormControl>
                      <Input placeholder="john.doe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.phone()}</FormLabel>
                    <div className="flex gap-2">
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field: countryField }) => (
                          <Select 
                            value={countryField.value} 
                            onValueChange={(value) => {
                              countryField.onChange(value);
                              setCountry(value);
                            }}
                          >
                            <SelectTrigger className="w-[110px]">
                              <SelectValue placeholder="Code" />
                            </SelectTrigger>
                            <SelectContent>
                              {countryCodes.map((_country) => (
                                <SelectItem
                                  key={_country.country}
                                  value={_country.country}
                                >
                                  <span className="flex items-center gap-2">
                                    <span className="text-base">{_country.flag}</span>{" "}
                                    {_country.code}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <FormControl>
                        <Input 
                          placeholder="(555) 123-4567" 
                          className="flex-1"
                          {...field}
                          onChange={(e) => {
                            // Format phone number as user types (optional)
                            const formatted = e.target.value
                              .replace(/\D/g, "")
                              .replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
                            field.onChange(formatted);
                          }}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            {m.already_have_an_account()}{" "}
            <a href="/sign-in" className="text-primary hover:underline">
              {m.sign_in()}
            </a>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
