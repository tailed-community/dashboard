import type React from "react";
import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, Sparkles, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  updateProfileFields,
  type SkillEntry,
  type StudentProfile,
} from "@/lib/profile";
import {
  parseResume,
  isEmptyParse,
  prepareResumeFile,
  uploadResume,
  ResumeParseError,
  type ParsedResume,
} from "@/lib/resume-parse";
import { ResumeParseReview } from "./resume-parse-review";

/**
 * Resume-drop "fast start" entry point (spec 08 §3.1).
 *
 * One click (or one drag-and-drop) does the whole job: pick a PDF, upload it
 * (`PATCH /profile/main-resume`), then immediately parse it
 * (`POST /profile/parse-resume` — deterministic, offline text extraction on
 * the server, no LLM involved) and open {@link ResumeParseReview} so the
 * student can confirm what gets added. Parsing only ever returns
 * SUGGESTIONS for experience, education, projects and skills — the student
 * reviews, edits, and confirms them, and only then are the chosen items
 * MERGED (appended, never overwriting) into the profile via the shared
 * `PATCH /profile/update` path.
 *
 * If the upload succeeds but parsing fails, the resume stays uploaded — the
 * student just gets told to fill in the rest manually below.
 */

type Stage = "idle" | "uploading" | "parsing";

interface ResumeQuickStartProps {
  hasResume: boolean;
  profile: StudentProfile;
  /** Re-fetches the full student/profile state after a successful upload
   *  (same refresh the manual "Skills & Resume" upload does). */
  onUploaded: () => Promise<void> | void;
  onMerged: (patch: Partial<StudentProfile>) => void;
}

export function ResumeQuickStart({
  hasResume,
  profile,
  onUploaded,
  onMerged,
}: ResumeQuickStartProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedResume | null>(null);

  const busy = stage !== "idle";

  /** Re-parse an already-uploaded resume — no file picker involved. */
  const runPrefill = async () => {
    setIsPrefilling(true);
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
      if (error instanceof ResumeParseError && error.code === "no_resume") {
        toast.error("Upload a resume first, then try pre-filling from it.");
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "We couldn't read your resume automatically.",
        );
      }
    } finally {
      setIsPrefilling(false);
    }
  };

  // The one-click pipeline: pick/drop a file → upload it → parse it → open
  // the review dialog, with no intermediate clicks required.
  const runPipeline = async (file: File) => {
    const prepared = prepareResumeFile(file);
    if ("error" in prepared) {
      toast.error(prepared.error);
      return;
    }

    setStage("uploading");
    try {
      await uploadResume(prepared.file);
      await onUploaded();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't upload your resume. Please try again.",
      );
      setStage("idle");
      return;
    }

    setStage("parsing");
    try {
      const result = await parseResume();
      if (isEmptyParse(result)) {
        toast.success("Resume uploaded!");
        toast.info(
          "We couldn't pull structured details from it — you can add them manually below.",
        );
        return;
      }
      setParsed(result);
      setReviewOpen(true);
    } catch {
      // The resume itself uploaded fine — only the parse step failed. Say so.
      toast.success("Resume uploaded!");
      toast.error(
        "We couldn't read it automatically, but it's saved to your profile — add your details manually below.",
      );
    } finally {
      setStage("idle");
    }
  };

  const handleFileSelected = (file: File | null | undefined) => {
    if (!file || busy) return;
    void runPipeline(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelected(e.target.files?.[0]);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
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
    handleFileSelected(e.dataTransfer.files?.[0]);
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

  const stageLabel =
    stage === "uploading"
      ? "Uploading…"
      : stage === "parsing"
        ? "Reading your resume…"
        : null;
  const stageProgress =
    stage === "uploading" ? 33 : stage === "parsing" ? 75 : 0;

  return (
    <>
      <Card
        className={`border-brand-orange/30 bg-brand-orange/5 transition-shadow ${
          isDragging ? "ring-2 ring-brand-orange" : ""
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
                    ? "Pre-fill your experience, education, projects and skills from it in one click, or fill them in below yourself. You review everything before it's saved."
                    : "Drop it here, or click to upload — we'll pre-fill your experience, education, projects and skills from it. Everything is optional — add what you have, come back for the rest."}
                </p>
                {stageLabel && (
                  <div className="mt-3 max-w-[16rem] space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-orange" />
                      {stageLabel}
                    </div>
                    <Progress value={stageProgress} className="h-1.5" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              {hasResume && (
                <Button
                  onClick={runPrefill}
                  disabled={isPrefilling || busy}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  {isPrefilling ? (
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
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                variant={hasResume ? "outline" : undefined}
                className={
                  hasResume
                    ? "shrink-0"
                    : "shrink-0 bg-black text-white hover:bg-gray-800"
                }
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" />
                )}
                {hasResume ? "Replace resume" : "Upload resume"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleInputChange}
              />
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
