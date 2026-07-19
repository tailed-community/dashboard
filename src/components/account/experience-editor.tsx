import { useEffect, useState } from "react";
import { Briefcase, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateProfileFields, type StudentProfile } from "@/lib/profile";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  formatRange,
  makeId,
  type Experience,
} from "./profile-builder-shared";

/**
 * Experience list editor (spec 08 §3.1 / §4.1). Add / edit / remove work,
 * internship, co-op and volunteer entries. Fully optional and non-blocking:
 * saving a profile never requires any experience. Persists the whole
 * `experiences[]` array through the shared `PATCH /profile/update` path.
 */

interface ExperienceEditorProps {
  experiences?: Experience[];
  onSaved: (patch: Partial<StudentProfile>) => void;
}

function emptyDraft(): Experience {
  return {
    id: makeId(),
    title: "",
    organization: "",
    employmentType: "internship",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    description: "",
    source: "manual",
  };
}

export function ExperienceEditor({
  experiences,
  onSaved,
}: ExperienceEditorProps) {
  const [items, setItems] = useState<Experience[]>(experiences ?? []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Experience>(emptyDraft());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setItems(experiences ?? []);
  }, [experiences]);

  const startAdd = () => {
    setDraft(emptyDraft());
    setEditingId("new");
  };

  const startEdit = (item: Experience) => {
    setDraft({ ...item });
    setEditingId(item.id);
  };

  const cancel = () => {
    setEditingId(null);
  };

  const persist = async (next: Experience[]) => {
    setIsSaving(true);
    try {
      await updateProfileFields({ experiences: next });
      setItems(next);
      onSaved({ experiences: next });
      setEditingId(null);
      toast.success("Experience saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save experience",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft.title.trim() || !draft.organization.trim()) {
      toast.error("Title and organization are required");
      return;
    }
    const cleaned: Experience = {
      ...draft,
      title: draft.title.trim(),
      organization: draft.organization.trim(),
      endDate: draft.current ? null : draft.endDate,
    };
    const exists = items.some((it) => it.id === cleaned.id);
    const next = exists
      ? items.map((it) => (it.id === cleaned.id ? cleaned : it))
      : [...items, cleaned];
    await persist(next);
  };

  const remove = async (id: string) => {
    await persist(items.filter((it) => it.id !== id));
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Briefcase className="h-5 w-5" />
            Experience
          </h2>
          {editingId === null && (
            <Button variant="outline" size="sm" onClick={startAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add experience
            </Button>
          )}
        </div>

        {items.length === 0 && editingId === null && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-500">
              No experience yet. Internships, co-ops, part-time jobs and
              volunteering all count.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={startAdd}
              className="mt-3"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add your first experience
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) =>
            editingId === item.id ? (
              <ExperienceForm
                key={item.id}
                draft={draft}
                setDraft={setDraft}
                onSave={saveDraft}
                onCancel={cancel}
                isSaving={isSaving}
              />
            ) : (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-600">{item.organization}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {item.employmentType && (
                      <Badge variant="secondary" className="capitalize">
                        {item.employmentType.replace("-", " ")}
                      </Badge>
                    )}
                    {formatRange(
                      item.startDate,
                      item.endDate,
                      item.current,
                    ) && (
                      <span className="text-xs text-gray-500">
                        {formatRange(
                          item.startDate,
                          item.endDate,
                          item.current,
                        )}
                      </span>
                    )}
                    {item.location && (
                      <span className="text-xs text-gray-500">
                        {item.location}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
                      {item.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(item)}
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
            <ExperienceForm
              draft={draft}
              setDraft={setDraft}
              onSave={saveDraft}
              onCancel={cancel}
              isSaving={isSaving}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ExperienceForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  isSaving,
}: {
  draft: Experience;
  setDraft: (next: Experience) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-gray-300 bg-gray-50/50 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Title</Label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Software Developer Intern"
          />
        </div>
        <div>
          <Label>Organization</Label>
          <Input
            value={draft.organization}
            onChange={(e) =>
              setDraft({ ...draft, organization: e.target.value })
            }
            placeholder="Acme Inc."
          />
        </div>
        <div>
          <Label>Type</Label>
          <Select
            value={draft.employmentType ?? "internship"}
            onValueChange={(value) =>
              setDraft({
                ...draft,
                employmentType: value as Experience["employmentType"],
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Location</Label>
          <Input
            value={draft.location ?? ""}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            placeholder="Toronto, ON"
          />
        </div>
        <div>
          <Label>Start (YYYY-MM)</Label>
          <Input
            value={draft.startDate ?? ""}
            onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            placeholder="2024-05"
          />
        </div>
        <div>
          <Label>End (YYYY-MM)</Label>
          <Input
            value={draft.current ? "" : (draft.endDate ?? "")}
            onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            placeholder="2024-08"
            disabled={draft.current}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={!!draft.current}
          onChange={(e) =>
            setDraft({
              ...draft,
              current: e.target.checked,
              endDate: e.target.checked ? null : draft.endDate,
            })
          }
        />
        I currently work here
      </label>
      <div>
        <Label>Description</Label>
        <Textarea
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="What did you build or accomplish?"
          rows={3}
        />
      </div>
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
            "Save experience"
          )}
        </Button>
      </div>
    </div>
  );
}
