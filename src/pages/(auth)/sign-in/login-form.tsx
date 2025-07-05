import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { sendLoginLink, TENANT_IDS } from "@/lib/auth";
import { m } from "@/paraglide/messages.js";

interface LoginProps extends React.ComponentProps<"div"> {
  onChangeLoginType: () => void;
}

export function LoginForm({
  className,
  onChangeLoginType,
  ...props
}: LoginProps) {
  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    if (!formData.has("email")) {
      console.error("Email is required");
    }

    const email = formData.get("email") as string;

    console.log(`Email: ${email} - ${window.location.href}`);

    // Checks if account exists. This endpoint checks both the google identity and
    // the database for the account.
    fetch(`${import.meta.env.VITE_API_URL}/auth/account-exists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    }).then((response) => {
      if (response.ok) {
        // If the account exists, send the login link
        sendLoginLink(email, TENANT_IDS.STUDENTS)
          .then(() => {
            toast("Login link sent", {
              description: "Check your email for the login link",
            });
          })
          .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error(`Error: ${errorCode} - ${errorMessage} - ${error}`);

            if (
              errorCode === "auth/user-not-found" ||
              errorCode === "auth/admin-restricted-operation"
            ) {
              toast.error("User not found", {
                description: "No account exists with this email address",
              });
            } else {
              toast.error("Login failed", {
                description: "An error occurred during login",
              });
            }
          });
      } else {
        toast.error("User not found", {
          description: "No account exists with this email address",
        });
      }
    });
  };

  return (
    <div
      className={cn("flex flex-col gap-6 w-full max-w-md mx-auto", className)}
      {...props}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-8">
          <form className="flex flex-col gap-6" onSubmit={handleLogin}>
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">{m.email()}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
              />
            </div>
            <div className={"flex flex-col"}>
              <Button type="submit" className="w-full">
                {m.login()}
              </Button>
            </div>
            <div className="text-center text-sm">
              {m.dont_have_an_account()}{" "}
              <Link to="/sign-up" className="underline underline-offset-4">
                {m.sign_up()}
              </Link>
            </div>
          </form>
        </CardContent>
        <CardContent className="px-8 pb-6">
          <a href="https://tailed.ca/sign-in">
            <Button variant="secondary" className="w-full">
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
