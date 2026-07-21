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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  SKILL_CATEGORY_OPTIONS,
  formatRange,
} from "./profile-builder-shared";
import type { ParsedResume } from "@/lib/resume-parse";
import type { Experience, Education, SkillEntry } from "@/lib/profile";

/**
 * Review + confirm dialog for parsed resume suggestions (spec 08 §3.1 / Open-Q1).
 *
 * Parsing is a SUGGESTION — the student owns the truth. Every item can be
 * accepted (checkbox), edited (title/org/dates/description, employment type,
 * school/program/grad year, skill category), or discarded (unchecked).
 * Fields the parser left blank get a subtle amber flag so the eye goes to
 * what needs a decision — there are no fake confidence scores, just "this
 * one's empty, take a look." On confirm, only the checked items — with edits
 * applied — are handed back to the caller, which merges them into the
 * profile (appending, never overwriting existing entries) in a single call.
 */

const UNSET = "__unset__";

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

  const updateExperience = (index: number, patch: Partial<Experience>) =>
    setExperiences((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  const updateEducation = (index: number, patch: Partial<Education>) =>
    setEducation((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  const updateSkill = (index: number, patch: Partial<SkillEntry>) =>
    setSkills((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );

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
            don't want, tweak the details (fields with an amber outline came
            up empty), then add the rest to your profile. You can keep
            editing everything afterwards.
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
                      >
                        <FieldPair>
                          <Field label="Title" empty={!item.title.trim()}>
                            <Input
                              value={item.title}
                              onChange={(e) =>
                                updateExperience(index, {
                                  title: e.target.value,
                                })
                              }
                              className={emptyClass(item.title)}
                            />
                          </Field>
                          <Field
                            label="Organization"
                            empty={!item.organization.trim()}
                          >
                            <Input
                              value={item.organization}
                              onChange={(e) =>
                                updateExperience(index, {
                                  organization: e.target.value,
                                })
                              }
                              className={emptyClass(item.organization)}
                            />
                          </Field>
                          <Field label="Type" empty={!item.employmentType}>
                            <Select
                              value={item.employmentType ?? UNSET}
                              onValueChange={(v) =>
                                updateExperience(index, {
                                  employmentType:
                                    v === UNSET
                                      ? undefined
                                      : (v as Experience["employmentType"]),
                                })
                              }
                            >
                              <SelectTrigger
                                size="sm"
                                className={`w-full ${emptyClass(item.employmentType)}`}
                              >
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={UNSET}>Not set</SelectItem>
                                {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Location">
                            <Input
                              value={item.location ?? ""}
                              onChange={(e) =>
                                updateExperience(index, {
                                  location: e.target.value,
                                })
                              }
                              placeholder="Toronto, ON"
                            />
                          </Field>
                          <Field
                            label="Start (YYYY-MM)"
                            empty={!item.startDate?.trim()}
                          >
                            <Input
                              value={item.startDate ?? ""}
                              onChange={(e) =>
                                updateExperience(index, {
                                  startDate: e.target.value,
                                })
                              }
                              placeholder="2024-05"
                              className={emptyClass(item.startDate)}
                            />
                          </Field>
                          <Field label="End (YYYY-MM)">
                            <Input
                              value={item.current ? "" : (item.endDate ?? "")}
                              onChange={(e) =>
                                updateExperience(index, {
                                  endDate: e.target.value,
                                })
                              }
                              placeholder="2024-08"
                              disabled={!!item.current}
                            />
                          </Field>
                        </FieldPair>
                        <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={!!item.current}
                            onChange={(e) =>
                              updateExperience(index, {
                                current: e.target.checked,
                                endDate: e.target.checked
                                  ? null
                                  : item.endDate,
                              })
                            }
                          />
                          Current
                        </label>
                        <div className="mt-2">
                          <Label className="text-xs text-gray-500">
                            Description
                          </Label>
                          <Textarea
                            value={item.description ?? ""}
                            onChange={(e) =>
                              updateExperience(index, {
                                description: e.target.value,
                              })
                            }
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {formatRange(
                            item.startDate,
                            item.endDate,
                            item.current,
                          ) && (
                            <Badge variant="secondary" className="truncate">
                              {formatRange(
                                item.startDate,
                                item.endDate,
                                item.current,
                              )}
                            </Badge>
                          )}
                        </div>
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
                      >
                        <FieldPair>
                          <Field label="School" empty={!item.school.trim()}>
                            <Input
                              value={item.school}
                              onChange={(e) =>
                                updateEducation(index, {
                                  school: e.target.value,
                                })
                              }
                              className={emptyClass(item.school)}
                            />
                          </Field>
                          <Field label="Program" empty={!item.program.trim()}>
                            <Input
                              value={item.program}
                              onChange={(e) =>
                                updateEducation(index, {
                                  program: e.target.value,
                                })
                              }
                              className={emptyClass(item.program)}
                            />
                          </Field>
                          <Field label="Field of study">
                            <Input
                              value={item.fieldOfStudy ?? ""}
                              onChange={(e) =>
                                updateEducation(index, {
                                  fieldOfStudy: e.target.value,
                                })
                              }
                              placeholder="Software"
                            />
                          </Field>
                          <Field
                            label="Graduation year"
                            empty={!item.graduationYear?.trim()}
                          >
                            <Input
                              value={item.graduationYear ?? ""}
                              onChange={(e) =>
                                updateEducation(index, {
                                  graduationYear: e.target.value,
                                })
                              }
                              placeholder="2026"
                              className={emptyClass(item.graduationYear)}
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
                        <Field label="Name" empty={!item.name.trim()}>
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
                            className={emptyClass(item.name)}
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
                  <p className="-mt-1 mb-2 text-xs text-gray-500">
                    Tap a skill to include/exclude it. Set a category where
                    it's missing (amber outline).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((item, index) => {
                      const key = `skill:${index}`;
                      const on = !!included[key];
                      return (
                        <div
                          key={`${item.name}-${index}`}
                          className={`flex items-center gap-1 rounded-full border py-1 pl-3 pr-1.5 text-sm transition ${
                            on
                              ? "border-brand-orange bg-brand-orange/10"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggle(key, !on)}
                            className={
                              on
                                ? "text-gray-900"
                                : "text-gray-400 line-through"
                            }
                          >
                            {item.name}
                          </button>
                          <Select
                            value={item.category ?? UNSET}
                            onValueChange={(v) =>
                              updateSkill(index, {
                                category:
                                  v === UNSET
                                    ? undefined
                                    : (v as SkillEntry["category"]),
                              })
                            }
                          >
                            <SelectTrigger
                              size="sm"
                              className={`h-6 w-[6.5rem] border-0 bg-transparent px-1.5 text-xs shadow-none ${
                                !item.category
                                  ? "ring-1 ring-amber-400/70 rounded"
                                  : ""
                              }`}
                            >
                              <SelectValue placeholder="category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNSET}>No category</SelectItem>
                              {SKILL_CATEGORY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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

/** Amber flag classes for a field the parser left empty — draws the eye to
 *  what needs a decision without pretending to score confidence. */
function emptyClass(value?: string | null): string {
  const isEmpty = !value || !String(value).trim();
  return isEmpty
    ? "border-amber-400 focus-visible:ring-amber-400/50"
    : "";
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
  empty,
  children,
}: {
  label: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs text-gray-500">{label}</Label>
      {children}
      {empty && (
        <p className="mt-0.5 text-[11px] font-medium text-amber-600">
          Not in your resume — worth adding
        </p>
      )}
    </div>
  );
}
