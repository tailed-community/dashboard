import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Mirrors <Input>'s joy treatment so a form reads as one control set.
        "border-input placeholder:text-joy-ink/35 bg-background flex field-sizing-content min-h-20 w-full rounded-xl border px-3.5 py-2.5 text-base transition-[color,box-shadow,border-color] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "hover:border-joy-ink/25 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/60",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
