import { useEffect, useState, type ReactNode } from "react";
import { GraduationCap, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateProfileFields, type StudentProfile } from "@/lib/profile";
import { makeId, type Education } from "./profile-builder-shared";

/**
 * Education list editor (spec 08 §3.1 / §4.2). Supports MULTIPLE education
 * entries. The FIRST (primary) entry stays synced with the flat
 * `school` / `program` / `graduationYear` scalars — those remain the source of
 * truth for the onboarding card's required-set done-check, so this editor never
 * owns them (they're edited in the "Educational Background" fields above and are
 * shown here read-only). This editor manages the ADDITIONAL degrees only, then
 * persists the full `education[]` array as `[primary, ...additional]`. The
 * backend re-mirrors `education[0]` from the authoritative scalars on every
 * write, so the primary stays correct even without a re-save here.
 */

interface EducationEditorProps {
  profile: Pick<
    StudentProfile,
    "school" | "program" | "graduationYear" | "education"
  >;
  onSaved: (patch: Partial<StudentProfile>) => void;
}

function emptyDraft(): Education {
  return {
    id: makeId(),
    school: "",
    program: "",
    fieldOfStudy: "",
    graduationYear: "",
    startYear: "",
    current: false,
    source: "manual",
  };
}

/** Build the primary (index 0) entry from the authoritative flat scalars,
 *  preserving the existing entry's id and enrichment fields where present. */
function buildPrimary(
  profile: EducationEditorProps["profile"],
): Education {
  const existing = profile.education?.[0];
  return {
    id: existing?.id ?? makeId(),
    school: profile.school ?? "",
    program: profile.program ?? "",
    graduationYear: profile.graduationYear ?? "",
    fieldOfStudy: existing?.fieldOfStudy,
    startYear: existing?.startYear,
    current: existing?.current,
    source: existing?.source === "resume-parse" ? "resume-parse" : "manual",
  };
}

export function EducationEditor({ profile, onSaved }: EducationEditorProps) {
  const [additional, setAdditional] = useState<Education[]>(
    profile.education?.slice(1) ?? [],
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Education>(emptyDraft());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAdditional(profile.education?.slice(1) ?? []);
  }, [profile.education]);

  const hasPrimary = !!(
    profile.school?.trim() ||
    profile.program?.trim() ||
    String(profile.graduationYear ?? "").trim()
  );

  const persist = async (nextAdditional: Education[]) => {
    setIsSaving(true);
    try {
      const education = [buildPrimary(profile), ...nextAdditional];
      await updateProfileFields({ education });
      setAdditional(nextAdditional);
      onSaved({ education });
      setEditingId(null);
      toast.success("Education saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save education",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft.school.trim() || !draft.program.trim()) {
      toast.error("School and program are required");
      return;
    }
    const cleaned: Education = {
      ...draft,
      school: draft.school.trim(),
      program: draft.program.trim(),
    };
    const exists = additional.some((it) => it.id === cleaned.id);
    const next = exists
      ? additional.map((it) => (it.id === cleaned.id ? cleaned : it))
      : [...additional, cleaned];
    await persist(next);
  };

  const remove = async (id: string) => {
    await persist(additional.filter((it) => it.id !== id));
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <GraduationCap className="h-5 w-5" />
            Education history
          </h2>
          {editingId === null && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(emptyDraft());
                setEditingId("new");
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add education
            </Button>
          )}
        </div>

        <p className="mb-4 text-sm text-gray-500">
          Your primary education comes from the fields above and is the one
          employers see first. Add any additional degrees or programs here.
        </p>

        {/* Primary entry — read-only mirror of the authoritative scalars. */}
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2">
            <Badge>Primary</Badge>
            {hasPrimary ? (
              <span className="font-medium text-gray-900">
                {profile.program || "Program"}{" "}
                {profile.school ? `· ${profile.school}` : ""}
              </span>
            ) : (
              <span className="text-sm text-gray-500">
                Set your school, program and graduation year in the fields above.
              </span>
            )}
          </div>
          {hasPrimary && profile.graduationYear && (
            <p className="mt-1 text-xs text-gray-500">
              Expected graduation {profile.graduationYear}
            </p>
          )}
        </div>

        <div className="space-y-3">
          {additional.map((item) =>
            editingId === item.id ? (
              <EducationForm
                key={item.id}
                draft={draft}
                setDraft={setDraft}
                onSave={saveDraft}
                onCancel={() => setEditingId(null)}
                isSaving={isSaving}
              />
            ) : (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{item.program}</p>
                  <p className="text-sm text-gray-600">{item.school}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {item.fieldOfStudy && <span>{item.fieldOfStudy}</span>}
                    {(item.startYear || item.graduationYear) && (
                      <span>
                        {item.startYear ? `${item.startYear} – ` : ""}
                        {item.current
                          ? "Present"
                          : item.graduationYear || ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDraft({ ...item });
                      setEditingId(item.id);
                    }}
                    disabled={editingId !== null}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(item.id)}
                    disabled={isSaving || editingId !== null}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ),
          )}

          {editingId === "new" && (
            <EducationForm
              draft={draft}
              setDraft={setDraft}
              onSave={saveDraft}
              onCancel={() => setEditingId(null)}
              isSaving={isSaving}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">
      {children}
    </span>
  );
}

function EducationForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  isSaving,
}: {
  draft: Education;
  setDraft: (next: Education) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-gray-300 bg-gray-50/50 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label>School</Label>
          <Input
            value={draft.school}
            onChange={(e) => setDraft({ ...draft, school: e.target.value })}
            placeholder="University of Waterloo"
          />
        </div>
        <div>
          <Label>Program / degree</Label>
          <Input
            value={draft.program}
            onChange={(e) => setDraft({ ...draft, program: e.target.value })}
            placeholder="BASc Computer Engineering"
          />
        </div>
        <div>
          <Label>Field of study</Label>
          <Input
            value={draft.fieldOfStudy ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, fieldOfStudy: e.target.value })
            }
            placeholder="Software"
          />
        </div>
        <div>
          <Label>Start year</Label>
          <Input
            value={draft.startYear ?? ""}
            onChange={(e) => setDraft({ ...draft, startYear: e.target.value })}
            placeholder="2021"
          />
        </div>
        <div>
          <Label>Graduation year</Label>
          <Input
            value={draft.graduationYear ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, graduationYear: e.target.value })
            }
            placeholder="2026"
            disabled={draft.current}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={!!draft.current}
          onChange={(e) =>
            setDraft({ ...draft, current: e.target.checked })
          }
        />
        I'm currently studying here
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="mr-1.5 h-4 w-4" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="bg-black text-white hover:bg-gray-800"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save education"
          )}
        </Button>
      </div>
    </div>
  );
}
