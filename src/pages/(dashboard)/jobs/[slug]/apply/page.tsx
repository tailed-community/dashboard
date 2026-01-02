import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import {
    Loader2,
    Mail,
    Apple,
    Linkedin,
    CheckCircle,
    Lock,
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import ApplicationForm from "./application-form";
import ApplicationConfirmation from "./confirmation";
import { getFileUrl } from "@/lib/firebase-client";
import { studentAuth, signInWithGoogle } from "@/lib/auth";
import { type TokenInfo, type JobData } from "./types";
import { SiApple, SiLinkedin } from "react-icons/si";
import { EmailLoginForm } from "@/pages/(auth)/sign-in/email-login-form";

// Define access types for clarity
type AccessType = "private" | "link" | "public";

export default function ApplyJobPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { slug } = useParams();

    // URL parameters - support both specific jobId and additional query parameters
    const token = searchParams.get("token");
    const sharedId = searchParams.get("sharedId");

    // State
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [jobData, setJobData] = useState<JobData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [needsAuth, setNeedsAuth] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [accessType, setAccessType] = useState<AccessType | null>(null);
    const [hasAlreadyApplied, setHasAlreadyApplied] = useState(false);
    const [checkingApplication, setCheckingApplication] = useState(false);

    // Determine access type and initialize
    useEffect(() => {
        // Determine access type based on URL parameters
        if (token) {
            setAccessType("private");
        } else if (sharedId) {
            setAccessType("link");
        } else {
            setAccessType("public");
        }

        // Get initial job information
        getJobInformation();
    }, [token, sharedId, slug]);

    const [showEmailLogin, setShowEmailLogin] = useState(false);

    // Get initial job information for branding and setup
    async function getJobInformation() {
        try {
            setIsLoading(true);

            // If token exists, validate it first
            if (token) {
                const validateResponse = await apiFetch(
                    `/applicants/validate/${token}`,
                    { method: "GET" },
                    true
                );

                if (!validateResponse.ok) {
                    const errorData = await validateResponse.json();
                    throw new Error(errorData.error || "Invalid token");
                }

                const tokenData = await validateResponse.json();
                setTokenInfo({
                    token: {
                        id: token,
                        createdAt: new Date().toISOString(), // Placeholder since API doesn't return this
                        expires: new Date(
                            Date.now() + 30 * 24 * 60 * 60 * 1000
                        ).toISOString(), // 30 days from now
                    },
                    applicant: tokenData.applicant,
                    job: tokenData.job,
                    organization: tokenData.organization,
                });
            }

            let endpoint;

            // Build the endpoint URL with appropriate query parameters
            endpoint = `/public/jobs/${slug}`;

            // Add query parameters if they exist
            if (token) {
                endpoint += `?token=${encodeURIComponent(token)}`;
            } else if (sharedId) {
                endpoint += `?sharedId=${encodeURIComponent(sharedId)}`;
            }

            // Fetch job/organization info
            const response = await apiFetch(endpoint, { method: "GET" }, true);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to access job information"
                );
            }

            const data = await response.json();

            // Store the complete job data
            setJobData(data);

            // Process logo URL if it exists
            if (data.organization?.logo) {
                try {
                    const url = await getFileUrl(data.organization.logo);
                    // Update the job data with the resolved logo URL
                    setJobData((prevData) =>
                        prevData
                            ? {
                                  ...prevData,
                                  organization: {
                                      ...prevData.organization,
                                      logo: url,
                                  },
                              }
                            : null
                    );
                } catch (error) {
                    console.error("Failed to load organization logo:", error);
                }
            }

            // Check if user is authenticated
            if (!studentAuth.currentUser) {
                setNeedsAuth(true);
                setIsLoading(false);
            } else {
                // User is authenticated, check if they've already applied
                await checkIfAlreadyApplied();
                setIsLoading(false);
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "An unexpected error occurred"
            );
            console.error(err);
            setIsLoading(false);
        }
    }

    // Check if user has already applied to this job
    async function checkIfAlreadyApplied() {
        if (!studentAuth.currentUser || !slug) return;

        try {
            setCheckingApplication(true);
            const appliedJobsResponse = await apiFetch("/job/applied-jobs");

            // If request succeeds and user has profile
            if (appliedJobsResponse.ok) {
                const appliedJobsData = await appliedJobsResponse.json();
                if (Array.isArray(appliedJobsData)) {
                    const appliedIds = appliedJobsData.map(
                        (item: any) => item.jobId
                    );
                    setHasAlreadyApplied(appliedIds.includes(slug || ""));
                }
                const appliedJobIds = await appliedJobsResponse.json();

                // Check if this job is in the applied jobs array
                if (
                    Array.isArray(appliedJobIds) &&
                    appliedJobIds.includes(slug)
                ) {
                    setHasAlreadyApplied(true);
                }
            }
            // If request fails (404 or any other error), user doesn't have a profile yet
            // This is fine - they can continue with the application
        } catch (err) {
            // Ignore errors, allow user to proceed with application
            console.error("Error checking applied jobs:", err);
        } finally {
            setCheckingApplication(false);
        }
    }

    // Fetch application details after authentication for private token flow
    async function fetchPrivateTokenDetails() {
        try {
            setIsLoading(true);

            // Empty implementation for private token flow
            // This would fetch the complete application details after authentication

            // TODO: Implement private token details fetch

            setIsLoading(false);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "An unexpected error occurred"
            );
            console.error(err);
            setIsLoading(false);
        }
    }

    const handleGoogleSignIn = async () => {
        try {
            setAuthLoading(true);
            setAuthError(null);

            await signInWithGoogle();
            setNeedsAuth(false);

            // Check if user has already applied after authentication
            await checkIfAlreadyApplied();

            // Fetch application details after authentication
            if (token) {
                // Private token flow
                fetchPrivateTokenDetails();
            } else {
                // Public job flow - empty implementation
                setIsLoading(false);
            }
        } catch (err) {
            setAuthError("Authentication failed. Please try again.");
            console.error(err);
        } finally {
            setAuthLoading(false);
        }
    };

    async function handleApplicationSubmit(formData: any) {
        try {
            setIsLoading(true);

            // Build the endpoint with appropriate query parameters
            let endpoint = `/public/jobs/${slug}/apply`;

            // Add token or sharedId as query parameters if they exist
            if (token) {
                endpoint += `?token=${encodeURIComponent(token)}`;
            } else if (sharedId) {
                endpoint += `?sharedId=${encodeURIComponent(sharedId)}`;
            }

            // Check if resume is a File (needs multipart/form-data) or an object (use JSON)
            const hasFileUpload = formData.resume instanceof File;

            let response;
            if (hasFileUpload) {
                // Use FormData for file upload
                const uploadFormData = new FormData();

                // Append all form fields
                Object.keys(formData).forEach((key) => {
                    if (key === "resume") {
                        uploadFormData.append("resume", formData.resume);
                    } else if (typeof formData[key] === "object") {
                        uploadFormData.append(
                            key,
                            JSON.stringify(formData[key])
                        );
                    } else {
                        uploadFormData.append(key, formData[key]);
                    }
                });

                response = await apiFetch(
                    endpoint,
                    {
                        method: "POST",
                        body: uploadFormData,
                    },
                    true
                );
            } else {
                // Use JSON for existing resume
                const payload = {
                    ...formData,
                };

                response = await apiFetch(
                    endpoint,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    },
                    true
                );
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to submit application"
                );
            }
            setIsSubmitted(true);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to submit application"
            );
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    // Authentication Step UI
    const renderAuthStep = () => {
        return (
            <div className="container mx-auto py-8 px-4">
                <div className="mb-8 flex flex-col items-center justify-center text-center">
                    {jobData?.organization?.logo ? (
                        <img
                            src={jobData.organization.logo}
                            alt={`${
                                jobData.organization.name || "Company"
                            } logo`}
                            className="h-16 w-auto mb-4"
                        />
                    ) : null}

                    <h1 className="text-3xl font-bold">
                        {jobData?.job.title || "Job Application"}
                    </h1>
                    {jobData?.organization?.name && (
                        <p className="text-xl mt-2 text-muted-foreground">
                            {jobData.organization.name}
                        </p>
                    )}
                </div>

                <div className="w-full max-w-4xl mx-auto grid gap-8 md:grid-cols-2">
                    <div className="flex flex-col justify-center">
                        <h2 className="text-2xl font-bold tracking-tight mb-4">
                            Sign in to apply for this position
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            To ensure a seamless application experience, we need
                            to verify your identity first.
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-start">
                                <CheckCircle className="h-5 w-5 mr-2 text-primary mt-0.5" />
                                <div>
                                    <h3 className="font-medium">
                                        Save your progress
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Continue your application anytime, even
                                        on different devices
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <CheckCircle className="h-5 w-5 mr-2 text-primary mt-0.5" />
                                <div>
                                    <h3 className="font-medium">
                                        Auto-fill your application
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        We'll use your profile information to
                                        speed up the process
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <CheckCircle className="h-5 w-5 mr-2 text-primary mt-0.5" />
                                <div>
                                    <h3 className="font-medium">
                                        Verify your identity
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Stand out to employers with a verified
                                        application
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Card className="w-full">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-2xl">
                                Sign in to continue
                            </CardTitle>
                            <CardDescription>
                                Choose your preferred sign-in method below
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {authError && (
                                <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                                    {authError}
                                </div>
                            )}

                            <div className="space-y-2">
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
                                >
                                    <Mail className="mr-2 h-4 w-4" />
                                    Continue with Email
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full"
                                    disabled
                                >
                                    <SiLinkedin className="mr-2 h-4 w-4" />
                                    Continue with LinkedIn
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full"
                                    disabled
                                >
                                    <SiApple className="mr-2 h-4 w-4" />
                                    Continue with Apple
                                </Button>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <div className="flex items-center w-full text-xs text-muted-foreground">
                                <Lock className="h-3 w-3 mr-1" />
                                <p>
                                    Your information is securely encrypted. See
                                    our{" "}
                                    <a href="/privacy" className="underline">
                                        Privacy Policy
                                    </a>
                                    .
                                </p>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        );
    };

    // If showing email login, render the EmailLoginForm component
    if (showEmailLogin) {
        return (
            <EmailLoginForm
                className={"w-full h-full justify-center max-w-md m-auto"}
                onChangeLoginType={() => setShowEmailLogin(false)}
                redirectUrl={window.location.pathname} // Pass current URL pathname as redirectUrl
                // {...props}
            />
        );
    }

    // Loading state
    if (isLoading && !needsAuth) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-muted-foreground">
                        Loading application...
                    </p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4">
                <div className="w-full max-w-md text-center">
                    <h1 className="text-2xl font-bold text-destructive">
                        Application Error
                    </h1>
                    <p className="mt-2 text-muted-foreground">{error}</p>
                    <Button
                        className="mt-4"
                        onClick={() => navigate("/jobs")}
                    >
                        Return to Home
                    </Button>
                </div>
            </div>
        );
    }

    // Needs authentication
    if (needsAuth) {
        return renderAuthStep();
    }

    // Already applied view
    if (hasAlreadyApplied) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <Card>
                        <CardHeader className="text-center">
                            {jobData?.organization?.logo && (
                                <img
                                    src={jobData.organization.logo}
                                    alt={`${jobData.organization.name} logo`}
                                    className="h-16 w-auto mx-auto mb-4"
                                />
                            )}
                            <CardTitle className="text-2xl">
                                Already Applied
                            </CardTitle>
                            <CardDescription>
                                You have already submitted an application for
                                this position.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg bg-muted p-4">
                                <h3 className="font-semibold mb-2">
                                    {jobData?.job?.title || "Job Position"}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {jobData?.organization?.name || "Company"}
                                </p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                You can view the status of all your applications
                                on your applications page.
                            </p>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2">
                            <Button
                                className="w-full"
                                onClick={() => navigate("/jobs/applied")}
                            >
                                View My Applications
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => navigate(`/jobs/${slug}`)}
                            >
                                Back to Job Details
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        );
    }

    // Confirmation view
    if (isSubmitted) {
        return (
            <ApplicationConfirmation jobData={jobData} tokenInfo={tokenInfo} />
        );
    }

    // Application form
    return (
        <div className="min-h-screen bg-background">
            {token && tokenInfo ? (
                // Private token flow - with tokenInfo
                <ApplicationForm
                    tokenInfo={tokenInfo}
                    onSubmit={handleApplicationSubmit}
                />
            ) : jobData ? (
                // Public flow - with job data
                <div className="container mx-auto py-8 px-4">
                    {/* <div className="mb-8 flex flex-col items-center justify-center text-center">
            {jobData.organization?.logo && (
              <img 
                src={jobData.organization.logo} 
                alt={`${jobData.organization.name} logo`} 
                className="h-16 w-auto mb-4"
              />
            )}
            <h1 className="text-3xl font-bold">{jobData.job.title}</h1>
            <p className="text-xl mt-2 text-muted-foreground">{jobData.organization.name}</p>
            <p className="text-muted-foreground mt-1">{jobData.job.location}</p>
          </div> */}

                    <ApplicationForm
                        tokenInfo={{
                            applicant: {
                                firstName: "",
                                lastName: "",
                                email: studentAuth.currentUser?.email || "",
                            },
                            job: jobData.job,
                            organization: jobData.organization,
                            token: { id: jobData.job.id },
                        }}
                        onSubmit={handleApplicationSubmit}
                    />
                </div>
            ) : (
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <p className="text-muted-foreground">
                            No job data available
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
