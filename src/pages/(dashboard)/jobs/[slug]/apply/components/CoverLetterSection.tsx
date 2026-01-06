import React from "react";
import { CheckCircle, Sparkles, Lightbulb } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type ApplicationFormData } from "../types";

interface CoverLetterSectionProps {
    formData: ApplicationFormData;
    handleInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
}

export default function CoverLetterSection({
    formData,
    handleInputChange,
}: CoverLetterSectionProps) {
    return (
        <div className="space-y-6">
            {/* Cover Letter Section - Enhanced */}
            <div className="border rounded-lg p-6 bg-gradient-to-br from-background to-muted/20">
                <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                        <Label
                            htmlFor="coverLetter"
                            className="text-lg font-semibold"
                        >
                            Tell Your Story
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                            Why are you interested in this role?
                        </p>
                    </div>
                </div>

                {/* Motivational Tip */}
                <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex gap-3">
                    <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium text-primary mb-1">
                            💡 Pro Tip: Make Your Application Stand Out
                        </p>
                        <p className="text-muted-foreground">
                            A thoughtful response here significantly increases
                            your chances of getting hired. Share your genuine
                            interest, relevant experience, and what unique value
                            you bring to the role.
                        </p>
                    </div>
                </div>

                <Textarea
                    id="coverLetter"
                    name="coverLetter"
                    value={formData.coverLetter}
                    onChange={handleInputChange}
                    className="min-h-[180px] resize-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="Example: I'm excited about this role because... I have experience with... What makes me a great fit is..."
                    required
                />
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <span className="font-medium">
                        {formData.coverLetter.length}
                    </span>{" "}
                    characters
                    {formData.coverLetter.length < 100 && (
                        <span className="text-amber-500 ml-2">
                            • Aim for at least 100 characters for a compelling
                            response
                        </span>
                    )}
                    {formData.coverLetter.length >= 100 &&
                        formData.coverLetter.length < 300 && (
                            <span className="text-blue-500 ml-2">
                                • Good start! Consider adding more details
                            </span>
                        )}
                    {formData.coverLetter.length >= 300 && (
                        <span className="text-green-600 ml-2 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Excellent detail!
                        </span>
                    )}
                </p>
            </div>
        </div>
    );
}
