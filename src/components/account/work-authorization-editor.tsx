import { useEffect, useState } from "react";
import { BriefcaseBusiness, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  SPONSORSHIP_OPTIONS,
  WORK_AUTH_ANSWER_OPTIONS,
  WORK_AUTH_STATUS_OPTIONS,
  sponsorshipFromWire,
  sponsorshipToWire,
  type WorkAuthorization,
} from "./profile-builder-shared";

/**
 * Work-authorization block (spec 08 §3.1 / §4.5). Factual, job-relevant profile
 * data modeled like Handshake — "Are you authorized to work in Canada?",
 * sponsorship now / in future, and immigration status. Every question has a
 * "Prefer not to answer" option.
 *
 * IMPORTANT: this is a plain profile section, kept VISUALLY and SEMANTICALLY
 * SEPARATE from the anonymous demographic self-ID survey (pillar 3). It is NOT
 * anonymous — it is stored plainly on `profiles/{uid}.workAuthorization` and is
 * job-relevant. No anonymity / consent framing here on purpose.
 */

interface WorkAuthorizationEditorProps {
  workAuthorization?: WorkAuthorization;
  onSaved: (patch: Partial<StudentProfile>) => void;
}

const UNSET = "unset";

export function WorkAuthorizationEditor({
  workAuthorization,
  onSaved,
}: WorkAuthorizationEditorProps) {
  const [authorized, setAuthorized] = useState<string>(UNSET);
  const [status, setStatus] = useState<string>(UNSET);
  const [sponsorNow, setSponsorNow] = useState<string>("unknown");
  const [sponsorFuture, setSponsorFuture] = useState<string>("unknown");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAuthorized(workAuthorization?.authorizedToWorkInCanada ?? UNSET);
    setStatus(workAuthorization?.status ?? UNSET);
    setSponsorNow(sponsorshipFromWire(workAuthorization?.requiresSponsorshipNow));
    setSponsorFuture(
      sponsorshipFromWire(workAuthorization?.requiresSponsorshipFuture),
    );
  }, [workAuthorization]);

  const save = async () => {
    setIsSaving(true);
    try {
      const payload: WorkAuthorization = {
        requiresSponsorshipNow: sponsorshipToWire(sponsorNow),
        requiresSponsorshipFuture: sponsorshipToWire(sponsorFuture),
      };
      if (authorized !== UNSET) {
        payload.authorizedToWorkInCanada =
          authorized as WorkAuthorization["authorizedToWorkInCanada"];
      }
      if (status !== UNSET) {
        payload.status = status as WorkAuthorization["status"];
      }
      await updateProfileFields({ workAuthorization: payload });
      onSaved({ workAuthorization: payload });
      toast.success("Work authorization saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save work authorization",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-1 flex items-center gap-2">
          <BriefcaseBusiness className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Work authorization</h2>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Job-relevant details employers may ask about. Optional — every question
          has a "Prefer not to answer" option.
        </p>

        <div className="space-y-5">
          <div>
            <Label className="mb-1.5 block">
              Are you authorized to work in Canada?
            </Label>
            <Select value={authorized} onValueChange={setAuthorized}>
              <SelectTrigger className="w-full md:w-80">
                <SelectValue placeholder="Select an answer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>Not specified</SelectItem>
                {WORK_AUTH_ANSWER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">
              Do you now require sponsorship to work in Canada?
            </Label>
            <Select value={sponsorNow} onValueChange={setSponsorNow}>
              <SelectTrigger className="w-full md:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPONSORSHIP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">
              Will you in the future require sponsorship to work in Canada?
            </Label>
            <Select value={sponsorFuture} onValueChange={setSponsorFuture}>
              <SelectTrigger className="w-full md:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPONSORSHIP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Work status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full md:w-80">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>Not specified</SelectItem>
                {WORK_AUTH_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={save}
              disabled={isSaving}
              className="bg-black text-white hover:bg-gray-800"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save work authorization"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
