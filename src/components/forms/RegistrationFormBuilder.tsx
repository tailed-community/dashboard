import React from "react";
import { useForm } from "react-hook-form";
import { Form, FormItem, FormLabel, FormControl, FormField, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch";

type FieldDef = {
  question?: string;
  label: string;
  type: string; // 'text' | 'email' etc.
  required?: boolean;
  autofillSource?: string | null;
};

type Props = {
  eventId: string;
  fields?: FieldDef[]; // if omitted, uses default form
  role?: "mentor" | "judge" | "participant";
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
};

const defaultFields: FieldDef[] = [
  { question: "firstName", label: "First name", type: "text", required: true, autofillSource: "profile.firstName" },
  { question: "lastName", label: "Last name", type: "text", required: true, autofillSource: "profile.lastName" },
  { question: "email", label: "Email", type: "email", required: true, autofillSource: "profile.email" },
];

export default function RegistrationFormBuilder({ eventId, fields = defaultFields, role = "participant", onSuccess, onError }: Props) {
  const methods = useForm<Record<string, any>>({
    defaultValues: fields.reduce((acc, f, i) => ({ ...acc, [`f_${i}`]: "" }), {} as Record<string, any>),
  });
  const { handleSubmit, reset } = methods;

  const onSubmit = async (data: Record<string, any>) => {
    try {
      const answers = fields.map((f, i) => ({
        questionId: f.question || null,
        label: f.label,
        value: data[`f_${i}`],
      }));

      const payload = { role, answers };

      const resp = await apiFetch(`/events/${eventId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw err;
      }

      reset();
      onSuccess && onSuccess();
    } catch (err) {
      console.error("Registration submit error:", err);
      onError && onError(err);
    }
  };

  return (
    <Form {...methods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        {fields.map((f, i) => (
          <FormField
            key={i}
            control={methods.control}
            name={`f_${i}`}
            render={({ field }) => (
              <FormItem className="mb-3">
                <FormLabel>{f.label}</FormLabel>
                <FormControl>
                  <Input {...field} type={f.type || "text"} placeholder={f.label} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        <div className="flex items-center gap-2 mt-4">
          <Button type="submit">Register</Button>
        </div>
      </form>
    </Form>
  );
}
