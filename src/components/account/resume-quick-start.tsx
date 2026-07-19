import { useState } from "react";
import { ArrowRight, CheckCircle2, FileUp, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  updateProfileFields,
  type SkillEntry,
  type StudentProfile,
} from "@/lib/profile";
import {
  parseResume,
  isEmptyParse,
  ResumeParseError,
  type ParsedResume,
} from "@/lib/resume-parse";
import { ResumeParseReview } from "./resume-parse-review";

/**
 * Resume-drop "fast start" entry point (spec 08 §3.1).
 *
 * Surfaces the EXISTING resume upload prominently as the quick way to get
 * going, and — once a resume is uploaded — offers LLM-based "pre-fill from my
 * resume" (spec 08 Open-Q1). Parsing returns SUGGESTIONS only: the student
 * reviews, edits, and confirms them in {@link ResumeParseReview}, and only then
 * are the chosen items MERGED (appended, never overwriting) into the profile
 * via the shared `PATCH /profile/update` path. The actual PDF upload still
 * lives in the "Skills & Resume" tab (`handleResumeUpload` →
 * `PATCH /profile/main-resume`); this banner just deep-links there.
 *
 * If parsing isn't configured server-side (no `ANTHROPIC_API_KEY`, e.g. dev),
 * the pre-fill action degrades gracefully to a friendly message and the manual
 * editors below stay fully functional.
 */

interface ResumeQuickStartProps {
  hasResume: boolean;
  profile: StudentProfile;
  onGoToResumeUpload: () => void;
  onMerged: (patch: Partial<StudentProfile>) => void;
}

export function ResumeQuickStart({
  hasResume,
  profile,
  onGoToResumeUpload,
  onMerged,
}: ResumeQuickStartProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedResume | null>(null);

  const handlePrefill = async () => {
    setIsParsing(true);
    try {
      const result = await parseResume();
      if (isEmptyParse(result)) {
        toast.info(
          "We couldn't pull structured details from your resume — you can add them manually below.",
        );
        return;
      }
      setParsed(result);
      setReviewOpen(true);
    } catch (error) {
      if (error instanceof ResumeParseError && error.code === "unavailable") {
        toast.info(
          "Resume parsing isn't available right now — you can fill in your details manually below.",
        );
      } else if (
        error instanceof ResumeParseError &&
        error.code === "no_resume"
      ) {
        toast.error("Upload a resume first, then try pre-filling from it.");
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "We couldn't read your resume automatically.",
        );
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async (selection: ParsedResume) => {
    // Merge chosen suggestions into the profile — APPEND to existing arrays,
    // never overwrite. Skills dedupe by name (case-insensitive) against what's
    // already there.
    const patch: Partial<StudentProfile> = {};

    if (selection.experiences.length > 0) {
      patch.experiences = [
        ...(profile.experiences ?? []),
        ...selection.experiences,
      ];
    }
    if (selection.education.length > 0) {
      patch.education = [...(profile.education ?? []), ...selection.education];
    }
    if (selection.projects.length > 0) {
      patch.projects = [...(profile.projects ?? []), ...selection.projects];
    }

    let mergedSkills: SkillEntry[] | null = null;
    if (selection.skills.length > 0) {
      const existing = profile.skillsStructured ?? [];
      const seen = new Set(existing.map((s) => s.name.toLowerCase()));
      const additions = selection.skills.filter((s) => {
        const key = s.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (additions.length > 0) {
        mergedSkills = [...existing, ...additions];
        patch.skillsStructured = mergedSkills;
      }
    }

    if (Object.keys(patch).length === 0) {
      toast.info("Those items are already on your profile.");
      setReviewOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateProfileFields(patch);

      // Sync local state. The backend mirrors skill names into the flat
      // `skills[]`; reflect that here too so the legacy Skills card updates.
      const localPatch: Partial<StudentProfile> = { ...patch };
      if (mergedSkills) {
        localPatch.skills = mergedSkills.map((s) => s.name);
      }
      onMerged(localPatch);

      toast.success("Added to your profile — review and tweak anytime below.");
      setReviewOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save suggestions",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="border-brand-orange/30 bg-brand-orange/5">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-white/70 p-2">
                {hasResume ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <FileUp className="h-6 w-6 text-brand-orange" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {hasResume ? "Resume uploaded" : "Have a resume?"}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {hasResume
                    ? "Pre-fill your profile from it in one click, or fill in the details below yourself. You review everything before it's saved."
                    : "Upload it to get started, then pre-fill your profile from it. Everything is optional — add what you have, come back for the rest."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              {hasResume && (
                <Button
                  onClick={handlePrefill}
                  disabled={isParsing}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Reading your resume…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      Pre-fill from my resume
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={onGoToResumeUpload}
                variant="outline"
                className="shrink-0"
              >
                {hasResume ? "Replace resume" : "Upload resume"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {parsed && (
        <ResumeParseReview
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          parsed={parsed}
          onConfirm={handleConfirm}
          isSaving={isSaving}
        />
      )}
    </>
  );
}
