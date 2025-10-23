import React, { useState, useRef } from "react";
import { FileText, Upload, CheckCircle, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ResumeSectionProps {
    formData: {
        resume:
            | {
                  id: string;
                  name: string;
                  url: string;
                  uploadedAt: {
                      _seconds: number;
                      _nanoseconds: number;
                  };
              }
            | File
            | null;
    };
    profileResume: {
        id: string;
        name: string;
        url: string;
        uploadedAt: string;
    } | null;
    onResumeChange: (
        resume:
            | {
                  id: string;
                  name: string;
                  url: string;
                  uploadedAt: {
                      _seconds: number;
                      _nanoseconds: number;
                  };
              }
            | File
            | null
    ) => void;
}

type ResumeSource = "profile" | "upload";

export default function ResumeSection({
    formData,
    profileResume,
    onResumeChange,
}: ResumeSectionProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Determine initial source based on resume data
    const getInitialSource = (): ResumeSource => {
        if (!formData.resume) return "upload";
        if (formData.resume instanceof File) return "upload";
        if (profileResume && formData.resume.id === profileResume.id)
            return "profile";
        return "upload";
    };

    const [resumeSource, setResumeSource] = useState<ResumeSource>(
        getInitialSource()
    );
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const validateAndStoreFile = (file: File) => {
        // Validate file type - PDF only
        if (file.type !== "application/pdf") {
            setUploadError("Please upload a PDF document only");
            return false;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            setUploadError("File size must be less than 5MB");
            return false;
        }

        setUploadError(null);
        // Just store the File object - no upload
        onResumeChange(file);
        return true;
    };

    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;
        validateAndStoreFile(file);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            validateAndStoreFile(files[0]);
        }
    };

    const handleResumeSourceChange = (value: ResumeSource) => {
        setResumeSource(value);
        setUploadError(null);

        if (value === "profile" && profileResume) {
            // Convert the profile resume format to the form format
            const uploadedDate = new Date(profileResume.uploadedAt);
            const seconds = Math.floor(uploadedDate.getTime() / 1000);
            const nanoseconds = (uploadedDate.getTime() % 1000) * 1000000;

            onResumeChange({
                id: profileResume.id,
                name: profileResume.name,
                url: profileResume.url,
                uploadedAt: {
                    _seconds: seconds,
                    _nanoseconds: nanoseconds,
                },
            });
        } else if (value === "upload") {
            // Clear the resume if switching to upload
            onResumeChange(null);
        }
    };

    const handleRemoveResume = () => {
        onResumeChange(null);
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const formatDate = (
        uploadedAt: { _seconds: number; _nanoseconds: number } | string
    ) => {
        if (typeof uploadedAt === "string") {
            return new Date(uploadedAt).toLocaleDateString();
        }
        return new Date(uploadedAt._seconds * 1000).toLocaleDateString();
    };

    return (
        <div className="space-y-6">
            <div>
                <Label className="text-base font-semibold">Resume *</Label>
                <p className="text-sm text-muted-foreground mt-1">
                    Choose to upload a new resume or use your existing profile
                    resume (PDF only)
                </p>
            </div>

            <RadioGroup
                value={resumeSource}
                onValueChange={handleResumeSourceChange}
                className="space-y-4"
            >
                {/* Use Profile Resume Option */}
                {profileResume && (
                    <label
                        htmlFor="profile"
                        className={`cursor-pointer transition-all rounded-lg border block ${
                            resumeSource === "profile"
                                ? "border-primary ring-2 ring-primary ring-offset-2"
                                : "hover:border-primary/50"
                        }`}
                    >
                        <div className="p-4">
                            <div className="flex items-start space-x-3">
                                <RadioGroupItem
                                    value="profile"
                                    id="profile"
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="font-medium cursor-pointer">
                                        Use my profile resume
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                                        <FileText className="h-4 w-4" />
                                        <span>{profileResume.name}</span>
                                        <span>•</span>
                                        <span>
                                            Uploaded{" "}
                                            {formatDate(
                                                profileResume.uploadedAt
                                            )}
                                        </span>
                                    </div>
                                    {resumeSource === "profile" && (
                                        <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                                            <CheckCircle className="h-4 w-4" />
                                            <span>Selected</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </label>
                )}

                {/* Upload New Resume Option */}
                <div
                    className={`transition-all rounded-lg border ${
                        resumeSource === "upload"
                            ? "border-primary ring-2 ring-primary ring-offset-2"
                            : "hover:border-primary/50"
                    }`}
                >
                    <div className="p-4">
                        <label
                            htmlFor="upload"
                            className="flex items-start space-x-3 cursor-pointer"
                        >
                            <RadioGroupItem
                                value="upload"
                                id="upload"
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <div className="font-medium cursor-pointer">
                                    Upload a new resume
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    PDF document only (max 5MB)
                                </p>
                            </div>
                        </label>

                        {resumeSource === "upload" && (
                            <div className="mt-4 space-y-3 ml-8">
                                {formData.resume &&
                                formData.resume instanceof File ? (
                                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-primary" />
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {formData.resume.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {(
                                                        formData.resume.size /
                                                        1024 /
                                                        1024
                                                    ).toFixed(2)}{" "}
                                                    MB
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleRemoveResume();
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div
                                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                                            isDragging
                                                ? "border-primary bg-primary/5"
                                                : "hover:border-primary/50"
                                        }`}
                                        onClick={() => {
                                            fileInputRef.current?.click();
                                        }}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragEnter}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm font-medium text-primary">
                                            Click to upload
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            or drag and drop
                                        </p>
                                        <input
                                            ref={fileInputRef}
                                            id="resume-upload"
                                            type="file"
                                            accept=".pdf"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </RadioGroup>

            {uploadError && (
                <Alert variant="destructive">
                    <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
            )}

            {!profileResume && (
                <Alert>
                    <AlertDescription>
                        You don't have a resume saved in your profile. You'll
                        need to upload a PDF for this application.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
