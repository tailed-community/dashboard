import { useState, useEffect } from "react";
import {
    Loader2,
    Github,
    Award,
    Briefcase,
    User,
    ArrowLeft,
    ArrowRight,
} from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { fetchGithubUserProfile, type GithubProfile } from "@/lib/github";
import { studentAuth, initializeStudentSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Steps, Step } from "@/components/ui/steps";
import PersonalInfoSection from "./components/PersonalInfoSection";
import GithubProfileSection from "./components/GithubProfileSection";
import DevpostProfileSection from "./components/DevpostProfileSection";
import JobDetailsSection from "./components/JobDetailsSection";
import {
    linkWithPopup,
    GithubAuthProvider,
    signInWithCredential,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
    type TokenInfo,
    type DevpostProfile,
    type ApplicationFormData,
} from "./types";

interface ApplicationFormProps {
    tokenInfo: TokenInfo;
    onSubmit: (data: any) => Promise<void>;
}

export default function ApplicationForm({
    tokenInfo,
    onSubmit,
}: ApplicationFormProps) {
    // Utility to merge profile data into form fields only if empty
    function prefillFormData(
        formData: ApplicationFormData,
        profile: any
    ): Partial<ApplicationFormData> {
        return {
            firstName: formData.firstName || profile.firstName || "",
            lastName: formData.lastName || profile.lastName || "",
            email: formData.email || profile.email || "",
            phone: formData.phone || profile.phone || "",
            university: formData.university || profile.school || "",
            major: formData.major || profile.program || "",
            graduationYear:
                formData.graduationYear ||
                (profile.graduationYear ? String(profile.graduationYear) : ""),
            githubUsername:
                formData.githubUsername || profile.githubUsername || "",
            devpostUsername:
                formData.devpostUsername || profile.devpostUsername || "",
            linkedinUrl: formData.linkedinUrl || profile.linkedinUrl || "",
            portfolioUrl: formData.portfolioUrl || profile.portfolioUrl || "",
            coverLetter: formData.coverLetter || "",
            resume: profile.resume || {
                id: "",
                name: "",
                url: "",
                uploadedAt: { _seconds: 0, _nanoseconds: 0 },
            },
        };
    }

    // Fetch /profile and prefill form fields on mount (easy apply)
    useEffect(() => {
        let ignore = false;
        async function fetchProfileAndPrefill() {
            try {
                const response = await apiFetch("/profile");
                if (!response.ok) return;
                const profile = await response.json();
                if (!ignore && profile && Object.keys(profile).length > 0) {
                    setFormData((prev) => ({
                        ...prev,
                        ...prefillFormData(
                            prev as ApplicationFormData,
                            profile
                        ),
                    }));
                }
            } catch (err) {
                // Ignore errors, just don't prefill
            }
        }
        fetchProfileAndPrefill();
        return () => {
            ignore = true;
        };
    }, []);
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState<ApplicationFormData>({
        firstName: tokenInfo.applicant.firstName || "",
        lastName: tokenInfo.applicant.lastName || "",
        email: tokenInfo.applicant.email,
        phone: "",
        university: "",
        major: "",
        graduationYear: "",
        githubUsername: "",
        devpostUsername: "",
        linkedinUrl: "",
        portfolioUrl: "",
        coverLetter: "",
        resume: {
            id: "",
            url: "",
            name: "",
            uploadedAt: {
                _seconds: 0,
                _nanoseconds: 0,
            },
        },
    });

    const [githubProfile, setGithubProfile] = useState<GithubProfile | null>(
        null
    );
    const [devpostProfile, setDevpostProfile] = useState<DevpostProfile | null>(
        null
    );
    const [isLoadingGithub, setIsLoadingGithub] = useState(false);
    const [isLoadingDevpost, setIsLoadingDevpost] = useState(false);
    const [githubError, setGithubError] = useState<string | null>(null);
    const [devpostError, setDevpostError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    };

    // Initialize anonymous session when component mounts
    useEffect(() => {
        initializeStudentSession().catch((error) => {
            console.error("Failed to initialize student session:", error);
        });
    }, []);

    const fetchGithubProfile = async () => {
        setIsLoadingGithub(true);
        setGithubError(null);

        try {
            // Ensure we have a session before attempting GitHub auth
            if (!studentAuth.currentUser) {
                await initializeStudentSession();
            }

            // Create GitHub provider
            const githubProvider = new GithubAuthProvider();

            githubProvider.addScope("read:user");
            githubProvider.addScope("repo");
            githubProvider.addScope("read:org");

            // Check if the user already has GitHub provider linked
            const providerData = studentAuth.currentUser?.providerData || [];
            const githubProviderData = providerData.find(
                (p) => p.providerId === "github.com"
            );

            let token = null;

            if (githubProviderData) {
                // User is already linked with GitHub
                // We need to reauthenticate to get a fresh token
                try {
                    // Try to relink to get a fresh token
                    const result = await linkWithPopup(
                        studentAuth.currentUser,
                        githubProvider
                    );
                    const credential =
                        GithubAuthProvider.credentialFromResult(result);
                    token = credential?.accessToken;
                } catch (error) {
                    // If we get credential-already-in-use, that's expected
                    // We'll try to sign in with credential instead
                    if (
                        error instanceof FirebaseError &&
                        error.code === "auth/credential-already-in-use"
                    ) {
                        const credential =
                            GithubAuthProvider.credentialFromError(error);
                        if (credential) {
                            // Sign in with the existing credential to get a fresh token
                            const result = await signInWithCredential(
                                studentAuth,
                                credential
                            );
                            // Fetch the GitHub user token
                            const userCred =
                                GithubAuthProvider.credentialFromResult(result);
                            token = userCred?.accessToken;
                        }
                    } else {
                        throw error;
                    }
                }
            } else {
                // User is not linked with GitHub yet, proceed with normal linking
                try {
                    const result = await linkWithPopup(
                        studentAuth.currentUser,
                        githubProvider
                    );
                    const credential =
                        GithubAuthProvider.credentialFromResult(result);
                    token = credential?.accessToken;
                } catch (error) {
                    // Handle credential-already-in-use error
                    if (
                        error instanceof FirebaseError &&
                        error.code === "auth/credential-already-in-use"
                    ) {
                        const credential =
                            GithubAuthProvider.credentialFromError(error);
                        if (credential) {
                            // Sign in with the existing credential
                            const result = await signInWithCredential(
                                studentAuth,
                                credential
                            );
                            // Fetch the GitHub user token
                            const userCred =
                                GithubAuthProvider.credentialFromResult(result);
                            token = userCred?.accessToken;
                        }
                    } else {
                        throw error;
                    }
                }
            }

            if (token) {
                const profileData = await fetchGithubUserProfile(token);
                setGithubProfile(profileData);

                // Store GitHub username in form data
                if (profileData.username) {
                    setFormData((prevData) => ({
                        ...prevData,
                        githubUsername: profileData.username,
                    }));
                }
            } else {
                throw new Error("Failed to get GitHub token");
            }
        } catch (error) {
            setGithubError("Could not load GitHub profile. Please try again.");
            console.error(error);
        } finally {
            setIsLoadingGithub(false);
        }
    };

    const fetchDevpostProfile = async () => {
        if (!formData.devpostUsername) return;

        setIsLoadingDevpost(true);
        setDevpostError(null);

        try {
            const response = await apiFetch(`/devpost/profile`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username: formData.devpostUsername }),
            });

            if (!response.ok) {
                throw new Error("Failed to fetch Devpost profile");
            }

            const responseData = await response.json();
            if (!responseData.success) {
                throw new Error(
                    responseData.error || "Failed to fetch Devpost profile"
                );
            }

            setDevpostProfile(responseData.data);
        } catch (error) {
            setDevpostError(
                "Could not load Devpost profile. Please check the username and try again."
            );
            console.error(error);
        } finally {
            setIsLoadingDevpost(false);
        }
    };

    const handleStepNext = () => {
        setCurrentStep((prev) => prev + 1);
    };

    const handleStepBack = () => {
        setCurrentStep((prev) => prev - 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await onSubmit({
                ...formData,
            });
        } catch (error) {
            console.error("Error submitting application:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Save application progress when form data changes
    useEffect(() => {
        if (studentAuth.currentUser) {
            // This could be expanded to save to Firestore or another persistence layer
            localStorage.setItem(
                `application_${tokenInfo.job.id}`,
                JSON.stringify(formData)
            );
        }
    }, [formData, tokenInfo.job.id]);

    // Load saved progress when component mounts
    useEffect(() => {
        const savedFormData = localStorage.getItem(
            `application_${tokenInfo.job.id}`
        );
        if (savedFormData) {
            try {
                const parsedData = JSON.parse(savedFormData);
                setFormData((prevData) => ({ ...prevData, ...parsedData }));
            } catch (error) {
                console.error("Error parsing saved form data:", error);
            }
        }
    }, [tokenInfo.job.id]);

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="mb-8 flex flex-col items-center justify-center text-center">
                <div className="mb-4">
                    {tokenInfo.organization.logo ? (
                        <img
                            src={tokenInfo.organization.logo}
                            alt={`${tokenInfo.organization.name} logo`}
                            className="h-16 w-auto"
                        />
                    ) : (
                        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <Briefcase className="h-8 w-8 text-primary" />
                        </div>
                    )}
                </div>
                <h1 className="text-3xl font-bold">{tokenInfo.job.title}</h1>
                <p className="text-xl mt-2 text-muted-foreground">
                    {tokenInfo.organization.name}
                </p>
                <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{tokenInfo.job.type}</Badge>
                    <Badge variant="outline">{tokenInfo.job.location}</Badge>
                </div>
            </div>

            <Card className="mx-auto max-w-3xl">
                <CardHeader>
                    <CardTitle>Complete Your Application</CardTitle>
                    <CardDescription>
                        Thank you for your interest in this position. Please
                        complete this form to apply.
                    </CardDescription>
                    <Steps currentStep={currentStep} className="mt-4">
                        <Step icon={<User size={18} />} title="Personal Info" />
                        <Step
                            icon={<Github size={18} />}
                            title="GitHub Profile"
                        />
                        <Step icon={<Award size={18} />} title="Hackathons" />
                        <Step
                            icon={<Briefcase size={18} />}
                            title="Job Details"
                        />
                    </Steps>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        {/* Step 1: Personal Information */}
                        {currentStep === 0 && (
                            <PersonalInfoSection
                                formData={formData}
                                handleInputChange={handleInputChange}
                            />
                        )}

                        {/* Step 2: GitHub Profile */}
                        {currentStep === 1 && (
                            <GithubProfileSection
                                formData={formData}
                                handleInputChange={handleInputChange}
                                githubProfile={githubProfile}
                                isLoadingGithub={isLoadingGithub}
                                githubError={githubError}
                                fetchGithubProfile={fetchGithubProfile}
                            />
                        )}

                        {/* Step 3: Hackathons */}
                        {currentStep === 2 && (
                            <DevpostProfileSection
                                formData={formData}
                                handleInputChange={handleInputChange}
                                devpostProfile={devpostProfile}
                                isLoadingDevpost={isLoadingDevpost}
                                devpostError={devpostError}
                                fetchDevpostProfile={fetchDevpostProfile}
                            />
                        )}

                        {/* Step 4: Job Details */}
                        {currentStep === 3 && (
                            <JobDetailsSection
                                formData={formData}
                                handleInputChange={handleInputChange}
                                tokenInfo={tokenInfo}
                                githubProfile={githubProfile}
                                devpostProfile={devpostProfile}
                            />
                        )}
                    </form>
                </CardContent>
                <CardFooter className="flex justify-between">
                    {currentStep > 0 ? (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleStepBack}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                    ) : (
                        <div></div>
                    )}

                    {currentStep < 3 ? (
                        <Button type="button" onClick={handleStepNext}>
                            Next
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Submit Application
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
