import React from "react";
import { CheckCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { type GithubProfile } from "@/lib/github";
import { type TokenInfo, type DevpostProfile } from "../types";

interface JobDetailsSectionProps {
  formData: FormData;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  tokenInfo: TokenInfo;
  githubProfile: GithubProfile | null;
  devpostProfile: DevpostProfile | null;
}

export default function JobDetailsSection({
  formData,
  handleInputChange,
  tokenInfo,
  githubProfile,
  devpostProfile,
}: JobDetailsSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="coverLetter">
          Why are you interested in this role?
        </Label>
        <Textarea
          id="coverLetter"
          name="coverLetter"
          value={formData.coverLetter}
          onChange={handleInputChange}
          className="mt-2 min-h-[150px]"
          placeholder="Tell us why you're interested in this position and why you would be a good fit..."
          required
        />
      </div>
      {tokenInfo.job.description && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h3 className="font-medium mb-2">Job Description</h3>
          <p className="text-sm whitespace-pre-line">
            {tokenInfo.job.description}
          </p>
        </div>
      )}

      <div className="rounded-lg border p-4">
        <h3 className="font-medium mb-2">Application Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Personal Information</span>
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Complete
            </span>
          </div>
          <Separator />

          <div className="flex justify-between">
            <span className="text-muted-foreground">GitHub Profile</span>
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
            <span className="text-muted-foreground">Hackathon History</span>
            {devpostProfile ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                Imported
              </span>
            ) : (
              <span className="text-amber-500">Not imported</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
