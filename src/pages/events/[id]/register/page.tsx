import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import RegistrationFormBuilder from "@/components/forms/RegistrationFormBuilder";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type FieldDef = {
  question?: string;
  label: string;
  type: string;
  required?: boolean;
  autofillSource?: string | null;
};

export default function EventRegistrationPage() {
  const params = useParams();
  const navigate = useNavigate();
  const eventId = params.id as string;
  const [fields, setFields] = useState<FieldDef[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresApproval, setRequiresApproval] = useState(false);

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
      {fields ? (
        <RegistrationFormBuilder
          eventId={eventId}
          fields={fields}
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
