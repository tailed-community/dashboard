import type React from "react";
import { useState, useEffect, useMemo } from "react";
import {
    Upload,
    Loader2,
    Github,
    Linkedin,
    Globe,
    GraduationCap,
    User,
    Code,
    FileText,
    PencilLine,
    X,
    CheckCircle2,
    Circle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fetchGithubUserProfile, type GithubProfile } from "@/lib/github";
import { studentAuth, initializeStudentSession } from "@/lib/auth";
import {
    linkWithPopup,
    GithubAuthProvider,
    unlink,
    signInWithCredential,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import type { DevpostProfile } from "../jobs/[slug]/apply/types";

type StudentProps = {
    email: string;
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    location: string;
    school: string;
    program: string;
    graduationYear: string;
    devpostUsername: string;
    devpost?: DevpostProfile;
    linkedinUrl: string;
    portfolioUrl: string;
    githubUsername: string;
    github?: GithubProfile;
    skills: string[];
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
    profileScore?: {
        score: number;
        completed: {
            devpost: boolean;
            devpostUsername: boolean;
            github: boolean;
            githubUsername: boolean;
            linkedinUrl: boolean;
            portfolioUrl: boolean;
            resume: boolean;
            skills: boolean;
        };
    };
};

// API service functions
const apiService = {
    getStudent: async () => {
        try {
            const response = await apiFetch("/profile");
            if (!response.ok) throw new Error("Failed to fetch profile");
            return await response.json();
        } catch (error) {
            console.error("Error fetching profile:", error);
            throw error;
        }
    },
    updateStudent: async (studentData: StudentProps) => {
        try {
            const response = await apiFetch("/profile/update", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(studentData),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.message || "Failed to update profile"
                );
            }
            return await response;
        } catch (error) {
            console.error("Error updating profile:", error);
            throw error;
        }
    },
};

