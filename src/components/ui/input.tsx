import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Joy field: rounded-xl, hairline ink border, cream fill — matches the
        // search input on the jobs board.
        "file:text-foreground placeholder:text-joy-ink/35 selection:bg-primary selection:text-primary-foreground border-input bg-background flex h-10 w-full min-w-0 rounded-xl border px-3.5 py-2 text-base transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-bold disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "hover:border-joy-ink/25 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/60",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  );
}

export { Input };
