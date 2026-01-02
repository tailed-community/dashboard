import { SignUpForm } from "./signup-form";

export default function SignUpPage() {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
            <div className="w-full max-w-2xl">
                <SignUpForm />
            </div>
        </div>
    );
}
