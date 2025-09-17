import StudentOnboarding from "@/components/onboarding/student-onboarding";
import { useSidebarContext } from "@/contexts/sidebar-context";
import { apiFetch } from "@/lib/fetch";
import { m } from "@/paraglide/messages.js";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface StudentOnboardingData {
  fullName: string;
  education: {
    institution: string;
    degree: string;
    graduationYear: string;
  };
  interests: string[];
  bio?: string;
  githubUsername?: string;
  linkedinUrl?: string;
}

export default function StudentOnboardingPage() {
  const navigate = useNavigate();
  const { user, refresh } = useSidebarContext();

  const handleOnboardingComplete = async (data: StudentOnboardingData) => {
    try {
      // Save onboarding data to backend
      const response = await apiFetch("/auth/student-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: user?.email,
          onboardingData: data,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save onboarding data");
      }

      toast.success("Profile created successfully!");

      // Refresh user data to get updated information
      await refresh();

      // Redirect to dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("Error saving onboarding data:", error);
      toast.error("Failed to complete profile setup. Please try again.");
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p>{m.loading()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-center">
        <StudentOnboarding
          userEmail={user.email}
          onComplete={handleOnboardingComplete}
        />
      </div>
    </div>
  );
}
