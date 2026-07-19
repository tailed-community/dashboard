import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRange } from "./profile-builder-shared";
import type { ParsedResume } from "@/lib/resume-parse";

/**
 * Review + confirm dialog for parsed resume suggestions (spec 08 §3.1 / Open-Q1).
 *
 * Parsing is a SUGGESTION — the student owns the truth. Every item can be
 * accepted (checkbox), edited (its identifying fields inline), or discarded
 * (unchecked). On confirm, only the checked items — with edits applied — are
 * handed back to the caller, which merges them into the profile (appending,
 * never overwriting existing entries).
 */

interface ResumeParseReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsed: ParsedResume;
  onConfirm: (selection: ParsedResume) => void;
  isSaving: boolean;
}

export function ResumeParseReview({
  open,
  onOpenChange,
  parsed,
  onConfirm,
  isSaving,
}: ResumeParseReviewProps) {
  const [experiences, setExperiences] = useState<ParsedResume["experiences"]>([]);
  const [education, setEducation] = useState<ParsedResume["education"]>([]);
  const [projects, setProjects] = useState<ParsedResume["projects"]>([]);
  const [skills, setSkills] = useState<ParsedResume["skills"]>([]);
  const [included, setIncluded] = useState<Record<string, boolean>>({});

  // Reset editable copies + include-all whenever a fresh parse opens.
  useEffect(() => {
    if (!open) return;
    setExperiences(parsed.experiences.map((e) => ({ ...e })));
    setEducation(parsed.education.map((e) => ({ ...e })));
    setProjects(parsed.projects.map((p) => ({ ...p })));
    setSkills(parsed.skills.map((s) => ({ ...s })));

    const next: Record<string, boolean> = {};
    parsed.experiences.forEach((e) => (next[`exp:${e.id}`] = true));
    parsed.education.forEach((e) => (next[`edu:${e.id}`] = true));
    parsed.projects.forEach((p) => (next[`proj:${p.id}`] = true));
    parsed.skills.forEach((_, i) => (next[`skill:${i}`] = true));
    setIncluded(next);
  }, [open, parsed]);

  const toggle = (key: string, value: boolean) =>
    setIncluded((prev) => ({ ...prev, [key]: value }));

  const selectedCount =
    experiences.filter((e) => included[`exp:${e.id}`]).length +
    education.filter((e) => included[`edu:${e.id}`]).length +
    projects.filter((p) => included[`proj:${p.id}`]).length +
    skills.filter((_, i) => included[`skill:${i}`]).length;

  const totalCount =
    parsed.experiences.length +
    parsed.education.length +
    parsed.projects.length +
    parsed.skills.length;

  const handleConfirm = () => {
    onConfirm({
      experiences: experiences.filter((e) => included[`exp:${e.id}`]),
      education: education.filter((e) => included[`edu:${e.id}`]),
      projects: projects.filter((p) => included[`proj:${p.id}`]),
      skills: skills.filter((_, i) => included[`skill:${i}`]),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-orange" />
            Review what we found
          </DialogTitle>
          <DialogDescription>
            We read your resume — nothing is saved yet. Uncheck anything you
            don't want, tweak the details, then add the rest to your profile.
            You can keep editing everything afterwards.
          </DialogDescription>
        </DialogHeader>

        {totalCount === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            We couldn't pull structured details from your resume. You can fill in
            your experience, education, projects and skills manually below.
          </p>
        ) : (
          <ScrollArea className="max-h-[55vh] pr-4">
            <div className="space-y-6">
              {experiences.length > 0 && (
                <Section title="Experience">
                  {experiences.map((item, index) => {
                    const key = `exp:${item.id}`;
                    return (
                      <ReviewRow
                        key={item.id}
                        checked={!!included[key]}
                        onCheckedChange={(v) => toggle(key, v)}
                        meta={[
                          item.employmentType
                            ? item.employmentType.replace("-", " ")
                            : "",
                          formatRange(
                            item.startDate,
                            item.endDate,
                            item.current,
                          ),
                          item.location ?? "",
                        ]}
                      >
                        <FieldPair>
                          <Field label="Title">
                            <Input
                              value={item.title}
                              onChange={(e) =>
                                setExperiences((prev) =>
                                  prev.map((it, i) =>
                                    i === index
                                      ? { ...it, title: e.target.value }
                                      : it,
                                  ),
                                )
                              }
                            />
                          </Field>
                          <Field label="Organization">
                            <Input
                              value={item.organization}
                              onChange={(e) =>
                                setExperiences((prev) =>
                                  prev.map((it, i) =>
                                    i === index
                                      ? { ...it, organization: e.target.value }
                                      : it,
                                  ),
                                )
                              }
                            />
                          </Field>
                        </FieldPair>
                        {item.description && (
                          <p className="mt-2 line-clamp-3 text-xs text-gray-500">
                            {item.description}
                          </p>
                        )}
                      </ReviewRow>
                    );
                  })}
                </Section>
              )}

              {education.length > 0 && (
                <Section title="Education">
                  {education.map((item, index) => {
                    const key = `edu:${item.id}`;
                    return (
                      <ReviewRow
                        key={item.id}
                        checked={!!included[key]}
                        onCheckedChange={(v) => toggle(key, v)}
                        meta={[
                          item.fieldOfStudy ?? "",
                          item.graduationYear
                            ? `Grad ${item.graduationYear}`
                            : "",
                        ]}
                      >
                        <FieldPair>
                          <Field label="School">
                            <Input
                              value={item.school}
                              onChange={(e) =>
                                setEducation((prev) =>
                                  prev.map((it, i) =>
                                    i === index
                                      ? { ...it, school: e.target.value }
                                      : it,
                                  ),
                                )
                              }
                            />
                          </Field>
                          <Field label="Program">
                            <Input
                              value={item.program}
                              onChange={(e) =>
                                setEducation((prev) =>
                                  prev.map((it, i) =>
                                    i === index
                                      ? { ...it, program: e.target.value }
                                      : it,
                                  ),
                                )
                              }
                            />
                          </Field>
                        </FieldPair>
                      </ReviewRow>
                    );
                  })}
                </Section>
              )}

              {projects.length > 0 && (
                <Section title="Projects">
                  {projects.map((item, index) => {
                    const key = `proj:${item.id}`;
                    return (
                      <ReviewRow
                        key={item.id}
                        checked={!!included[key]}
                        onCheckedChange={(v) => toggle(key, v)}
                        meta={[item.role ?? "", item.url ?? ""]}
                      >
                        <Field label="Name">
                          <Input
                            value={item.name}
                            onChange={(e) =>
                              setProjects((prev) =>
                                prev.map((it, i) =>
                                  i === index
                                    ? { ...it, name: e.target.value }
                                    : it,
                                ),
                              )
                            }
                          />
                        </Field>
                        {item.description && (
                          <p className="mt-2 line-clamp-3 text-xs text-gray-500">
                            {item.description}
                          </p>
                        )}
                      </ReviewRow>
                    );
                  })}
                </Section>
              )}

              {skills.length > 0 && (
                <Section title="Skills">
                  <div className="flex flex-wrap gap-2">
                    {skills.map((item, index) => {
                      const key = `skill:${index}`;
                      const on = !!included[key];
                      return (
                        <button
                          type="button"
                          key={`${item.name}-${index}`}
                          onClick={() => toggle(key, !on)}
                          className={`rounded-full border px-3 py-1 text-sm transition ${
                            on
                              ? "border-brand-orange bg-brand-orange/10 text-gray-900"
                              : "border-gray-200 bg-white text-gray-400 line-through"
                          }`}
                        >
                          {item.name}
                          {item.category && (
                            <span className="ml-1 text-xs text-gray-400">
                              · {item.category}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Section>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div className="text-sm text-gray-500">
            {totalCount > 0 && (
              <span>
                {selectedCount} of {totalCount} selected
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            {totalCount > 0 && (
              <Button
                onClick={handleConfirm}
                disabled={isSaving || selectedCount === 0}
                className="bg-black text-white hover:bg-gray-800"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Add ${selectedCount} to my profile`
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ReviewRow({
  checked,
  onCheckedChange,
  meta,
  children,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  meta?: string[];
  children: React.ReactNode;
}) {
  const metaItems = (meta ?? []).filter((m) => m && m.trim().length > 0);
  return (
    <div
      className={`flex gap-3 rounded-lg border p-3 ${
        checked ? "border-gray-200" : "border-gray-100 opacity-60"
      }`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-1"
      />
      <div className="min-w-0 flex-1">
        {children}
        {metaItems.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {metaItems.map((m, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="max-w-[16rem] truncate capitalize"
              >
                {m}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldPair({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs text-gray-500">{label}</Label>
      {children}
    </div>
  );
}
