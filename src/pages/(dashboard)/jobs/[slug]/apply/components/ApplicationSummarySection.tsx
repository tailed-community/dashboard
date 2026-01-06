import React from "react";
import { CheckCircle, AlertCircle, Sparkles, ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { type GithubProfile } from "@/lib/github";
import {
    type TokenInfo,
    type DevpostProfile,
    type ApplicationFormData,
} from "../types";
import { HTMLContent } from "@/components/ui/html-content";

interface ApplicationSummarySectionProps {
    formData: ApplicationFormData;
    tokenInfo: TokenInfo;
    githubProfile: GithubProfile | null;
    devpostProfile: DevpostProfile | null;
    onNavigateToCoverLetter?: () => void;
}

export default function ApplicationSummarySection({
    formData,
    tokenInfo,
    githubProfile,
    devpostProfile,
    onNavigateToCoverLetter,
}: ApplicationSummarySectionProps) {
    const hasCoverLetter =
        formData.coverLetter && formData.coverLetter.trim().length > 0;

    return (
        <div className="space-y-6">
            {/* Alert Banner for Missing Cover Letter */}
            {!hasCoverLetter && (
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                    <Sparkles className="h-5 w-5 text-amber-600" />
                    <AlertTitle className="text-amber-900 dark:text-amber-100 font-semibold">
                        Boost Your Application with a Cover Letter!
                    </AlertTitle>
                    <AlertDescription className="text-amber-800 dark:text-amber-200 mt-2">
                        <p className="mb-3">
                            Applicants who include a cover letter have
                            significantly higher chances of getting hired. It
                            doesn't have to be long—just a brief introduction
                            about what you do, why you're interested in this
                            role, and what makes you a good fit!
                        </p>
                        {onNavigateToCoverLetter && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onNavigateToCoverLetter}
                                className="border-amber-600 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/20"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Add Cover Letter
                            </Button>
                        )}
                    </AlertDescription>
                </Alert>
            )}
            {tokenInfo.job.description && (
                <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-medium mb-2">Job Description</h3>
                    <p className="text-sm whitespace-pre-line">
                        <HTMLContent
                            content={
                                tokenInfo.job.description ||
                                "<p>No description provided.</p>"
                            }
                            className="text-md"
                        />
                    </p>
                </div>
            )}

            <div className="rounded-lg border p-4">
                <h3 className="font-medium mb-2">Application Summary</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">
                            Personal Information
                        </span>
                        <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Complete
                        </span>
                    </div>
                    <Separator />

                    <div className="flex justify-between">
                        <span className="text-muted-foreground">
                            GitHub Profile
                        </span>
                        {githubProfile ? (
                            <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                Linked
                            </span>
                        ) : (
                            <span className="text-amber-500">Not linked</span>
                        )}
                    </div>
                    <Separator />

                    <div className="flex justify-between">
                        <span className="text-muted-foreground">
                            Hackathon History
                        </span>
                        {devpostProfile ? (
                            <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                Imported
                            </span>
                        ) : (
                            <span className="text-amber-500">Not imported</span>
                        )}
                    </div>
                    <Separator />

                    <div
                        className={`flex justify-between items-center p-2 -mx-2 rounded-md transition-colors ${
                            !hasCoverLetter
                                ? "bg-amber-50 dark:bg-amber-950/10"
                                : ""
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                                Cover Letter
                            </span>
                            {!hasCoverLetter && (
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                        </div>
                        {hasCoverLetter ? (
                            <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                Added
                            </span>
                        ) : (
                            <span className="text-amber-600 font-medium">
                                Missing
                            </span>
                        )}
                    </div>
                    <Separator />

                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Resume</span>
                        {formData.resume ? (
                            <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                Uploaded
                            </span>
                        ) : (
                            <span className="text-red-500">Required</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
