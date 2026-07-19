import { useEffect, useState } from "react";
import { FolderGit2, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { updateProfileFields, type StudentProfile } from "@/lib/profile";
import { formatRange, makeId, type Project } from "./profile-builder-shared";

/**
 * Projects list editor — first-class for students, who often lead with projects
 * (spec 08 §3.1 / §4.3). Add / edit / remove personal, course, hackathon or
 * open-source projects. Optional and non-blocking; persists the whole
 * `projects[]` array through the shared `PATCH /profile/update` path.
 */

interface ProjectsEditorProps {
  projects?: Project[];
  onSaved: (patch: Partial<StudentProfile>) => void;
}

function emptyDraft(): Project {
  return {
    id: makeId(),
    name: "",
    description: "",
    role: "",
    url: "",
    skills: [],
    startDate: "",
    endDate: "",
    source: "manual",
  };
}

export function ProjectsEditor({ projects, onSaved }: ProjectsEditorProps) {
  const [items, setItems] = useState<Project[]>(projects ?? []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Project>(emptyDraft());
  const [skillsText, setSkillsText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setItems(projects ?? []);
  }, [projects]);

  const startAdd = () => {
    setDraft(emptyDraft());
    setSkillsText("");
    setEditingId("new");
  };

  const startEdit = (item: Project) => {
    setDraft({ ...item });
    setSkillsText((item.skills ?? []).join(", "));
    setEditingId(item.id);
  };

  const persist = async (next: Project[]) => {
    setIsSaving(true);
    try {
      await updateProfileFields({ projects: next });
      setItems(next);
      onSaved({ projects: next });
      setEditingId(null);
      toast.success("Project saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save project",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft.name.trim()) {
      toast.error("Project name is required");
      return;
    }
    const skills = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const cleaned: Project = {
      ...draft,
      name: draft.name.trim(),
      skills,
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
            <FolderGit2 className="h-5 w-5" />
            Projects
          </h2>
          {editingId === null && (
            <Button variant="outline" size="sm" onClick={startAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add project
            </Button>
          )}
        </div>

        {items.length === 0 && editingId === null && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-500">
              No projects yet. Class projects, hackathon builds and side projects
              are great signals for recruiters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={startAdd}
              className="mt-3"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add your first project
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) =>
            editingId === item.id ? (
              <ProjectForm
                key={item.id}
                draft={draft}
                setDraft={setDraft}
                skillsText={skillsText}
                setSkillsText={setSkillsText}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Link
                      </a>
                    )}
                  </div>
                  {item.role && (
                    <p className="text-sm text-gray-600">{item.role}</p>
                  )}
                  {formatRange(item.startDate, item.endDate) && (
                    <p className="text-xs text-gray-500">
                      {formatRange(item.startDate, item.endDate)}
                    </p>
                  )}
                  {item.description && (
                    <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
                      {item.description}
                    </p>
                  )}
                  {(item.skills?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.skills!.map((s, i) => (
                        <Badge key={i} variant="secondary">
                          {s}
                        </Badge>
                      ))}
                    </div>
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
            <ProjectForm
              draft={draft}
              setDraft={setDraft}
              skillsText={skillsText}
              setSkillsText={setSkillsText}
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

function ProjectForm({
  draft,
  setDraft,
  skillsText,
  setSkillsText,
  onSave,
  onCancel,
  isSaving,
}: {
  draft: Project;
  setDraft: (next: Project) => void;
  skillsText: string;
  setSkillsText: (next: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-gray-300 bg-gray-50/50 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Study Buddy App"
          />
        </div>
        <div>
          <Label>Your role</Label>
          <Input
            value={draft.role ?? ""}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            placeholder="Full-stack developer"
          />
        </div>
        <div className="md:col-span-2">
          <Label>URL (repo / demo / Devpost)</Label>
          <Input
            value={draft.url ?? ""}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            placeholder="https://github.com/you/project"
          />
        </div>
        <div>
          <Label>Start (YYYY-MM)</Label>
          <Input
            value={draft.startDate ?? ""}
            onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            placeholder="2024-01"
          />
        </div>
        <div>
          <Label>End (YYYY-MM)</Label>
          <Input
            value={draft.endDate ?? ""}
            onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            placeholder="2024-04"
          />
        </div>
      </div>
      <div>
        <Label>Skills (comma-separated)</Label>
        <Input
          value={skillsText}
          onChange={(e) => setSkillsText(e.target.value)}
          placeholder="React, Node.js, Firebase"
        />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="What does it do, and what did you build?"
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
            "Save project"
          )}
        </Button>
      </div>
    </div>
  );
}
