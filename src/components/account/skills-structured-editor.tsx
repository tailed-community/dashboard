import { useEffect, useState } from "react";
import { Loader2, Plus, Tags, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  SKILL_CATEGORY_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  type SkillEntry,
} from "./profile-builder-shared";

/**
 * Structured skills editor (spec 08 §3.1 / §4.4). Lets students tag each skill
 * with an optional category and proficiency level, while KEEPING the flat
 * `skills: string[]` list populated with the names for back-compat with existing
 * consumers (the backend mirrors the names; we mirror them into local state too
 * so the legacy Skills card stays in sync this session). Mounted alongside the
 * existing flat Skills / Resume UI. Optional and non-blocking.
 */

const MAX_SKILLS = 25;
const CATEGORY_NONE = "none";
const LEVEL_NONE = "none";

interface SkillsStructuredEditorProps {
  skillsStructured?: SkillEntry[];
  onSaved: (patch: Partial<StudentProfile>) => void;
}

export function SkillsStructuredEditor({
  skillsStructured,
  onSaved,
}: SkillsStructuredEditorProps) {
  const [items, setItems] = useState<SkillEntry[]>(skillsStructured ?? []);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(CATEGORY_NONE);
  const [level, setLevel] = useState<string>(LEVEL_NONE);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setItems(skillsStructured ?? []);
  }, [skillsStructured]);

  const persist = async (next: SkillEntry[]) => {
    setIsSaving(true);
    try {
      const names = [...new Set(next.map((s) => s.name))];
      await updateProfileFields({ skillsStructured: next });
      setItems(next);
      // Mirror names into the flat list locally so the legacy Skills card and
      // the onboarding "skills" signal stay consistent this session.
      onSaved({ skillsStructured: next, skills: names });
      toast.success("Skills saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save skills",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a skill name");
      return;
    }
    if (items.length >= MAX_SKILLS) {
      toast.error(`Maximum ${MAX_SKILLS} skills`);
      return;
    }
    if (items.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("That skill is already in your list");
      return;
    }
    const entry: SkillEntry = { name: trimmed };
    if (category !== CATEGORY_NONE) {
      entry.category = category as SkillEntry["category"];
    }
    if (level !== LEVEL_NONE) {
      entry.level = level as SkillEntry["level"];
    }
    setName("");
    setCategory(CATEGORY_NONE);
    setLevel(LEVEL_NONE);
    await persist([...items, entry]);
  };

  const remove = async (target: string) => {
    await persist(items.filter((s) => s.name !== target));
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-1 flex items-center gap-2">
          <Tags className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Skills with categories</h2>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Tag skills with an optional category and level. Saving here also keeps
          your simple skills list above up to date.
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Skill (e.g. TypeScript)"
            maxLength={50}
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="md:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CATEGORY_NONE}>No category</SelectItem>
              {SKILL_CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="md:w-40">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LEVEL_NONE}>No level</SelectItem>
              {SKILL_LEVEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={add}
            disabled={isSaving || items.length >= MAX_SKILLS || !name.trim()}
            className="bg-black text-white hover:bg-gray-800"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="mr-1.5 h-4 w-4" />
                Add
              </>
            )}
          </Button>
        </div>

        <div className="mt-4">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <p className="text-sm text-gray-500">
                No tagged skills yet. Add your first skill above.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {items.map((s) => (
                <Badge
                  key={s.name}
                  variant="secondary"
                  className="flex items-center gap-1.5 px-3 py-1.5"
                >
                  <span className="font-medium">{s.name}</span>
                  {(s.category || s.level) && (
                    <span className="text-xs text-gray-500">
                      {[s.category, s.level].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(s.name)}
                    disabled={isSaving}
                    className="ml-1 text-gray-500 hover:text-red-600"
                    aria-label={`Remove ${s.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
