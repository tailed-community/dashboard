import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type FormField = {
  id: string;
  question: string;
  label: string;
  type: string;
  autofillSource?: string | null;
  required?: boolean;
};

const AUTO_FIELDS: { key: string; template: Omit<FormField, "id"> }[] = [
  {
    key: "firstName",
    template: {
      question: "First name",
      label: "First name",
      type: "text",
      autofillSource: "profile.firstName",
      required: true,
    },
  },
  {
    key: "lastName",
    template: {
      question: "Last name",
      label: "Last name",
      type: "text",
      autofillSource: "profile.lastName",
      required: true,
    },
  },
  {
    key: "email",
    template: {
      question: "Email address",
      label: "Email",
      type: "email",
      autofillSource: "profile.email",
      required: true,
    },
  },
];

function generateId() {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function CustomFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [fields, setFields] = useState<FormField[]>([]);
  const [autoSelected, setAutoSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load event to check permission (canEdit)
    if (!id) return;
    (async () => {
      try {
        const res = await apiFetch(`/events/${id}`);
        if (!res.ok) {
          setCanEdit(false);
          return;
        }
        const data = await res.json();
        setCanEdit(Boolean(data.event?.canEdit));
      } catch (err) {
        console.error(err);
      }
    })();
  }, [id]);

  useEffect(() => {
    // initialize autoSelected map
    const map: Record<string, boolean> = {};
    AUTO_FIELDS.forEach((f) => (map[f.key] = false));
    setAutoSelected(map);
  }, []);

  const toggleAuto = (key: string) => {
    const next = { ...autoSelected, [key]: !autoSelected[key] };
    setAutoSelected(next);

    const spec = AUTO_FIELDS.find((a) => a.key === key);
    if (!spec) return;

    if (next[key]) {
      // add field if not present
      const exists = fields.some((f) => f.autofillSource === spec.template.autofillSource);
      if (!exists) {
        setFields((s) => [...s, { id: generateId(), ...spec.template }]);
      }
    } else {
      // remove matching autofill field
      setFields((s) => s.filter((f) => f.autofillSource !== spec.template.autofillSource));
    }
  };

  const updateField = (id: string, patch: Partial<FormField>) => {
    setFields((s) => s.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const addQuestion = () => {
    setFields((s) => [...s, { id: generateId(), question: "", label: "", type: "text", required: false }]);
  };

  const removeField = (id: string) => setFields((s) => s.filter((f) => f.id !== id));

  const saveForm = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const formId = `custom-${Date.now()}`;
      // Map to the expected server shape: question, label, type, autofillSource?, required
      const payload = fields.map((f) => ({ question: f.question || f.label, label: f.label || f.question, type: f.type || "text", autofillSource: f.autofillSource || null, required: Boolean(f.required) }));

      const res = await apiFetch(`/events/${id}/registration-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId, fields: payload }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Failed to save form", err);
        alert(err.error || "Failed to save form");
        setLoading(false);
        return;
      }

      // Success: navigate to registration page and include the new formId
      navigate(`/events/${id}/register?formId=${encodeURIComponent(formId)}`);
    } catch (error) {
      console.error(error);
      alert("Failed to save form");
    } finally {
      setLoading(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Custom registration form</h2>
        <p className="mt-2 text-sm text-muted-foreground">You do not have permission to edit forms for this event.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-2xl font-semibold">Custom registration form</h2>

      <section className="mt-6">
        <h3 className="font-medium">Autofillable fields</h3>
        <div className="mt-3 space-y-2">
          {AUTO_FIELDS.map((a) => (
            <label key={a.key} className="flex items-center gap-3">
              <Checkbox checked={!!autoSelected[a.key]} onCheckedChange={() => toggleAuto(a.key)} />
              <span>{a.template.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="font-medium">Form fields</h3>
        <div className="mt-3 space-y-4">
          {fields.map((f) => (
            <div key={f.id} className="p-3 border rounded-md bg-background">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground">Label</label>
                  <Input value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} />
                </div>
                <div className="w-56">
                  <label className="text-sm text-muted-foreground">Question</label>
                  <Input value={f.question} onChange={(e) => updateField(f.id, { question: e.target.value })} />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div>
                  <label className="text-sm text-muted-foreground">Type</label>
                  <select className="ml-2 rounded-md border px-2 py-1" value={f.type} onChange={(e) => updateField(f.id, { type: e.target.value })}>
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="number">Number</option>
                    <option value="textarea">Textarea</option>
                  </select>
                </div>

                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(f.id, { required: e.target.checked })} />
                  <span className="text-sm">Required</span>
                </label>

                <div className="ml-auto">
                  <Button variant="outline" onClick={() => removeField(f.id)}>Remove</Button>
                </div>
              </div>
            </div>
          ))}

          <div>
            <Button variant="ghost" onClick={addQuestion}>Add question</Button>
          </div>
        </div>
      </section>

      <div className="mt-6 flex gap-3">
        <Button onClick={saveForm} disabled={loading}>{loading ? "Saving..." : "Save form"}</Button>
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
      </div>
    </div>
  );
}
