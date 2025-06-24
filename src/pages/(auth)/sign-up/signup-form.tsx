import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
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

export default function SignUpForm() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [country, setCountry] = useState("CA");
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);

    const countryCode =
      countryCodes.find((c) => c.country === country)?.code || "+1";

    const userData = {
      organizationName: formData.get("organization") as string,
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      phoneNumber: `${countryCode}${phoneNumber.replace(/\D/g, "")}`, // Format: clean non-digits but keep country code
      email: formData.get("email") as string,
    };

    try {
      // Call the API to create the user and org
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/create-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        }
      );

      if (response.ok) {
        // The magic link request was successful
        window.localStorage.setItem("emailForSignIn", userData.email);
        setSubmitSuccess(true);
      } else {
        const errorData = await response.json();
        setErrorMessage(
          errorData.message || "An error occurred during account creation."
        );
      }
    } catch (error) {
      console.error("Error creating account:", error);
      setErrorMessage("Network error. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSignUp}>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="organization">Company name</Label>
              <Input
                id="organization"
                name="organization"
                placeholder="Enter your company name"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="Enter your first name"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Enter your last name"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone number</Label>
              <div className="flex gap-2">
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue placeholder="Code" />
                  </SelectTrigger>
                  <SelectContent>
                    {countryCodes.map((_country) => (
                      <SelectItem
                        key={_country.country}
                        value={_country?.country}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">{_country.flag}</span>{" "}
                          {_country.code}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => {
                    // Format phone number as user types (optional)
                    const formatted = e.target.value
                      .replace(/\D/g, "")
                      .replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
                    setPhoneNumber(formatted);
                  }}
                  placeholder="(555) 123-4567"
                  className="flex-1"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          {errorMessage && (
            <div className="text-sm text-red-500 font-medium">
              {errorMessage}
            </div>
          )}

          <div className={"flex flex-col gap-1"}>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
            <div className="text-center text-sm">
              Already have an account?{" "}
              <Link to="/sign-in" className="underline underline-offset-4">
                Sign in
              </Link>
            </div>
          </div>

          <div className="mt-4">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigate("/student-portal")}
            >
              I’m a Student – Go to Student Portal
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            By creating an account, you agree to our{" "}
            <Link
              to="/terms-and-conditions"
              className="underline underline-offset-4 hover:text-primary"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              className="underline underline-offset-4 hover:text-primary"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
