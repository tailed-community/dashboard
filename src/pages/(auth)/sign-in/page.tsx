import { LoginForm } from "./login-form";
import { LoginWithSAML } from "@/pages/(auth)/sign-in/login-with-saml";
import { useState } from "react";

export default function LoginPage() {
  const [isSSO, setIsSSO] = useState(false);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        {isSSO ? (
          <LoginWithSAML
            onChangeLoginType={() => {
              setIsSSO(false);
            }}
          />
        ) : (
          <LoginForm
            onChangeLoginType={() => {
              setIsSSO(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
