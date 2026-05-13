import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import RegistrationFormBuilder from "@/components/forms/RegistrationFormBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";

type FieldDef = {
  question?: string;
  label: string;
  type: string;
  required?: boolean;
  autofillSource?: string | null;
};

type Team = {
  id: string;
  name: string;
  maxSize: number;
  memberCount?: number;
  members?: string[];
};

export default function EventRegistrationPage() {
  const params = useParams();
  const navigate = useNavigate();
  const eventId = params.id as string;
  const [fields, setFields] = useState<FieldDef[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("__none__");
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  const loadTeams = async () => {
    try {
      const teamsResp = await apiFetch(`/events/${eventId}/teams`);
      if (teamsResp.ok) {
        const teamsBody = await teamsResp.json();
        setTeams(Array.isArray(teamsBody.data) ? teamsBody.data : []);
      }
    } catch (teamErr) {
      console.error("Failed to load teams", teamErr);
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    if (!eventId) return;

    const load = async () => {
      setLoading(true);
      try {
        const evRes = await apiFetch(`/events/${eventId}`);
        if (!evRes.ok) throw await evRes.json();
        const evBody = await evRes.json();
        setRequiresApproval(Boolean(evBody.event?.requiresApproval));
        const regFormId = evBody.event?.registrationFormId;

        await loadTeams();

        if (regFormId && regFormId !== "default") {
          const customResp = await apiFetch(`/events/${eventId}/registration-form?formId=${encodeURIComponent(regFormId)}`);
          if (customResp.ok) {
            const customBody = await customResp.json();
            setFields(customBody.form?.fields || []);
            setLoading(false);
            return;
          }
        }
        // Fallback to default form
        const defaultResp = await apiFetch(`/events/${eventId}/registration-form`);
        if (!defaultResp.ok) throw await defaultResp.json();
        const defaultBody = await defaultResp.json();
        setFields(defaultBody.form?.fields || []);
      } catch (err: any) {
        console.error("Failed to load registration form", err);
        setError(err?.message || "Failed to load form");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [eventId]);

  const handleCreateTeam = async () => {
    const trimmedName = newTeamName.trim();
    if (!trimmedName) {
      toast.error("Enter a team name first");
      return;
    }

    setCreatingTeam(true);
    try {
      const resp = await apiFetch(`/events/${eventId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(body.error || body.message || "Failed to create team");
      }

      const createdTeamId = body.data?.id || "";
      if (createdTeamId) {
        setSelectedTeamId(createdTeamId);
      }
      setNewTeamName("");
      await loadTeams();
      toast.success("Team created", {
        description: "You are the captain of this team.",
      });
    } catch (err) {
      console.error("Failed to create team", err);
      toast.error(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreatingTeam(false);
    }
  };

  if (!eventId) {
    return <div>Event id missing</div>;
  }

  if (loading) return <div>Loading registration form…</div>;
  if (error) return (
    <div>
      <p className="text-destructive">{error}</p>
      <Button onClick={() => navigate(-1)}>Go back</Button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Register for event</h1>
      <div className="mb-6 rounded-lg border bg-background p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="font-medium">Choose a team</p>
            <p className="text-sm text-muted-foreground">
              Pick the team you want to join when registering, or create your own team.
            </p>
          </div>
          <Badge variant="secondary">Team optional</Badge>
        </div>
        <Select value={selectedTeamId} onValueChange={setSelectedTeamId} disabled={teamLoading}>
          <SelectTrigger>
            <SelectValue placeholder={teamLoading ? "Loading teams..." : "Select a team"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No team yet</SelectItem>
            {teams.map((team) => {
              const memberCount = team.memberCount ?? team.members?.length ?? 0;
              const isFull = memberCount >= team.maxSize;
              return (
                <SelectItem key={team.id} value={team.id} disabled={isFull}>
                  {team.name} ({memberCount}/{team.maxSize}){isFull ? " - full" : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Or create a new team</p>
          <div className="flex gap-2">
            <Input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Enter a team name"
            />
            <Button type="button" onClick={handleCreateTeam} disabled={creatingTeam}>
              {creatingTeam ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </div>
      {fields ? (
        <RegistrationFormBuilder
          eventId={eventId}
          fields={fields}
          teamId={selectedTeamId === "__none__" ? null : selectedTeamId}
          onSuccess={(result) => {
            if (result?.status === "pending" || requiresApproval) {
              toast.success("Request submitted", {
                description: "The organizer will review your request and email you when it is approved.",
              });
            } else {
              toast.success(result?.message || "Successfully registered for the event");
            }
            setTimeout(() => navigate(`/events/${eventId}`), 800);
          }}
        />
      ) : (
        <p>No registration form available.</p>
      )}
    </div>
  );
}
