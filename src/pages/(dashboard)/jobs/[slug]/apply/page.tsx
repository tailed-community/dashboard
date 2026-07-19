import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import { Loader2, Mail, CheckCircle, Lock } from "lucide-react";
import { PlaygroundButton } from "@/components/playground/playground-button";
import ApplicationForm from "./application-form";
import ApplicationConfirmation from "./confirmation";
import { getFileUrl } from "@/lib/firebase-client";
import { studentAuth } from "@/lib/auth";
import { type TokenInfo, type JobData } from "./types";
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
    const [authError] = useState<string | null>(null);
    const [, setAccessType] = useState<AccessType | null>(null);
    const [hasAlreadyApplied, setHasAlreadyApplied] = useState(false);
    const [, setCheckingApplication] = useState(false);

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
            <div className="mx-auto max-w-4xl px-5 py-10">
                <div className="mb-8 flex flex-col items-center justify-center text-center">
                    {jobData?.organization?.logo ? (
                        <img
                            src={jobData.organization.logo}
                            alt={`${
                                jobData.organization.name || "Company"
                            } logo`}
                            className="mb-4 h-16 w-auto"
                        />
                    ) : null}

                    <h1 className="joy-display text-3xl font-extrabold text-joy-ink">
                        {jobData?.job.title || "Job Application"}
                    </h1>
                    {jobData?.organization?.name && (
                        <p className="mt-2 text-xl text-joy-ink-muted">
                            {jobData.organization.name}
                        </p>
                    )}
                </div>

                <div className="mx-auto grid w-full max-w-4xl gap-8 md:grid-cols-2">
                    <div className="flex flex-col justify-center">
                        <h2 className="joy-display mb-4 text-2xl font-extrabold tracking-tight text-joy-ink">
                            Sign in to apply for this position
                        </h2>
                        <p className="mb-6 text-joy-ink-muted">
                            To ensure a seamless application experience, we need
                            to verify your identity first.
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-start">
                                <CheckCircle className="mr-2 mt-0.5 h-5 w-5 text-joy-grass" />
                                <div>
                                    <h3 className="font-bold text-joy-ink">
                                        Save your progress
                                    </h3>
                                    <p className="text-sm text-joy-ink-muted">
                                        Continue your application anytime, even
                                        on different devices
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <CheckCircle className="mr-2 mt-0.5 h-5 w-5 text-joy-grass" />
                                <div>
                                    <h3 className="font-bold text-joy-ink">
                                        Auto-fill your application
                                    </h3>
                                    <p className="text-sm text-joy-ink-muted">
                                        We'll use your profile information to
                                        speed up the process
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <CheckCircle className="mr-2 mt-0.5 h-5 w-5 text-joy-grass" />
                                <div>
                                    <h3 className="font-bold text-joy-ink">
                                        Verify your identity
                                    </h3>
                                    <p className="text-sm text-joy-ink-muted">
                                        Stand out to employers with a verified
                                        application
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm">
                        <div className="space-y-1">
                            <h2 className="joy-display text-2xl font-extrabold text-joy-ink">
                                Sign in to continue
                            </h2>
                            <p className="text-sm text-joy-ink-muted">
                                Choose your preferred sign-in method below
                            </p>
                        </div>
                        <div className="mt-4 space-y-4">
                            {authError && (
                                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                                    {authError}
                                </div>
                            )}

                            <div className="space-y-2">
                                <PlaygroundButton
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setShowEmailLogin(true)}
                                >
                                    <Mail className="h-4 w-4" />
                                    Continue with Email
                                </PlaygroundButton>
                            </div>
                        </div>
                        <div className="mt-6">
                            <div className="flex w-full items-center text-xs text-joy-ink-muted">
                                <Lock className="mr-1 h-3 w-3" />
                                <p>
                                    Your information is securely encrypted. See
                                    our{" "}
                                    <a
                                        href="/privacy"
                                        className="font-semibold underline hover:text-joy-ink"
                                    >
                                        Privacy Policy
                                    </a>
                                    .
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // If showing email login, render the EmailLoginForm component
    if (showEmailLogin) {
        return (
            <div className="mx-auto max-w-md px-5 py-10">
                <EmailLoginForm
                    className={"w-full justify-center"}
                    onChangeLoginType={() => setShowEmailLogin(false)}
                    redirectUrl={window.location.pathname + window.location.search} // Pass current URL pathname + query params (token/sharedId) as redirectUrl
                    // {...props}
                />
            </div>
        );
    }

    // Loading state
    if (isLoading && !needsAuth) {
        return (
            <div className="mx-auto max-w-2xl px-5 py-16 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-joy-grass" />
                <p className="mt-2 text-joy-ink-muted">
                    Loading application...
                </p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="mx-auto max-w-md px-5 py-16 text-center">
                <h1 className="joy-display text-2xl font-extrabold text-joy-ink">
                    Application Error
                </h1>
                <p className="mt-2 text-joy-ink-muted">{error}</p>
                <div className="mt-5 flex justify-center">
                    <PlaygroundButton onClick={() => navigate("/jobs")}>
                        Return to Home
                    </PlaygroundButton>
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
            <div className="mx-auto max-w-md px-5 py-10">
                <div className="rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm">
                    <div className="text-center">
                        {jobData?.organization?.logo && (
                            <img
                                src={jobData.organization.logo}
                                alt={`${jobData.organization.name} logo`}
                                className="mx-auto mb-4 h-16 w-auto"
                            />
                        )}
                        <h1 className="joy-display text-2xl font-extrabold text-joy-ink">
                            Already Applied
                        </h1>
                        <p className="mt-1 text-sm text-joy-ink-muted">
                            You have already submitted an application for this
                            position.
                        </p>
                    </div>
                    <div className="mt-4 space-y-4">
                        <div className="rounded-xl border border-joy-ink/8 bg-joy-surface p-4">
                            <h3 className="mb-2 font-bold text-joy-ink">
                                {jobData?.job?.title || "Job Position"}
                            </h3>
                            <p className="text-sm text-joy-ink-muted">
                                {jobData?.organization?.name || "Company"}
                            </p>
                        </div>
                        <p className="text-sm text-joy-ink-muted">
                            You can view the status of all your applications on
                            your applications page.
                        </p>
                    </div>
                    <div className="mt-6 flex flex-col gap-2">
                        <PlaygroundButton
                            className="w-full"
                            onClick={() => navigate("/jobs/applied")}
                        >
                            View My Applications
                        </PlaygroundButton>
                        <PlaygroundButton
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate(`/jobs/${slug}`)}
                        >
                            Back to Job Details
                        </PlaygroundButton>
                    </div>
                </div>
            </div>
        );
    }

    // Confirmation view
    if (isSubmitted) {
        return (
            <ApplicationConfirmation
                jobData={jobData}
                tokenInfo={tokenInfo ?? undefined}
            />
        );
    }

    // Application form
    return (
        <div>
            {token && tokenInfo ? (
                // Private token flow - with tokenInfo
                <ApplicationForm
                    tokenInfo={tokenInfo}
                    onSubmit={handleApplicationSubmit}
                />
            ) : jobData ? (
                // Public flow - with job data
                <div className="mx-auto max-w-3xl px-5 py-10">
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
                                id: "",
                                status: "Sent",
                                firstName: "",
                                lastName: "",
                                email: studentAuth.currentUser?.email || "",
                            },
                            job: jobData.job,
                            organization: jobData.organization,
                            token: {
                                id: jobData.job.id,
                                createdAt: new Date().toISOString(),
                                expires: new Date(
                                    Date.now() + 30 * 24 * 60 * 60 * 1000
                                ).toISOString(),
                            },
                        }}
                        onSubmit={handleApplicationSubmit}
                    />
                </div>
            ) : (
                <div className="mx-auto max-w-2xl px-5 py-16 text-center">
                    <p className="text-joy-ink-muted">No job data available</p>
                </div>
            )}
        </div>
    );
}
