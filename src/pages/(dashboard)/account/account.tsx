import type React from "react";
import { useState, useEffect } from "react";
import { Upload, Loader2, PencilLine, X, Github } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { fetchGithubUserProfile, type GithubProfile } from "@/lib/github";
import { studentAuth, initializeStudentSession } from "@/lib/auth";
import {
    linkWithPopup,
    GithubAuthProvider,
    signInWithCredential,
    unlink,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import type { DevpostProfile } from "../jobs/[slug]/apply/types";

type StudentProps = {
    email: string;
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    school: string;
    program: string;
    graduationYear: string;
    devpostUsername: string;
    devpost?: DevpostProfile; // Full Devpost profile data (saved in /devpost route)
    linkedinUrl: string;
    portfolioUrl: string;
    githubUsername: string;
    github?: GithubProfile; // Full GitHub profile data
    skills: string;
    resume: {
        id: string;
        name: string;
        url: string;
        uploadedAt: {
            _seconds: number;
            _nanoseconds: number;
        };
    };
    appliedJobs: [];
    organizations: string[];
};

// API service functions
const apiService = {
    getStudent: async () => {
        try {
            const response = await apiFetch("/profile");
            if (!response.ok) throw new Error("Failed to fetch members");
            return await response.json();
        } catch (error) {
            console.error("Error fetching members:", error);
            throw error;
        }
    },
    updateStudent: async (studentData: StudentProps) => {
        //TODO: If email changes, also update auth tenant
        try {
            const response = await apiFetch("/profile/update", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(studentData),
            });
            if (!response.ok) throw new Error("Failed to update member role");
            return await response;
        } catch (error) {
            console.error("Error updating member role:", error);
            throw error;
        }
    },
};

