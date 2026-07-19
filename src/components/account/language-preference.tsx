import { useEffect, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getPreferredLanguage,
  updateProfileFields,
  type StudentProfile,
} from "@/lib/profile";

/**
 * Communication-language selector (spec 08 §5 "Language & localization").
 *
 * Sets `profiles/{uid}.preferredLanguage`, the single field that drives the
 * language of ALL student communications (in-app surveys/card + all emails) via
 * explicit reads in later slices. It intentionally does NOT switch the global
 * Paraglide UI locale — translating the platform UI is a separate future effort.
 *
 * NOTE: this control's own copy is hardcoded EN on purpose — it is account UI,
 * not a communication surface, and FR of the platform UI is deferred.
 */

interface LanguagePreferenceProps {
  preferredLanguage?: "en" | "fr";
  onSaved: (patch: Partial<StudentProfile>) => void;
}

export function LanguagePreference({
  preferredLanguage,
  onSaved,
}: LanguagePreferenceProps) {
  const [value, setValue] = useState<"en" | "fr">(
    getPreferredLanguage({ preferredLanguage }),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValue(getPreferredLanguage({ preferredLanguage }));
  }, [preferredLanguage]);

  const dirty = value !== getPreferredLanguage({ preferredLanguage });

  const save = async () => {
    setIsSaving(true);
    try {
      await updateProfileFields({ preferredLanguage: value });
      onSaved({ preferredLanguage: value });
      toast.success("Communication language saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save communication language",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border-t pt-6 mt-6">
      <div className="mb-1 flex items-center gap-2">
        <Languages className="h-5 w-5" />
        <h3 className="text-base font-semibold">Communication language</h3>
      </div>
      <p className="mb-3 text-sm text-gray-500">
        We'll send your emails and surveys in this language.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="preferredLanguage" className="mb-1.5 block">
            Language
          </Label>
          <Select
            value={value}
            onValueChange={(v) => setValue(v as "en" | "fr")}
          >
            <SelectTrigger id="preferredLanguage" className="w-full md:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={save}
          disabled={isSaving || !dirty}
          className="bg-black text-white hover:bg-gray-800"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save language"
          )}
        </Button>
      </div>
    </div>
  );
}