export default function AccountPage() {
    const [student, setStudent] = useState({
        id: "",
        email: "",
        firstName: "",
        lastName: "",
        phone: "",
        location: "",
        school: "",
        program: "",
        graduationYear: "",
        linkedinUrl: "",
        portfolioUrl: "",
        devpostUsername: "",
        githubUsername: "",
        skills: [],
        resume: {
            id: "",
            name: "",
            url: "",
            uploadedAt: { _seconds: 0, _nanoseconds: 0 },
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

    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [isUploadingResume, setIsUploadingResume] = useState(false);
    const [isDeletingResume, setIsDeletingResume] = useState(false);

    const [skillsArray, setSkillsArray] = useState<string[]>([]);
    const [newSkill, setNewSkill] = useState("");

    // Track which fields are being edited
    const [isEditing, setIsEditing] = useState({
        firstName: false,
        lastName: false,
        phone: false,
        location: false,
        school: false,
        program: false,
        graduationYear: false,
        linkedinUrl: false,
        portfolioUrl: false,
        devpostUsername: false,
        githubUsername: false,
    });

    // Validation errors
    const [validationErrors, setValidationErrors] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        location: "",
        school: "",
        program: "",
        graduationYear: "",
        linkedinUrl: "",
        portfolioUrl: "",
    });

    const [isLoadingDevpost, setIsLoadingDevpost] = useState(false);
    const [devpostError, setDevpostError] = useState<string | null>(null);

    const [isLoadingGithub, setIsLoadingGithub] = useState(false);
    const [githubError, setGithubError] = useState<string | null>(null);

    // Function to calculate profile completeness
    const calculateProfileScore = (profileData: any) => {
        const checks = {
            githubUsername: !!(
                profileData.githubUsername &&
                profileData.githubUsername.trim() !== ""
            ),
            github: !!(
                profileData.github && Object.keys(profileData.github).length > 0
            ),
            devpostUsername: !!(
                profileData.devpostUsername &&
                profileData.devpostUsername.trim() !== ""
            ),
            devpost: !!(
                profileData.devpost &&
                Object.keys(profileData.devpost).length > 0
            ),
            resume: !!(profileData.resume && profileData.resume.url),
            skills: !!(
                profileData.skills &&
                Array.isArray(profileData.skills) &&
                profileData.skills.length > 0
            ),
            linkedinUrl: !!(
                profileData.linkedinUrl && profileData.linkedinUrl.trim() !== ""
            ),
            portfolioUrl: !!(
                profileData.portfolioUrl &&
                profileData.portfolioUrl.trim() !== ""
            ),
        };

        // Calculate score: each field is worth 12.5 points (100/8)
        const completedCount = Object.values(checks).filter(Boolean).length;
        const score = Math.round((completedCount / 8) * 100);

        return {
            score,
            completed: checks,
        };
    };

    // Load student data
    useEffect(() => {
        const loadStudent = async () => {
            setIsLoading(true);
            try {
                const data = await apiService.getStudent();
                setStudent(data);
                setOriginalStudent(data);
            } catch (error) {
                toast.error("Failed to load profile");
            } finally {
                setIsLoading(false);
            }
        };
        loadStudent();
    }, []);

    // Calculate profile completeness dynamically whenever student data changes
    const profileScore = useMemo(() => {
        return calculateProfileScore(student);
    }, [
        student.githubUsername,
        student.github,
        student.devpostUsername,
        student.devpost,
        student.resume,
        student.skills,
        student.linkedinUrl,
        student.portfolioUrl,
    ]);

    // Parse skills array
    useEffect(() => {
        if (student.skills && student.skills.length > 0) {
            const skills = student.skills.flatMap((skill) =>
                skill
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
            );
            setSkillsArray(skills);
        } else {
            setSkillsArray([]);
        }
    }, [student.skills]);

    // Check for changes
    useEffect(() => {
        if (!originalStudent) return;

        const arraysEqual = (a: string[], b: string[]) => {
            const arrA = Array.isArray(a) ? a : [];
            const arrB = Array.isArray(b) ? b : [];
            if (arrA.length !== arrB.length) return false;
            return arrA.every((val, idx) => val === arrB[idx]);
        };

        const changed =
            student.firstName !== originalStudent.firstName ||
            student.lastName !== originalStudent.lastName ||
            student.phone !== originalStudent.phone ||
            student.location !== originalStudent.location ||
            student.school !== originalStudent.school ||
            student.program !== originalStudent.program ||
            student.graduationYear !== originalStudent.graduationYear ||
            student.linkedinUrl !== originalStudent.linkedinUrl ||
            student.portfolioUrl !== originalStudent.portfolioUrl ||
            student.devpostUsername !== originalStudent.devpostUsername ||
            student.githubUsername !== originalStudent.githubUsername ||
            !arraysEqual(student.skills, originalStudent.skills);

        setHasChanges(changed);
    }, [student, originalStudent]);

    const validateField = (name: string, value: string): string => {
        const currentYear = new Date().getFullYear();

        switch (name) {
            case "firstName":
            case "lastName":
                if (!value.trim())
                    return `${
                        name === "firstName" ? "First" : "Last"
                    } name is required`;
                if (!/^[a-zA-Z\s'-]+$/.test(value))
                    return "Only letters, spaces, hyphens, and apostrophes allowed";
                return "";

            case "phone":
                if (!value.trim()) return "Phone number is required";
                if (!/^[+\d\s()\-]+$/.test(value))
                    return "Invalid phone number format";
                return "";

            case "location":
                if (!value.trim()) return "Location is required";
                return "";

            case "school":
                if (!value.trim()) return "University/College is required";
                return "";

            case "program":
                if (!value.trim()) return "Major/Program is required";
                return "";

            case "graduationYear":
                if (!value.trim()) return "Graduation year is required";
                if (!/^\d{4}$/.test(value)) return "Must be a 4-digit year";
                const year = parseInt(value);
                if (year < currentYear - 50 || year > currentYear + 5) {
                    return `Must be between ${currentYear - 50} and ${
                        currentYear + 5
                    }`;
                }
                return "";

            case "linkedinUrl":
                if (!value.trim()) return ""; // Optional field
                try {
                    const url = new URL(value);
                    if (!url.protocol.match(/^https?:/)) {
                        return "URL must start with http:// or https://";
                    }
                    if (!url.hostname.includes("linkedin.com")) {
                        return "Must be a valid LinkedIn URL";
                    }
                } catch {
                    return "Invalid URL format";
                }
                return "";

            case "portfolioUrl":
                if (!value.trim()) return ""; // Optional field
                try {
                    const url = new URL(value);
                    if (!url.protocol.match(/^https?:/)) {
                        return "URL must start with http:// or https://";
                    }
                } catch {
                    return "Invalid URL format";
                }
                return "";

            default:
                return "";
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setStudent((prev) => ({ ...prev, [name]: value }));

        // Validate fields that require validation
        const requiredFields = [
            "firstName",
            "lastName",
            "phone",
            "location",
            "school",
            "program",
            "graduationYear",
            "linkedinUrl",
            "portfolioUrl",
        ];

        if (requiredFields.includes(name)) {
            const error = validateField(name, value);
            setValidationErrors((prev) => ({ ...prev, [name]: error }));
        }
    };

    const handleToggleEdit = (field: keyof typeof isEditing) => {
        setIsEditing((prev) => ({ ...prev, [field]: !prev[field] }));
    };

    const handleDiscardField = (field: keyof typeof isEditing) => {
        if (originalStudent) {
            setStudent((prev) => ({
                ...prev,
                [field]: (originalStudent as any)[field],
            }));
            setIsEditing((prev) => ({ ...prev, [field]: false }));
            // Clear validation error for this field
            setValidationErrors((prev) => ({ ...prev, [field]: "" }));
        }
    };

    const handleSaveChanges = async () => {
        // Only validate required fields that have been changed
        const requiredFields = [
            "firstName",
            "lastName",
            "phone",
            "location",
            "school",
            "program",
            "graduationYear",
        ];

        // Also validate optional URL fields if they have values
        const optionalUrlFields = ["linkedinUrl", "portfolioUrl"];

        const errors: any = {};
        let hasErrors = false;

        // Only validate fields that were modified
        requiredFields.forEach((field) => {
            const currentValue = (student as any)[field] || "";
            const originalValue = (originalStudent as any)?.[field] || "";

            // Only validate if the field was changed
            if (currentValue !== originalValue) {
                const error = validateField(field, currentValue);
                if (error) {
                    errors[field] = error;
                    hasErrors = true;
                }
            }
        });

        // Validate optional URL fields if they have values (changed or not)
        optionalUrlFields.forEach((field) => {
            const value = (student as any)[field] || "";
            if (value.trim()) {
                const error = validateField(field, value);
                if (error) {
                    errors[field] = error;
                    hasErrors = true;
                }
            }
        });

        if (hasErrors) {
            setValidationErrors((prev) => ({ ...prev, ...errors }));
            toast.error("Please fix all validation errors before saving");
            return;
        }

        setIsSaving(true);
        try {
            await apiService.updateStudent(student);
            setOriginalStudent(student);
            setHasChanges(false);
            // Clear any validation errors after successful save
            setValidationErrors({
                firstName: "",
                lastName: "",
                phone: "",
                location: "",
                school: "",
                program: "",
                graduationYear: "",
                linkedinUrl: "",
                portfolioUrl: "",
            });
            // Reset all editing states
            setIsEditing({
                firstName: false,
                lastName: false,
                phone: false,
                location: false,
                school: false,
                program: false,
                graduationYear: false,
                linkedinUrl: false,
                portfolioUrl: false,
                devpostUsername: false,
                githubUsername: false,
            });
            toast.success("Profile updated successfully!");
        } catch (error) {
            toast.error("Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelChanges = () => {
        if (originalStudent) {
            setStudent(originalStudent);
            setHasChanges(false);
        }
    };

    const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            toast.error("Invalid file type", {
                description: "Please upload a PDF document.",
            });
            e.target.value = "";
            return;
        }

        const sanitizedFileName = file.name
            .replace(/\.[^/.]+$/, "")
            .replace(/[^A-Za-z\s]/g, "")
            .trim();

        if (sanitizedFileName.length === 0) {
            toast.error("Invalid file name", {
                description: "Name must only contain letters or spaces.",
            });
            e.target.value = "";
            return;
        }

        const cleanFile = new File([file], `${sanitizedFileName}.pdf`, {
            type: file.type,
        });

        setResumeFile(cleanFile);
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

            if (!response.ok) throw new Error("Upload failed");

            toast.success("Resume uploaded successfully!");
            setResumeFile(null);
            const input = document.getElementById("resume") as HTMLInputElement;
            if (input) input.value = "";
        } catch (error) {
            toast.error("Failed to upload resume");
        } finally {
            setIsUploadingResume(false);
        }
    };

    const handleDeleteResume = async () => {
        if (!student.resume?.id) return;

        // Confirm deletion
        const confirmed = window.confirm(
            "Are you sure you want to delete your resume? This action cannot be undone."
        );

        if (!confirmed) return;

        setIsDeletingResume(true);
        try {
            const response = await apiFetch("/profile/main-resume", {
                method: "DELETE",
            });

            if (!response.ok) throw new Error("Delete failed");

            // Update local state to remove resume
            const updatedStudent = {
                ...student,
                resume: {
                    id: "",
                    name: "",
                    url: "",
                    uploadedAt: { _seconds: 0, _nanoseconds: 0 },
                },
            };
            setStudent(updatedStudent as StudentProps);
            setOriginalStudent(updatedStudent as StudentProps);

            toast.success("Resume deleted successfully!");
        } catch (error) {
            toast.error("Failed to delete resume");
        } finally {
            setIsDeletingResume(false);
        }
    };

    const handleAddSkill = () => {
        if (!newSkill.trim()) {
            toast.error("Please enter a skill");
            return;
        }

        const newSkills = newSkill
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

        if (skillsArray.length + newSkills.length > 15) {
            toast.error("Maximum 15 skills allowed");
            return;
        }

        const updatedSkills = [...skillsArray, ...newSkills];
        setSkillsArray(updatedSkills);
        setStudent((prev) => ({ ...prev, skills: updatedSkills }));
        setNewSkill("");
        toast.success(`Added ${newSkills.length} skill(s)`);
    };

    const handleRemoveSkill = (indexToRemove: number) => {
        const updatedSkills = skillsArray.filter(
            (_, index) => index !== indexToRemove
        );
        setSkillsArray(updatedSkills);
        setStudent((prev) => ({ ...prev, skills: updatedSkills }));
        toast.success("Skill removed");
    };

    const connectGithub = async () => {
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
                // This prevents "Save Changes" from showing since the profile is already saved to backend
                setOriginalStudent((prev) =>
                    prev
                        ? {
                              ...prev,
                              githubUsername: profileData.username,
                              github: profileData,
                          }
                        : null
                );

                toast.success("GitHub profile connected and saved!", {
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

    const disconnectGithub = async () => {
        setIsLoadingGithub(true);
        try {
            // Clear GitHub data from state
            const updatedStudent = {
                ...student,
                githubUsername: "",
                github: null,
            };

            setStudent(updatedStudent);

            // Save to backend
            await apiService.updateStudent(updatedStudent);

            // Update original state
            setOriginalStudent(updatedStudent);

            toast.success("GitHub disconnected successfully!");
        } catch (error) {
            toast.error("Failed to disconnect GitHub");
        } finally {
            setIsLoadingGithub(false);
        }
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: student.devpostUsername }),
            });

            if (!response.ok)
                throw new Error("Failed to fetch Devpost profile");

            const responseData = await response.json();
            if (!responseData.success) {
                throw new Error(
                    responseData.error || "Failed to fetch Devpost profile"
                );
            }

            setStudent((prev) => ({
                ...prev,
                devpost: responseData.data,
                devpostUsername: responseData.data.username,
            }));

            setOriginalStudent((prev) =>
                prev
                    ? {
                          ...prev,
                          devpost: responseData.data,
                          devpostUsername: responseData.data.username,
                      }
                    : null
            );

            toast.success("Devpost profile verified and saved!");
        } catch (error) {
            setDevpostError(
                "Could not load Devpost profile. Please check the username and try again."
            );
            toast.error("Verification failed");
        } finally {
            setIsLoadingDevpost(false);
        }
    };

    const removeDevpostConnection = async () => {
        setIsLoadingDevpost(true);
        try {
            // Clear Devpost data from state
            const updatedStudent = {
                ...student,
                devpostUsername: "",
                devpost: null,
            };

            setStudent(updatedStudent);

            // Save to backend
            await apiService.updateStudent(updatedStudent);

            // Update original state
            setOriginalStudent(updatedStudent);

            toast.success("Devpost connection removed successfully!");
        } catch (error) {
            toast.error("Failed to remove Devpost connection");
        } finally {
            setIsLoadingDevpost(false);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-32 w-full" />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
            {/* Header Card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center gap-6">
                        <img
                            src={
                                student?.github?.avatarUrl ||
                                "https://www.placeholderimage.online/images/generic/users-profile.jpg"
                            }
                            alt="Profile"
                            className="w-24 h-24 rounded-full object-cover border-4 border-gray-100"
                        />
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-gray-900">
                                {student.firstName} {student.lastName}
                            </h1>
                            <p className="text-gray-600 mt-1">
                                {student.email}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary">
                                    {student.school || "Not specified"}
                                </Badge>
                                <Badge variant="secondary">
                                    {student.program || "Not specified"}
                                </Badge>
                            </div>
                        </div>
                        {hasChanges && (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleCancelChanges}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveChanges}
                                    disabled={isSaving}
                                    className="bg-black text-white hover:bg-gray-800"
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
                    </div>

                    {/* Profile Completeness Section */}
                    {profileScore && (
                        <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Profile Completeness:{" "}
                                        {profileScore.score}%
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Students with complete profiles have{" "}
                                        <span className="font-bold text-green-700">
                                            83% higher chance
                                        </span>{" "}
                                        of getting hired!
                                    </p>
                                </div>
                                {profileScore.score === 100 && (
                                    <Badge className="bg-green-600 text-white">
                                        Completed
                                    </Badge>
                                )}
                            </div>
                            <div className="flex gap-1.5 mb-3">
                                {Array.from({ length: 8 }).map((_, index) => {
                                    const completedFields = Object.values(
                                        profileScore.completed
                                    ).filter(Boolean).length;
                                    const isFilled = index < completedFields;
                                    return (
                                        <div
                                            key={index}
                                            className={`flex-1 h-2 rounded-sm transition-all duration-300 ${
                                                isFilled
                                                    ? "bg-green-600"
                                                    : "bg-gray-300"
                                            }`}
                                        />
                                    );
                                })}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div className="flex items-center gap-2 text-sm">
                                    {profileScore.completed.githubUsername ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                    )}
                                    <span
                                        className={
                                            profileScore.completed
                                                .githubUsername
                                                ? "text-green-700"
                                                : "text-gray-500"
                                        }
                                    >
                                        GitHub Username
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    {profileScore.completed.github ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                    )}
                                    <span
                                        className={
                                            profileScore.completed.github
                                                ? "text-green-700"
                                                : "text-gray-500"
                                        }
                                    >
                                        GitHub Profile
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    {profileScore.completed.devpostUsername ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                    )}
                                    <span
                                        className={
                                            profileScore.completed
                                                .devpostUsername
                                                ? "text-green-700"
                                                : "text-gray-500"
                                        }
                                    >
                                        Devpost Username
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    {profileScore.completed.devpost ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                    )}
                                    <span
                                        className={
                                            profileScore.completed.devpost
                                                ? "text-green-700"
                                                : "text-gray-500"
                                        }
                                    >
                                        Devpost Profile
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    {profileScore.completed.linkedinUrl ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                    )}
                                    <span
                                        className={
                                            profileScore.completed.linkedinUrl
                                                ? "text-green-700"
                                                : "text-gray-500"
                                        }
                                    >
                                        LinkedIn
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    {profileScore.completed.portfolioUrl ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                    )}
                                    <span
                                        className={
                                            profileScore.completed.portfolioUrl
                                                ? "text-green-700"
                                                : "text-gray-500"
                                        }
                                    >
                                        Portfolio
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    {profileScore.completed.resume ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                    )}
                                    <span
                                        className={
                                            profileScore.completed.resume
                                                ? "text-green-700"
                                                : "text-gray-500"
                                        }
                                    >
                                        Resume
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    {profileScore.completed.skills ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                    )}
                                    <span
                                        className={
                                            profileScore.completed.skills
                                                ? "text-green-700"
                                                : "text-gray-500"
                                        }
                                    >
                                        Skills
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tabs Section */}
            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger
                        value="profile"
                        className="flex items-center gap-2"
                    >
                        <User className="h-4 w-4" />
                        Profile
                    </TabsTrigger>
                    <TabsTrigger
                        value="education"
                        className="flex items-center gap-2"
                    >
                        <GraduationCap className="h-4 w-4" />
                        Education
                    </TabsTrigger>
                    <TabsTrigger
                        value="professional"
                        className="flex items-center gap-2"
                    >
                        <Code className="h-4 w-4" />
                        Professional
                    </TabsTrigger>
                    <TabsTrigger
                        value="skills"
                        className="flex items-center gap-2"
                    >
                        <FileText className="h-4 w-4" />
                        Skills & Resume
                    </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-4 mt-6">
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="text-xl font-semibold mb-4">
                                Personal Information
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor="firstName">
                                        First Name
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="firstName"
                                            name="firstName"
                                            value={student.firstName || ""}
                                            onChange={handleInputChange}
                                            placeholder="First Name"
                                            disabled={
                                                !isEditing.firstName || isSaving
                                            }
                                        />
                                        {isEditing.firstName ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleDiscardField(
                                                        "firstName"
                                                    )
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleToggleEdit(
                                                        "firstName"
                                                    )
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <PencilLine className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {validationErrors.firstName && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {validationErrors.firstName}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="lastName"
                                            name="lastName"
                                            value={student.lastName || ""}
                                            onChange={handleInputChange}
                                            placeholder="Last Name"
                                            disabled={
                                                !isEditing.lastName || isSaving
                                            }
                                        />
                                        {isEditing.lastName ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleDiscardField(
                                                        "lastName"
                                                    )
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleToggleEdit("lastName")
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <PencilLine className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {validationErrors.lastName && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {validationErrors.lastName}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        value={student.email}
                                        disabled
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="phone"
                                            name="phone"
                                            value={student.phone || ""}
                                            onChange={handleInputChange}
                                            placeholder="+1 (555) 000-0000"
                                            disabled={
                                                !isEditing.phone || isSaving
                                            }
                                        />
                                        {isEditing.phone ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleDiscardField("phone")
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleToggleEdit("phone")
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <PencilLine className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {validationErrors.phone && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {validationErrors.phone}
                                        </p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="location">Location</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="location"
                                            name="location"
                                            value={student.location || ""}
                                            onChange={handleInputChange}
                                            placeholder="City, Country"
                                            disabled={
                                                !isEditing.location || isSaving
                                            }
                                        />
                                        {isEditing.location ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleDiscardField(
                                                        "location"
                                                    )
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleToggleEdit("location")
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <PencilLine className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {validationErrors.location && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {validationErrors.location}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Education Tab */}
                <TabsContent value="education" className="space-y-4 mt-6">
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="text-xl font-semibold mb-4">
                                Educational Background
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <Label htmlFor="school">
                                        University / College
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="school"
                                            name="school"
                                            value={student.school || ""}
                                            onChange={handleInputChange}
                                            placeholder="Harvard University"
                                            disabled={
                                                !isEditing.school || isSaving
                                            }
                                        />
                                        {isEditing.school ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleDiscardField("school")
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleToggleEdit("school")
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <PencilLine className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {validationErrors.school && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {validationErrors.school}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="program">
                                        Major / Program
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="program"
                                            name="program"
                                            value={student.program || ""}
                                            onChange={handleInputChange}
                                            placeholder="Computer Science"
                                            disabled={
                                                !isEditing.program || isSaving
                                            }
                                        />
                                        {isEditing.program ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleDiscardField(
                                                        "program"
                                                    )
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleToggleEdit("program")
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <PencilLine className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {validationErrors.program && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {validationErrors.program}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="graduationYear">
                                        Graduation Year
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="graduationYear"
                                            name="graduationYear"
                                            value={student.graduationYear || ""}
                                            onChange={handleInputChange}
                                            placeholder="2025"
                                            disabled={
                                                !isEditing.graduationYear ||
                                                isSaving
                                            }
                                        />
                                        {isEditing.graduationYear ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleDiscardField(
                                                        "graduationYear"
                                                    )
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleToggleEdit(
                                                        "graduationYear"
                                                    )
                                                }
                                                disabled={isSaving}
                                                className="flex-shrink-0"
                                            >
                                                <PencilLine className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {validationErrors.graduationYear && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {validationErrors.graduationYear}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Professional Tab */}
                <TabsContent value="professional" className="space-y-4 mt-6">
                    {/* LinkedIn & Portfolio */}
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="text-xl font-semibold mb-4">
                                Professional Links
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <Label
                                        htmlFor="linkedinUrl"
                                        className="flex items-center gap-2"
                                    >
                                        <Linkedin className="h-4 w-4 text-blue-600" />
                                        LinkedIn Profile URL
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="linkedinUrl"
                                            name="linkedinUrl"
                                            value={student.linkedinUrl || ""}
                                            onChange={handleInputChange}
                                            placeholder="https://linkedin.com/in/username"
                                            disabled={
                                                !isEditing.linkedinUrl ||
                                                isSaving
                                            }
                                        />
                                        {isEditing.linkedinUrl ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleDiscardField(
                                                        "linkedinUrl"
                                                    )
                                                }
                                                disabled={isSaving}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleToggleEdit(
                                                        "linkedinUrl"
                                                    )
                                                }
                                                disabled={isSaving}
                                            >
                                                <PencilLine className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {validationErrors.linkedinUrl && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {validationErrors.linkedinUrl}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label
                                        htmlFor="portfolioUrl"
                                        className="flex items-center gap-2"
                                    >
                                        <Globe className="h-4 w-4 text-purple-600" />
                                        Portfolio Website
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="portfolioUrl"
                                            name="portfolioUrl"
                                            value={student.portfolioUrl || ""}
                                            onChange={handleInputChange}
                                            placeholder="https://yourwebsite.com"
                                            disabled={
                                                !isEditing.portfolioUrl ||
                                                isSaving
                                            }
                                        />
                                        {isEditing.portfolioUrl ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleDiscardField(
                                                        "portfolioUrl"
                                                    )
                                                }
                                                disabled={isSaving}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleToggleEdit(
                                                        "portfolioUrl"
                                                    )
                                                }
                                                disabled={isSaving}
                                            >
                                                <PencilLine className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {validationErrors.portfolioUrl && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {validationErrors.portfolioUrl}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* GitHub */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <Github className="h-5 w-5" />
                                    GitHub
                                </h2>
                                {student.github ? (
                                    <Button
                                        onClick={disconnectGithub}
                                        variant="destructive"
                                        size="sm"
                                        disabled={isLoadingGithub || isSaving}
                                    >
                                        {isLoadingGithub ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "Disconnect"
                                        )}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={connectGithub}
                                        variant="outline"
                                        size="sm"
                                        disabled={isLoadingGithub || isSaving}
                                    >
                                        {isLoadingGithub ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "Connect GitHub"
                                        )}
                                    </Button>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="githubUsername">
                                    GitHub Username
                                </Label>
                                <Input
                                    id="githubUsername"
                                    name="githubUsername"
                                    value={student.githubUsername || ""}
                                    onChange={handleInputChange}
                                    placeholder="username"
                                    disabled={isSaving}
                                />
                                {githubError && (
                                    <p className="text-sm text-red-600 mt-1">
                                        {githubError}
                                    </p>
                                )}
                            </div>

                            {student.github && (
                                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-start gap-4">
                                        <img
                                            src={student.github.avatarUrl}
                                            alt={student.github.username}
                                            className="w-16 h-16 rounded-full"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-gray-900">
                                                    {student.github.name ||
                                                        student.github.username}
                                                </h4>
                                                <a
                                                    href={`https://github.com/${student.github.username}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-600 hover:text-blue-800"
                                                >
                                                    @{student.github.username}
                                                </a>
                                            </div>
                                            {student.github.bio && (
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {student.github.bio}
                                                </p>
                                            )}
                                            <div className="mt-3 grid grid-cols-4 gap-4 text-center">
                                                <div>
                                                    <p className="text-lg font-semibold text-gray-900">
                                                        {
                                                            student.github
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
                                                            student.github
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
                                                            student.github
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
                                                            student.github
                                                                .contributionCount
                                                        }
                                                    </p>
                                                    <p className="text-xs text-gray-600">
                                                        Contributions (Past 2
                                                        years)
                                                    </p>
                                                </div>
                                            </div>
                                            {student.github.topLanguages
                                                .length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {student.github.topLanguages
                                                        .slice(0, 5)
                                                        .map((lang) => (
                                                            <span
                                                                key={lang}
                                                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                                            >
                                                                {lang}
                                                            </span>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-3">
                                        ✓ Profile connected and saved
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Devpost */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold">
                                    Devpost
                                </h2>
                                {student.devpost ? (
                                    <Button
                                        onClick={removeDevpostConnection}
                                        variant="destructive"
                                        size="sm"
                                        disabled={isLoadingDevpost || isSaving}
                                    >
                                        {isLoadingDevpost ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "Remove Connection"
                                        )}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={fetchDevpostProfile}
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            isLoadingDevpost ||
                                            isSaving ||
                                            !student.devpostUsername
                                        }
                                    >
                                        {isLoadingDevpost ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "Verify Profile"
                                        )}
                                    </Button>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="devpostUsername">
                                    Devpost Username
                                </Label>
                                <Input
                                    id="devpostUsername"
                                    name="devpostUsername"
                                    value={student.devpostUsername || ""}
                                    onChange={handleInputChange}
                                    placeholder="username"
                                    disabled={isSaving}
                                />
                                {devpostError && (
                                    <p className="text-sm text-red-600 mt-1">
                                        {devpostError}
                                    </p>
                                )}
                            </div>

                            {student.devpost && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-gray-900">
                                                {student.devpost.name ||
                                                    student.devpost.username}
                                            </h4>
                                            <p className="text-sm text-gray-600">
                                                @{student.devpost.username}
                                            </p>
                                            <div className="mt-3 grid grid-cols-4 gap-4 text-center">
                                                <div>
                                                    <p className="text-lg font-semibold text-gray-900">
                                                        {
                                                            student.devpost
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
                                                            student.devpost
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
                                                            student.devpost
                                                                .stats.winCount
                                                        }
                                                    </p>
                                                    <p className="text-xs text-gray-600">
                                                        Wins
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-lg font-semibold text-gray-900">
                                                        {student.devpost
                                                            .achievements
                                                            ?.firstPlaceWins ||
                                                            0}
                                                    </p>
                                                    <p className="text-xs text-gray-600">
                                                        1st Places
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-3">
                                        ✓ Profile verified and saved
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Skills & Resume Tab */}
                <TabsContent value="skills" className="space-y-4 mt-6">
                    {/* Skills */}
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="text-xl font-semibold mb-4">
                                Skills
                            </h2>
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        value={newSkill}
                                        onChange={(e) =>
                                            setNewSkill(e.target.value)
                                        }
                                        onKeyPress={(e) =>
                                            e.key === "Enter" &&
                                            handleAddSkill()
                                        }
                                        placeholder="Add a skill (e.g., React, Python)"
                                        maxLength={50}
                                        disabled={skillsArray.length >= 15}
                                    />
                                    <Button
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
                                <p className="text-xs text-gray-500">
                                    {skillsArray.length >= 15
                                        ? "Maximum skills reached"
                                        : `${
                                              15 - skillsArray.length
                                          } more skill(s) can be added`}
                                </p>
                                {skillsArray.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {skillsArray.map((skill, index) => (
                                            <Badge
                                                key={index}
                                                variant="secondary"
                                                className="px-3 py-1.5"
                                            >
                                                {skill}
                                                <button
                                                    onClick={() =>
                                                        handleRemoveSkill(index)
                                                    }
                                                    className="ml-2 hover:text-red-600 cursor-pointer"
                                                >
                                                    ×
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                                        <p className="text-sm text-gray-500">
                                            No skills added yet. Add your first
                                            skill above!
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Resume */}
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="text-xl font-semibold mb-4">
                                Resume
                            </h2>
                            {student.resume?.name ? (
                                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Upload className="h-5 w-5 text-green-600" />
                                        <div>
                                            <p className="font-medium">
                                                {student.resume.name}.pdf
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Uploaded{" "}
                                                {new Date(
                                                    student.resume.uploadedAt
                                                        ._seconds * 1000
                                                ).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {student.resume.url && (
                                            <a
                                                href={student.resume.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-green-700 hover:underline"
                                            >
                                                View
                                            </a>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleDeleteResume}
                                            disabled={isDeletingResume}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            {isDeletingResume ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                "Delete"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                    <p className="text-sm text-gray-500">
                                        No resume uploaded yet.
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Input
                                    id="resume"
                                    type="file"
                                    accept="application/pdf"
                                    onChange={handleResumeChange}
                                    className="cursor-pointer"
                                />
                                <Button
                                    className="bg-black text-white hover:bg-gray-800"
                                    disabled={!resumeFile || isUploadingResume}
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
                                <p className="mt-2 text-sm text-gray-500">
                                    Ready to upload:{" "}
                                    <strong>{resumeFile.name}</strong>
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
