import type React from "react";
import { useState, useEffect } from "react";
import { Upload, Loader2, PencilLine, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";
import { Skeleton } from "@/components/ui/skeleton";

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
    linkedinUrl: string;
    githubUsername: string;
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
        devpostUsername: "",
        githubUsername: "",
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
        devpostUsername: false,
        githubUsername: false,
    });

    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [isUploadingResume, setIsUploadingResume] = useState(false);

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

    // Check if there are any changes
    useEffect(() => {
        if (!originalStudent) return;

        const changed =
            student.phone !== originalStudent.phone ||
            student.school !== originalStudent.school ||
            student.program !== originalStudent.program ||
            student.graduationYear !== originalStudent.graduationYear ||
            student.linkedinUrl !== originalStudent.linkedinUrl ||
            student.devpostUsername !== originalStudent.devpostUsername ||
            student.githubUsername !== originalStudent.githubUsername;

        setHasChanges(changed);
    }, [student, originalStudent]);

    const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setStudent((prev) => ({ ...prev, [name]: value }));
    };

    const handleToggleEdit = (field: keyof typeof isEditing) => {
        setIsEditing((prev) => ({ ...prev, [field]: !prev[field] }));
    };

    const handleDiscardField = (field: keyof typeof isEditing) => {
        if (originalStudent) {
            setStudent((prev) => ({
                ...prev,
                [field]: originalStudent[field as keyof StudentProps],
            }));
            setIsEditing((prev) => ({ ...prev, [field]: false }));
        }
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        // Validate all fields before saving

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
            // Create a trimmed copy of the student data
            const trimmedStudentData: StudentProps = {
                ...student,
                phone: student.phone?.trim() || "",
                school: student.school?.trim() || "",
                program: student.program?.trim() || "",
                graduationYear: student.graduationYear?.trim() || "",
                linkedinUrl: student.linkedinUrl?.trim() || "",
                devpostUsername: student.devpostUsername?.trim() || "",
                githubUsername: student.githubUsername?.trim() || "",
            };

            // Send trimmed data to backend
            await apiService.updateStudent(trimmedStudentData);

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

            const orgArray: string[] = [];

            if (!student?.organizations || student.organizations.length === 0) {
                student.appliedJobs.forEach((job: any) => {
                    orgArray.push(job.orgId);
                });
            } else {
                orgArray.push(...student.organizations);
            }

            if (orgArray?.length > 0) {
                const responseData = await response.json();
                const body = {
                    resume: responseData.resume,
                    organizations: orgArray,
                };
                try {
                    let endpoint = `/public/update-resume/${student!.id}`;

                    const response2 = await apiFetch(
                        endpoint,
                        {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body),
                        },
                        true
                    );
                    if (!response2.ok)
                        throw new Error("Failed to add resume to candidate");
                } catch (error) {
                    console.error("Error adding resume to candidate:", error);
                    toast.error("Error adding resume to candidate", {
                        description: "Please try again later.",
                    });
                }
            }
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
                    <div className="relative my-3 border-b-3 pb-4">
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
                    <h2 className="text-lg font-semibold text-gray-800">
                        Personal Information
                    </h2>
                    <p className="text-sm text-gray-500">
                        Edit your profiles information.
                    </p>
                </CardHeader>
                <CardContent>
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
                                            onChange={handleStudentChange}
                                            placeholder="Phone Number"
                                            className="w-full"
                                            disabled={
                                                !isEditing.phone || isSaving
                                            }
                                        />
                                        {isEditing.phone ? (
                                            <button
                                                onClick={() =>
                                                    handleDiscardField("phone")
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
                                                    handleToggleEdit("phone")
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
                                            onChange={handleStudentChange}
                                            placeholder="University/College"
                                            className="w-full"
                                            disabled={
                                                !isEditing.school || isSaving
                                            }
                                        />
                                        {isEditing.school ? (
                                            <button
                                                onClick={() =>
                                                    handleDiscardField("school")
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
                                                    handleToggleEdit("school")
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
                                            onChange={handleStudentChange}
                                            placeholder="Major/Program"
                                            className="w-full"
                                            disabled={
                                                !isEditing.program || isSaving
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
                                                    handleToggleEdit("program")
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
                                            value={student.graduationYear}
                                            onChange={handleStudentChange}
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
                </CardContent>

                <CardHeader className="pb-3">
                    <h2 className="text-lg font-semibold text-gray-800">
                        Connections
                    </h2>
                    <p className="text-sm text-gray-500">
                        Link your external accounts and profiles.
                    </p>
                </CardHeader>
                <CardContent>
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
                                    value={student.linkedinUrl || ""}
                                    onChange={handleStudentChange}
                                    placeholder="https://linkedin.com/in/username"
                                    className="w-full border-gray-300 focus:ring-black focus:border-black"
                                    disabled={
                                        !isEditing.linkedinUrl || isSaving
                                    }
                                />
                                {isEditing.linkedinUrl ? (
                                    <button
                                        onClick={() =>
                                            handleDiscardField("linkedinUrl")
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
                                            handleToggleEdit("linkedinUrl")
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
                                    value={student.devpostUsername || ""}
                                    onChange={handleStudentChange}
                                    placeholder="Devpost Username"
                                    className="w-full border-gray-300 focus:ring-black focus:border-black"
                                    disabled={
                                        !isEditing.devpostUsername || isSaving
                                    }
                                />
                                {isEditing.devpostUsername ? (
                                    <button
                                        onClick={() =>
                                            handleDiscardField(
                                                "devpostUsername"
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
                                            handleToggleEdit("devpostUsername")
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
                                htmlFor="githubUsername"
                                className="block text-sm font-medium text-gray-700 mb-1"
                            >
                                GitHub Username
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="githubUsername"
                                    name="githubUsername"
                                    value={student.githubUsername || ""}
                                    onChange={handleStudentChange}
                                    placeholder="GitHub Username"
                                    className="w-full border-gray-300 focus:ring-black focus:border-black"
                                    disabled={
                                        !isEditing.githubUsername || isSaving
                                    }
                                />
                                {isEditing.githubUsername ? (
                                    <button
                                        onClick={() =>
                                            handleDiscardField("githubUsername")
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
                                            handleToggleEdit("githubUsername")
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

                        <div className="mt-4">
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
                                                    {student.resume.name}.pdf
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
                                <p className="mt-1 text-sm text-gray-500">
                                    Ready to upload:{" "}
                                    <span className="font-medium">
                                        {resumeFile.name}
                                    </span>
                                </p>
                            )}
                            {hasChanges && (
                                <div className="flex gap-3 justify-end pt-4 border-t mt-14">
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
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