export default function AccountPage() {
    const [student, setStudent] = useState({
        id: "",
        email: "",
        studentId: 0,
        firstName: "",
        lastName: "",
        phone: "",
        school: "",
        program: "",
        graduationYear: "",
        linkedinUrl: "",
        portfolioUrl: "",
        devpostUsername: "",
        githubUsername: "",
        skills: "",
        resume: {
            id: "",
            name: "",
            url: "",
            uploadedAt: {
                _seconds: 0,
                _nanoseconds: 0,
            },
        },
        appliedJobs: [],
        organizations: [],
    } as StudentProps);

    const [originalStudent, setOriginalStudent] = useState<StudentProps | null>(
        null
    );
    const [hasChanges, setHasChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Track which fields are being edited
    const [isEditing, setIsEditing] = useState({
        phone: false,
        school: false,
        program: false,
        graduationYear: false,
        linkedinUrl: false,
        portfolioUrl: false,
        devpostUsername: false,
        githubUsername: false,
    });

    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [isUploadingResume, setIsUploadingResume] = useState(false);

    // Devpost verification state
    const [isLoadingDevpost, setIsLoadingDevpost] = useState(false);
    const [devpostError, setDevpostError] = useState<string | null>(null);

    // GitHub verification state
    const [isLoadingGithub, setIsLoadingGithub] = useState(false);
    const [githubError, setGithubError] = useState<string | null>(null);

    // Skills state
    const [skillsArray, setSkillsArray] = useState<string[]>([]);
    const [newSkill, setNewSkill] = useState("");

    // Initialize anonymous session when component mounts
    useEffect(() => {
        initializeStudentSession().catch((error) => {
            console.error("Failed to initialize student session:", error);
        });
    }, []);

    // Resolve Firebase storage path to URL when organization changes
    useEffect(() => {
        // Fetch data on component mount
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const studentData = await apiService.getStudent();
                setStudent(studentData as any);
                setOriginalStudent(studentData as any); // Save original for cancel
            } catch (error) {
                console.error("Error fetching data:", error);
                toast.error("Error loading data", {
                    description:
                        "Could not load organization data. Please try again later.",
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // Parse skills string into array when student data changes
    useEffect(() => {
        if (student.skills) {
            const skills = student.skills
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            setSkillsArray(skills);
        } else {
            setSkillsArray([]);
        }
    }, [student.skills]);

    // Check if there are any changes
    useEffect(() => {
        if (!originalStudent) return;

        const changed =
            student.phone !== originalStudent.phone ||
            student.school !== originalStudent.school ||
            student.program !== originalStudent.program ||
            student.graduationYear !== originalStudent.graduationYear ||
            student.linkedinUrl !== originalStudent.linkedinUrl ||
            student.portfolioUrl !== originalStudent.portfolioUrl ||
            student.devpostUsername !== originalStudent.devpostUsername ||
            student.githubUsername !== originalStudent.githubUsername ||
            student.skills !== originalStudent.skills;

        setHasChanges(changed);
    }, [student, originalStudent]);

    const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        // If devpostUsername changes, clear the verified profile
        if (name === "devpostUsername") {
            setStudent((prev) => ({
                ...prev,
                [name]: value,
                devpost: null, // Clear verified profile when username changes
            }));
        } else if (name === "githubUsername") {
            // If githubUsername changes, clear the verified profile and errors
            setStudent((prev) => {
                const updated = {
                    ...prev,
                    [name]: value,
                    github: undefined, // Clear verified profile when username changes
                };
                return updated;
            });
            setGithubError(null);
        } else {
            setStudent((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleToggleEdit = (field: keyof typeof isEditing) => {
        setIsEditing((prev) => ({ ...prev, [field]: !prev[field] }));
    };

    const handleDiscardField = (field: keyof typeof isEditing) => {
        if (originalStudent) {
            // If discarding devpostUsername, also restore the devpost profile and clear errors
            if (field === "devpostUsername") {
                setStudent((prev) => ({
                    ...prev,
                    devpostUsername: originalStudent.devpostUsername,
                    devpost: originalStudent.devpost,
                }));
                setDevpostError(null); // Clear any error messages
            } else if (field === "githubUsername") {
                // If discarding githubUsername, also restore the github profile and clear errors
                setStudent((prev) => ({
                    ...prev,
                    githubUsername: originalStudent.githubUsername,
                    github: originalStudent.github,
                }));
                setGithubError(null); // Clear any error messages
            } else {
                setStudent((prev) => ({
                    ...prev,
                    [field]: originalStudent[field as keyof StudentProps],
                }));
            }
            setIsEditing((prev) => ({ ...prev, [field]: false }));
        }
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        // Validate all fields before saving

        // Devpost validation: if username is provided, must be verified (case-insensitive)
        if (student.devpostUsername && student.devpostUsername.trim() !== "") {
            if (
                !student.devpost ||
                student.devpost.username.toLowerCase() !==
                    student.devpostUsername.toLowerCase()
            ) {
                toast.error("Devpost verification required", {
                    description:
                        "Please verify your Devpost username before saving",
                });
                return setIsSaving(false);
            }
        }

        // Phone validation (optional, but if provided must be valid)
        if (student.phone && student.phone.trim() !== "") {
            const phoneRegex = /^[\d\s\-\+\(\)]+$/;
            if (!phoneRegex.test(student.phone)) {
                toast.error("Invalid phone number", {
                    description:
                        "Phone number can only contain digits, spaces, and +()-",
                });
                return setIsSaving(false);
            }
            if (student.phone.replace(/\D/g, "").length < 10) {
                toast.error("Invalid phone number", {
                    description: "Phone number must be at least 10 digits",
                });
                return setIsSaving(false);
            }
        }

        // Graduation year validation (optional, but if provided must be valid)
        if (student.graduationYear && student.graduationYear.trim() !== "") {
            const yearRegex = /^\d{4}$/;
            if (!yearRegex.test(student.graduationYear)) {
                toast.error("Invalid graduation year", {
                    description:
                        "Graduation year must be a 4-digit year (e.g., 2025)",
                });
                return setIsSaving(false);
            }
            const year = parseInt(student.graduationYear);
            const currentYear = new Date().getFullYear();
            if (year < currentYear - 50 || year > currentYear + 6) {
                toast.error("Invalid graduation year", {
                    description: `Graduation year must be between ${
                        currentYear - 50
                    } and ${currentYear + 6}`,
                });
                return setIsSaving(false);
            }
        }

        // LinkedIn URL validation (optional, but if provided must be valid)
        if (student.linkedinUrl && student.linkedinUrl.trim() !== "") {
            const linkedinRegex =
                /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/i;
            if (!linkedinRegex.test(student.linkedinUrl.trim())) {
                toast.error("Invalid LinkedIn URL", {
                    description:
                        "LinkedIn URL must be in format: https://linkedin.com/in/username",
                });
                return setIsSaving(false);
            }
        }

        // Portfolio URL validation (optional, but if provided must be valid)
        if (student.portfolioUrl && student.portfolioUrl.trim() !== "") {
            const urlRegex = /^https?:\/\/.+\..+/i;
            if (!urlRegex.test(student.portfolioUrl.trim())) {
                toast.error("Invalid Portfolio URL", {
                    description:
                        "Portfolio URL must be a valid URL (e.g., https://yourportfolio.com)",
                });
                return setIsSaving(false);
            }
        }

        // Devpost username validation (optional, but if provided must be valid)
        if (student.devpostUsername && student.devpostUsername.trim() !== "") {
            const usernameRegex = /^[a-zA-Z0-9_-]+$/;
            if (!usernameRegex.test(student.devpostUsername.trim())) {
                toast.error("Invalid Devpost username", {
                    description:
                        "Devpost username can only contain letters, numbers, hyphens, and underscores",
                });
                return setIsSaving(false);
            }
        }

        // GitHub username validation (optional, but if provided must be valid)
        if (student.githubUsername && student.githubUsername.trim() !== "") {
            const githubRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
            if (!githubRegex.test(student.githubUsername.trim())) {
                toast.error("Invalid GitHub username", {
                    description:
                        "GitHub username must be 1-39 characters, alphanumeric or hyphens, and cannot start/end with a hyphen",
                });
                return setIsSaving(false);
            }
        }

        // All validations passed, proceed with save
        try {
            // Check against ORIGINAL student data (before editing)
            // because handleStudentChange clears the github field when username changes
            let finalGithubProfile = student.github;

            // Check if we need to disconnect GitHub
            const shouldDisconnectGithub =
                originalStudent?.github &&
                (!student.githubUsername ||
                    student.githubUsername.trim() === "" ||
                    (originalStudent.github.username &&
                        originalStudent.github.username.toLowerCase() !==
                            student.githubUsername.trim().toLowerCase()));

            if (shouldDisconnectGithub) {
                // Username changed without reconnecting - disconnect
                finalGithubProfile = undefined;

                // Unlink GitHub provider from Firebase Auth
                try {
                    if (studentAuth.currentUser) {
                        await unlink(studentAuth.currentUser, "github.com");
                    } else {
                        console.warn("No current user to unlink from");
                    }
                } catch (unlinkError: any) {
                    console.error(
                        "❌ Error unlinking GitHub provider:",
                        unlinkError.code,
                        unlinkError.message
                    );
                    // Continue even if unlink fails
                }

                // Call delete endpoint to remove GitHub profile from database
                try {
                    const deleteResponse = await apiFetch("/github/delete", {
                        method: "DELETE",
                    });

                    if (!deleteResponse.ok) {
                        toast.warning(
                            "❌ Failed to delete GitHub profile from database:"
                        );
                    }
                } catch (deleteError) {
                    toast.error("❌ Error deleting GitHub profile:");
                }

                toast.info("GitHub disconnected", {
                    description:
                        "Username changed. Connect again to restore extended profile data.",
                });
            }

            // Create a trimmed copy of the student data
            const trimmedStudentData: StudentProps = {
                ...student,
                phone: student.phone?.trim() || "",
                school: student.school?.trim() || "",
                program: student.program?.trim() || "",
                graduationYear: student.graduationYear?.trim() || "",
                linkedinUrl: student.linkedinUrl?.trim() || "",
                portfolioUrl: student.portfolioUrl?.trim() || "",
                devpostUsername: student.devpostUsername?.trim() || "",
                githubUsername: student.githubUsername?.trim() || "",
                skills: student.skills?.trim() || "",
                github: finalGithubProfile,
            };

            // Send trimmed data to backend
            const response = await apiService.updateStudent(trimmedStudentData);

            if (!response.ok) throw new Error("Failed to update student");

            // Save Devpost profile if it exists and was verified
            if (student.devpost && student.devpost.username) {
                try {
                    const saveResponse = await apiFetch(`/devpost/save`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            devpostProfile: student.devpost,
                        }),
                    });

                    if (!saveResponse.ok) {
                        toast.warning("Devpost profile not saved", {
                            description:
                                "Profile updated but Devpost could not be saved. Please try again.",
                        });
                    }
                } catch (saveError) {
                    // Don't block the user if save fails, just show warning
                    toast.warning("Error saving Devpost profile", {
                        description:
                            "Your profile was saved but Devpost could not be updated.",
                    });
                }
            }

            // Note: GitHub profile is already saved in the database during the OAuth flow
            // in the /github/profile endpoint, so no separate save call is needed here

            // Update local state with trimmed data
            setStudent(trimmedStudentData);
            setOriginalStudent(trimmedStudentData);
            setHasChanges(false);

            // Reset all editing states
            setIsEditing({
                phone: false,
                school: false,
                program: false,
                graduationYear: false,
                linkedinUrl: false,
                portfolioUrl: false,
                devpostUsername: false,
                githubUsername: false,
            });
            toast.success("Profile updated", {
                description: "Your profile has been updated successfully.",
            });
        } catch (error) {
            console.error("Error updating student:", error);
            toast.error("Error updating profile", {
                description: "Could not update your profile. Please try again.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelChanges = () => {
        if (originalStudent) {
            setStudent(originalStudent);
            setHasChanges(false);
            // Reset all editing states
            setIsEditing({
                phone: false,
                school: false,
                program: false,
                graduationYear: false,
                linkedinUrl: false,
                portfolioUrl: false,
                devpostUsername: false,
                githubUsername: false,
            });
            toast.info("Changes discarded", {
                description: "All changes have been reverted.",
            });
        }
    };

    const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // ✅ Check file type
        if (file.type !== "application/pdf") {
            toast.error("Invalid file type", {
                description: "Please upload a PDF document.",
            });
            e.target.value = ""; // reset input
            return;
        }

        // ✅ Sanitize file name (letters + spaces only)
        const sanitizedFileName = file.name
            .replace(/\.[^/.]+$/, "") // remove extension
            .replace(/[^A-Za-z\s]/g, "") // only letters and spaces
            .trim();

        if (sanitizedFileName.length === 0) {
            toast.error("Invalid file name", {
                description: "Name must only contain letters or spaces.",
            });
            e.target.value = "";
            return;
        }

        // ✅ Create a new File with sanitized name + .pdf extension
        const cleanFile = new File([file], `${sanitizedFileName}.pdf`, {
            type: file.type,
        });

        setResumeFile(cleanFile);
    };

    const fetchDevpostProfile = async () => {
        if (!student.devpostUsername) {
            toast.error("Please enter a Devpost username first");
            return;
        }

        setIsLoadingDevpost(true);
        setDevpostError(null);

        try {
            const response = await apiFetch(`/devpost/profile`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username: student.devpostUsername }),
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

            // Update student state with the verified profile
            setStudent((prev) => ({
                ...prev,
                devpost: responseData.data,
            }));

            // Also update original student to reflect saved state
            setOriginalStudent((prev) =>
                prev
                    ? {
                          ...prev,
                          devpost: responseData.data,
                      }
                    : null
            );

            toast.success("Devpost profile verified!", {
                description: `Found ${responseData.data.stats.projectCount} projects and ${responseData.data.stats.hackathonCount} hackathons`,
            });
        } catch (error) {
            setDevpostError(
                "Could not load Devpost profile. Please check the username and try again."
            );
            toast.error("Verification failed", {
                description:
                    "Could not load Devpost profile. Please check the username and try again.",
            });
            console.error(error);
        } finally {
            setIsLoadingDevpost(false);
        }
    };

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
                    if (!studentAuth.currentUser)
                        throw new Error("User not authenticated");
                    const result = await linkWithPopup(
                        studentAuth.currentUser,
                        githubProvider
                    );
                    const credential =
                        GithubAuthProvider.credentialFromResult(result);
                    token = credential?.accessToken;
                } catch (error) {
                    // If we get credential-already-in-use, that's expected
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
                    if (!studentAuth.currentUser)
                        throw new Error("User not authenticated");
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

                // Update student state with the verified profile
                setStudent((prev) => {
                    const updated = {
                        ...prev,
                        githubUsername: profileData.username,
                        github: profileData,
                    };
                    return updated;
                });

                // Also update original student to reflect saved state
                setOriginalStudent((prev) =>
                    prev
                        ? {
                              ...prev,
                              githubUsername: profileData.username,
                              github: profileData,
                          }
                        : null
                );

                toast.success("GitHub profile connected!", {
                    description: `Connected ${profileData.username} with ${profileData.repoCount} repositories`,
                });
            } else {
                throw new Error("Failed to get GitHub token");
            }
        } catch (error) {
            setGithubError(
                "Could not connect GitHub profile. Please try again."
            );
            toast.error("Connection failed", {
                description:
                    "Could not connect GitHub profile. Please try again.",
            });
            console.error(error);
        } finally {
            setIsLoadingGithub(false);
        }
    };

    const handleResumeUpload = async () => {
        if (!resumeFile) return;

        setIsUploadingResume(true);
        try {
            const formData = new FormData();
            formData.append("resume", resumeFile);

            const response = await apiFetch("/profile/main-resume", {
                method: "PATCH",
                body: formData,
            });

            if (!response.ok) throw new Error("Failed to upload resume");

            toast.success("Resume uploaded successfully!");
            setResumeFile(null);
        } catch (error) {
            console.error("Error uploading resume:", error);
            toast.error("Error uploading resume", {
                description: "Please try again later.",
            });
        } finally {
            setIsUploadingResume(false);
        }
    };

    // Skills management functions
    const handleAddSkill = () => {
        const trimmedSkill = newSkill.trim();

        if (!trimmedSkill) {
            toast.error("Please enter a skill");
            return;
        }

        if (skillsArray.length >= 15) {
            toast.error("Maximum 15 skills allowed");
            return;
        }

        if (
            skillsArray.some(
                (skill) => skill.toLowerCase() === trimmedSkill.toLowerCase()
            )
        ) {
            toast.error("Skill already exists");
            return;
        }

        const updatedSkills = [...skillsArray, trimmedSkill];
        setSkillsArray(updatedSkills);
        setStudent((prev) => ({ ...prev, skills: updatedSkills.join(", ") }));
        setNewSkill("");
        toast.success("Skill added");
    };

    const handleRemoveSkill = (indexToRemove: number) => {
        const updatedSkills = skillsArray.filter(
            (_, index) => index !== indexToRemove
        );
        setSkillsArray(updatedSkills);
        setStudent((prev) => ({ ...prev, skills: updatedSkills.join(", ") }));
        toast.success("Skill removed");
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddSkill();
        }
    };

    // Add a new function to render skeleton UI
    const renderSkeletonContent = () => (
        <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center space-x-4 w-full">
                        <Skeleton className="w-[100px] h-[100px] rounded-lg" />
                        <div className="flex-grow space-y-3">
                            <Skeleton className="h-8 w-[200px]" />
                            <Skeleton className="h-4 w-[140px]" />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-7 w-[100px]" />
                        <Skeleton className="h-9 w-[120px]" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between p-3"
                            >
                                <div className="flex items-center space-x-4">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-[150px]" />
                                        <Skeleton className="h-4 w-[200px]" />
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Skeleton className="h-5 w-[60px]" />
                                    <Skeleton className="h-8 w-8 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    // Replace the existing loading check with skeleton UI
    if (isLoading) {
        return renderSkeletonContent();
    }

    return (
        <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
            <Card>
                <CardHeader>
                    {/* TODO: Add profile picture functionality */}
                    <div className="relative my-3 pb-4">
                        <img
                            src="https://www.placeholderimage.online/images/generic/users-profile.jpg"
                            alt="Profile"
                            className="w-24 h-24 rounded-full object-cover"
                        />
                        <h1 className="text-2xl font-bold mt-2">
                            {student.firstName} {student.lastName}
                        </h1>
                        {/* <button className="absolute bottom-0 right-0 bg-black text-white p-2 rounded-full shadow-md hover:bg-blue-600">
                            <Upload className="w-4 h-4" />
                        </button> */}
                    </div>
                </CardHeader>
                <CardContent>
                    <Accordion
                        type="single"
                        collapsible
                        defaultValue="personal"
                        className="w-full space-y-4"
                    >
                        <AccordionItem
                            value="personal"
                            className="border-2 border-gray-200 rounded-lg px-4 !border-b-2"
                        >
                            <AccordionTrigger className="text-lg font-semibold hover:no-underline cursor-pointer py-4">
                                Personal Information
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 pt-0">
                                <div className="flex items-center space-x-4">
                                    <div className="flex-grow space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label
                                                    htmlFor="firstName"
                                                    className="block mb-1"
                                                >
                                                    First Name
                                                </Label>
                                                <Input
                                                    id="firstName"
                                                    name="firstName"
                                                    value={student.firstName}
                                                    placeholder="First Name"
                                                    className="w-full"
                                                    disabled
                                                />
                                            </div>
                                            <div>
                                                <Label
                                                    htmlFor="lastName"
                                                    className="block mb-1"
                                                >
                                                    Last Name
                                                </Label>
                                                <Input
                                                    id="lastName"
                                                    name="lastName"
                                                    value={student.lastName}
                                                    placeholder="Last Name"
                                                    className="w-full"
                                                    disabled
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Label
                                                    htmlFor="email"
                                                    className="block mb-1"
                                                >
                                                    Email
                                                </Label>
                                                <Input
                                                    id="email"
                                                    name="email"
                                                    value={student.email}
                                                    placeholder="Email"
                                                    className="w-full"
                                                    disabled
                                                />
                                            </div>
                                            <div>
                                                <Label
                                                    htmlFor="phone"
                                                    className="block mb-1"
                                                >
                                                    Phone Number
                                                </Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        id="phone"
                                                        name="phone"
                                                        value={student.phone}
                                                        onChange={
                                                            handleStudentChange
                                                        }
                                                        placeholder="Phone Number"
                                                        className="w-full"
                                                        disabled={
                                                            !isEditing.phone ||
                                                            isSaving
                                                        }
                                                    />
                                                    {isEditing.phone ? (
                                                        <button
                                                            onClick={() =>
                                                                handleDiscardField(
                                                                    "phone"
                                                                )
                                                            }
                                                            className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                            title="Discard changes"
                                                            disabled={isSaving}
                                                        >
                                                            <X className="h-4 w-4 text-red-600" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() =>
                                                                handleToggleEdit(
                                                                    "phone"
                                                                )
                                                            }
                                                            className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                            title="Edit field"
                                                            disabled={isSaving}
                                                        >
                                                            <PencilLine className="h-4 w-4 text-gray-600" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <Label
                                                    htmlFor="school"
                                                    className="block mb-1"
                                                >
                                                    University/College
                                                </Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        id="school"
                                                        name="school"
                                                        value={student.school}
                                                        onChange={
                                                            handleStudentChange
                                                        }
                                                        placeholder="University/College"
                                                        className="w-full"
                                                        disabled={
                                                            !isEditing.school ||
                                                            isSaving
                                                        }
                                                    />
                                                    {isEditing.school ? (
                                                        <button
                                                            onClick={() =>
                                                                handleDiscardField(
                                                                    "school"
                                                                )
                                                            }
                                                            className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                            title="Discard changes"
                                                            disabled={isSaving}
                                                        >
                                                            <X className="h-4 w-4 text-red-600" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() =>
                                                                handleToggleEdit(
                                                                    "school"
                                                                )
                                                            }
                                                            className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                            title="Edit field"
                                                            disabled={isSaving}
                                                        >
                                                            <PencilLine className="h-4 w-4 text-gray-600" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <Label
                                                    htmlFor="program"
                                                    className="block mb-1"
                                                >
                                                    Major/Program
                                                </Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        id="program"
                                                        name="program"
                                                        value={student.program}
                                                        onChange={
                                                            handleStudentChange
                                                        }
                                                        placeholder="Major/Program"
                                                        className="w-full"
                                                        disabled={
                                                            !isEditing.program ||
                                                            isSaving
                                                        }
                                                    />
                                                    {isEditing.program ? (
                                                        <button
                                                            onClick={() =>
                                                                handleDiscardField(
                                                                    "program"
                                                                )
                                                            }
                                                            className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                            title="Discard changes"
                                                            disabled={isSaving}
                                                        >
                                                            <X className="h-4 w-4 text-red-600" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() =>
                                                                handleToggleEdit(
                                                                    "program"
                                                                )
                                                            }
                                                            className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                            title="Edit field"
                                                            disabled={isSaving}
                                                        >
                                                            <PencilLine className="h-4 w-4 text-gray-600" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <Label
                                                    htmlFor="graduationYear"
                                                    className="block mb-1"
                                                >
                                                    Expected Graduation Year
                                                </Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        id="graduationYear"
                                                        name="graduationYear"
                                                        value={
                                                            student.graduationYear
                                                        }
                                                        onChange={
                                                            handleStudentChange
                                                        }
                                                        placeholder="Expected Graduation Year"
                                                        className="w-full"
                                                        disabled={
                                                            !isEditing.graduationYear ||
                                                            isSaving
                                                        }
                                                    />
                                                    {isEditing.graduationYear ? (
                                                        <button
                                                            onClick={() =>
                                                                handleDiscardField(
                                                                    "graduationYear"
                                                                )
                                                            }
                                                            className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                            title="Discard changes"
                                                            disabled={isSaving}
                                                        >
                                                            <X className="h-4 w-4 text-red-600" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() =>
                                                                handleToggleEdit(
                                                                    "graduationYear"
                                                                )
                                                            }
                                                            className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                            title="Edit field"
                                                            disabled={isSaving}
                                                        >
                                                            <PencilLine className="h-4 w-4 text-gray-600" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem
                            value="connections"
                            className="border-2 border-gray-200 rounded-lg px-4 !border-b-2"
                        >
                            <AccordionTrigger className="text-lg font-semibold hover:no-underline cursor-pointer py-4">
                                Connections
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 pt-0">
                                <div className="space-y-4">
                                    <div>
                                        <Label
                                            htmlFor="linkedin"
                                            className="block text-sm font-medium text-gray-700 mb-1"
                                        >
                                            LinkedIn URL
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="linkedin"
                                                name="linkedinUrl"
                                                value={
                                                    student.linkedinUrl || ""
                                                }
                                                onChange={handleStudentChange}
                                                placeholder="https://linkedin.com/in/username"
                                                className="w-full border-gray-300 focus:ring-black focus:border-black"
                                                disabled={
                                                    !isEditing.linkedinUrl ||
                                                    isSaving
                                                }
                                            />
                                            {isEditing.linkedinUrl ? (
                                                <button
                                                    onClick={() =>
                                                        handleDiscardField(
                                                            "linkedinUrl"
                                                        )
                                                    }
                                                    className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                    title="Discard changes"
                                                    disabled={isSaving}
                                                >
                                                    <X className="h-4 w-4 text-red-600" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() =>
                                                        handleToggleEdit(
                                                            "linkedinUrl"
                                                        )
                                                    }
                                                    className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                    title="Edit field"
                                                    disabled={isSaving}
                                                >
                                                    <PencilLine className="h-4 w-4 text-gray-600" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <Label
                                            htmlFor="portfolioUrl"
                                            className="block text-sm font-medium text-gray-700 mb-1"
                                        >
                                            Portfolio URL
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="portfolioUrl"
                                                name="portfolioUrl"
                                                value={
                                                    student.portfolioUrl || ""
                                                }
                                                onChange={handleStudentChange}
                                                placeholder="https://yourportfolio.com"
                                                className="w-full border-gray-300 focus:ring-black focus:border-black"
                                                disabled={
                                                    !isEditing.portfolioUrl ||
                                                    isSaving
                                                }
                                            />
                                            {isEditing.portfolioUrl ? (
                                                <button
                                                    onClick={() =>
                                                        handleDiscardField(
                                                            "portfolioUrl"
                                                        )
                                                    }
                                                    className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                    title="Discard changes"
                                                    disabled={isSaving}
                                                >
                                                    <X className="h-4 w-4 text-red-600" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() =>
                                                        handleToggleEdit(
                                                            "portfolioUrl"
                                                        )
                                                    }
                                                    className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                    title="Edit field"
                                                    disabled={isSaving}
                                                >
                                                    <PencilLine className="h-4 w-4 text-gray-600" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <Label
                                            htmlFor="devpostUsername"
                                            className="block text-sm font-medium text-gray-700 mb-1"
                                        >
                                            Devpost Username
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="devpostUsername"
                                                name="devpostUsername"
                                                value={
                                                    student.devpostUsername ||
                                                    ""
                                                }
                                                onChange={handleStudentChange}
                                                placeholder="Devpost Username"
                                                className="flex-1 border-gray-300 focus:ring-black focus:border-black"
                                                disabled={
                                                    !isEditing.devpostUsername ||
                                                    isSaving ||
                                                    isLoadingDevpost
                                                }
                                            />
                                            {/* Only show Verify button when editing */}
                                            {isEditing.devpostUsername && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={
                                                        fetchDevpostProfile
                                                    }
                                                    disabled={
                                                        isLoadingDevpost ||
                                                        !student.devpostUsername ||
                                                        isSaving
                                                    }
                                                    className="whitespace-nowrap"
                                                >
                                                    {isLoadingDevpost ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        "Verify"
                                                    )}
                                                </Button>
                                            )}
                                            {isEditing.devpostUsername ? (
                                                <button
                                                    onClick={() =>
                                                        handleDiscardField(
                                                            "devpostUsername"
                                                        )
                                                    }
                                                    className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                    title="Discard changes"
                                                    disabled={
                                                        isSaving ||
                                                        isLoadingDevpost
                                                    }
                                                >
                                                    <X className="h-4 w-4 text-red-600" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() =>
                                                        handleToggleEdit(
                                                            "devpostUsername"
                                                        )
                                                    }
                                                    className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                    title="Edit field"
                                                    disabled={isSaving}
                                                >
                                                    <PencilLine className="h-4 w-4 text-gray-600" />
                                                </button>
                                            )}
                                        </div>
                                        {devpostError && (
                                            <p className="text-sm text-red-600 mt-1">
                                                {devpostError}
                                            </p>
                                        )}

                                        {/* Warning message if username is entered but not verified (only show when editing) */}
                                        {isEditing.devpostUsername &&
                                            student.devpostUsername &&
                                            student.devpostUsername.trim() !==
                                                "" &&
                                            (!student.devpost ||
                                                student.devpost.username.toLowerCase() !==
                                                    student.devpostUsername.toLowerCase()) && (
                                                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                    <p className="text-sm text-yellow-800">
                                                        ⚠️ Please verify your
                                                        Devpost username before
                                                        saving
                                                    </p>
                                                </div>
                                            )}

                                        {/* Display verified Devpost profile (case-insensitive) */}
                                        {student.devpost &&
                                            student.devpost.username.toLowerCase() ===
                                                student.devpostUsername.toLowerCase() && (
                                                <div className="mt-3 rounded-lg border p-4 bg-green-50 border-green-200">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <h4 className="font-medium text-gray-900">
                                                                {student.devpost
                                                                    .name ||
                                                                    student
                                                                        .devpost
                                                                        .username}
                                                            </h4>
                                                            <p className="text-sm text-gray-600">
                                                                @
                                                                {
                                                                    student
                                                                        .devpost
                                                                        .username
                                                                }
                                                            </p>
                                                            <div className="mt-2 grid grid-cols-4 gap-4 text-center">
                                                                <div>
                                                                    <p className="text-lg font-semibold text-gray-900">
                                                                        {
                                                                            student
                                                                                .devpost
                                                                                .stats
                                                                                .projectCount
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-gray-600">
                                                                        Projects
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-lg font-semibold text-gray-900">
                                                                        {
                                                                            student
                                                                                .devpost
                                                                                .stats
                                                                                .hackathonCount
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-gray-600">
                                                                        Hackathons
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-lg font-semibold text-gray-900">
                                                                        {
                                                                            student
                                                                                .devpost
                                                                                .stats
                                                                                .winCount
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-gray-600">
                                                                        Wins
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-lg font-semibold text-gray-900">
                                                                        {student
                                                                            .devpost
                                                                            .achievements
                                                                            ?.firstPlaceWins ||
                                                                            0}
                                                                    </p>
                                                                    <p className="text-xs text-gray-600">
                                                                        1st
                                                                        Places
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-3">
                                                        ✓ Profile verified and
                                                        saved
                                                    </p>
                                                </div>
                                            )}

                                        {/* Info message when no username is entered */}
                                        {(!student.devpostUsername ||
                                            student.devpostUsername.trim() ===
                                                "") && (
                                            <p className="text-xs text-gray-500 mt-2">
                                                Enter your Devpost username and
                                                click "Verify" to connect your
                                                profile
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <Label
                                            htmlFor="githubUsername"
                                            className="block text-sm font-medium text-gray-700 mb-1"
                                        >
                                            GitHub Username
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="githubUsername"
                                                name="githubUsername"
                                                value={
                                                    student.githubUsername || ""
                                                }
                                                onChange={handleStudentChange}
                                                placeholder="GitHub Username"
                                                className="flex-1 border-gray-300 focus:ring-black focus:border-black"
                                                disabled={
                                                    !isEditing.githubUsername ||
                                                    isSaving ||
                                                    isLoadingGithub
                                                }
                                            />
                                            {/* Show Connect button when NOT connected OR when username changed (independent of editing state) */}
                                            {(!student.github ||
                                                (student.githubUsername &&
                                                    student.github.username.toLowerCase() !==
                                                        student.githubUsername.toLowerCase())) && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={fetchGithubProfile}
                                                    disabled={
                                                        isLoadingGithub ||
                                                        isSaving
                                                    }
                                                    className="whitespace-nowrap"
                                                >
                                                    {isLoadingGithub ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Github className="h-4 w-4 mr-1" />
                                                            Connect
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                            {isEditing.githubUsername ? (
                                                <button
                                                    onClick={() =>
                                                        handleDiscardField(
                                                            "githubUsername"
                                                        )
                                                    }
                                                    className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                    title="Discard changes"
                                                    disabled={
                                                        isSaving ||
                                                        isLoadingGithub
                                                    }
                                                >
                                                    <X className="h-4 w-4 text-red-600" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() =>
                                                        handleToggleEdit(
                                                            "githubUsername"
                                                        )
                                                    }
                                                    className="p-2 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                                    title="Edit field"
                                                    disabled={isSaving}
                                                >
                                                    <PencilLine className="h-4 w-4 text-gray-600" />
                                                </button>
                                            )}
                                        </div>
                                        {githubError && (
                                            <p className="text-sm text-red-600 mt-1">
                                                {githubError}
                                            </p>
                                        )}

                                        {/* Display connected GitHub profile */}
                                        {student.github && (
                                            <div className="mt-3 rounded-lg border p-4 bg-blue-50 border-blue-200">
                                                <div className="flex items-start gap-4">
                                                    <img
                                                        src={
                                                            student.github
                                                                .avatarUrl
                                                        }
                                                        alt={
                                                            student.github
                                                                .username
                                                        }
                                                        className="w-16 h-16 rounded-full"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-medium text-gray-900">
                                                                {student.github
                                                                    .name ||
                                                                    student
                                                                        .github
                                                                        .username}
                                                            </h4>
                                                            <a
                                                                href={`https://github.com/${student.github.username}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm text-blue-600 hover:text-blue-800"
                                                            >
                                                                @
                                                                {
                                                                    student
                                                                        .github
                                                                        .username
                                                                }
                                                            </a>
                                                        </div>
                                                        {student.github.bio && (
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                {
                                                                    student
                                                                        .github
                                                                        .bio
                                                                }
                                                            </p>
                                                        )}
                                                        <div className="mt-3 grid grid-cols-4 gap-4 text-center">
                                                            <div>
                                                                <p className="text-lg font-semibold text-gray-900">
                                                                    {
                                                                        student
                                                                            .github
                                                                            .repoCount
                                                                    }
                                                                </p>
                                                                <p className="text-xs text-gray-600">
                                                                    Repos
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-lg font-semibold text-gray-900">
                                                                    {
                                                                        student
                                                                            .github
                                                                            .starsReceived
                                                                    }
                                                                </p>
                                                                <p className="text-xs text-gray-600">
                                                                    Stars
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-lg font-semibold text-gray-900">
                                                                    {
                                                                        student
                                                                            .github
                                                                            .followers
                                                                    }
                                                                </p>
                                                                <p className="text-xs text-gray-600">
                                                                    Followers
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-lg font-semibold text-gray-900">
                                                                    {
                                                                        student
                                                                            .github
                                                                            .contributionCount
                                                                    }
                                                                </p>
                                                                <p className="text-xs text-gray-600">
                                                                    Contributions
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {student.github
                                                            .topLanguages
                                                            .length > 0 && (
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {student.github.topLanguages
                                                                    .slice(0, 5)
                                                                    .map(
                                                                        (
                                                                            lang
                                                                        ) => (
                                                                            <span
                                                                                key={
                                                                                    lang
                                                                                }
                                                                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                                                            >
                                                                                {
                                                                                    lang
                                                                                }
                                                                            </span>
                                                                        )
                                                                    )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-3">
                                                    ✓ Profile connected and
                                                    saved
                                                </p>
                                            </div>
                                        )}

                                        {/* Warning when username changed after connection */}
                                        {originalStudent?.github &&
                                            student.githubUsername &&
                                            originalStudent.github.username.toLowerCase() !==
                                                student.githubUsername.toLowerCase() && (
                                                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                    <p className="text-sm text-yellow-800">
                                                        ⚠️ Username changed -
                                                        you'll be disconnected
                                                        from extended GitHub
                                                        data. Click "X" to
                                                        discard changes and keep
                                                        your current connection
                                                        or save changes to
                                                        disconnect.
                                                    </p>
                                                </div>
                                            )}

                                        {/* Info message when no connection */}
                                        {!student.github && (
                                            <p className="text-xs text-gray-500 mt-2">
                                                {student.githubUsername &&
                                                student.githubUsername.trim() !==
                                                    ""
                                                    ? "Press 'Save Changes' to save your username or Click 'Connect' to link your profile for extended data."
                                                    : "Enter your GitHub username or click 'Connect' to link your profile"}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem
                            value="skills"
                            className="border-2 border-gray-200 rounded-lg px-4 !border-b-2"
                        >
                            <AccordionTrigger className="text-lg font-semibold hover:no-underline cursor-pointer py-4">
                                Skills
                            </AccordionTrigger>
                            <AccordionContent className="pb-6 pt-0">
                                <div className="space-y-4">
                                    <div>
                                        <Label
                                            htmlFor="newSkill"
                                            className="block text-sm font-medium text-gray-700 mb-2"
                                        >
                                            Add a new skill
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="newSkill"
                                                value={newSkill}
                                                onChange={(e) =>
                                                    setNewSkill(e.target.value)
                                                }
                                                onKeyPress={handleKeyPress}
                                                placeholder="e.g., React, Python, Design..."
                                                className="flex-1"
                                                maxLength={50}
                                                disabled={
                                                    skillsArray.length >= 15
                                                }
                                            />
                                            <Button
                                                type="button"
                                                onClick={handleAddSkill}
                                                disabled={
                                                    skillsArray.length >= 15 ||
                                                    !newSkill.trim()
                                                }
                                                className="bg-black text-white hover:bg-gray-800"
                                            >
                                                Add
                                            </Button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {skillsArray.length >= 15
                                                ? "Maximum skills reached"
                                                : `You can add ${
                                                      15 - skillsArray.length
                                                  } more skill${
                                                      15 -
                                                          skillsArray.length !==
                                                      1
                                                          ? "s"
                                                          : ""
                                                  }`}
                                        </p>
                                    </div>

                                    {skillsArray.length > 0 ? (
                                        <div>
                                            <Label className="block text-sm font-medium text-gray-700 mb-2">
                                                Your Skills
                                            </Label>
                                            <div className="flex flex-wrap gap-2">
                                                {skillsArray.map(
                                                    (skill, index) => (
                                                        <div
                                                            key={index}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200"
                                                        >
                                                            <span>{skill}</span>
                                                            <button
                                                                onClick={() =>
                                                                    handleRemoveSkill(
                                                                        index
                                                                    )
                                                                }
                                                                className="ml-1 hover:bg-blue-100 rounded-full p-0.5 transition-colors cursor-pointer"
                                                                title="Remove skill"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                                            <p className="text-sm text-gray-500">
                                                No skills added yet. Add your
                                                first skill above!
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem
                            value="resume"
                            className="border-2 border-gray-200 rounded-lg px-4 !border-b-2"
                        >
                            <AccordionTrigger className="text-lg font-semibold hover:no-underline cursor-pointer py-4">
                                Resume
                            </AccordionTrigger>
                            <AccordionContent className="pb-6 pt-0">
                                <div className="block text-sm font-medium text-gray-700 mb-2">
                                    Resume (PDF)
                                </div>
                                {student.resume?.name ? (
                                    <div className="mb-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-green-100 p-2 rounded-lg">
                                                    <Upload className="h-5 w-5 text-green-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {student.resume.name}
                                                        .pdf
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        Uploaded on{" "}
                                                        {new Date(
                                                            student.resume
                                                                .uploadedAt
                                                                ._seconds * 1000
                                                        ).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            {student.resume.url && (
                                                <a
                                                    href={student.resume.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-medium text-green-700 hover:text-green-800 underline"
                                                >
                                                    View
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mb-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                        <p className="text-sm text-gray-500">
                                            No resume uploaded yet.
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-2">
                                    <Input
                                        id="resume"
                                        type="file"
                                        accept="application/pdf"
                                        onChange={handleResumeChange}
                                        className="w-full cursor-pointer"
                                    />
                                    <Button
                                        className="bg-black text-white"
                                        disabled={
                                            !resumeFile || isUploadingResume
                                        }
                                        onClick={async () => {
                                            await handleResumeUpload();
                                            const updatedStudent =
                                                await apiService.getStudent();
                                            setStudent(updatedStudent as any);
                                            setOriginalStudent(
                                                updatedStudent as any
                                            );
                                        }}
                                    >
                                        {isUploadingResume ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "Upload"
                                        )}
                                    </Button>
                                </div>

                                {resumeFile && (
                                    <p className="mt-1 text-sm text-gray-500">
                                        Ready to upload:{" "}
                                        <span className="font-medium">
                                            {resumeFile.name}
                                        </span>
                                    </p>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    {hasChanges && (
                        <div className="flex gap-3 justify-end pt-4 border-t mt-6">
                            <Button
                                variant="ghost"
                                onClick={handleCancelChanges}
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-black text-white hover:bg-gray-800"
                                onClick={handleSaveChanges}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
