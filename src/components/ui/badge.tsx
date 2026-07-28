import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Joy chip. Same recipe as `jobTypeChipClass` / `modeChipClass` in
 * joy-primitives: a pill, bold 11px label, tint background with the deep
 * ink-side of the same hue as the text (each pairing checked at 4.5:1+
 * against white and cream).
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-bold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-2 focus-visible:ring-ring/60 aria-invalid:ring-2 aria-invalid:ring-destructive/40 transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:brightness-105",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:brightness-[0.98]",
        destructive:
          "bg-destructive text-white [a&]:hover:brightness-105 focus-visible:ring-destructive/50",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        success: "bg-joy-grass/10 text-joy-grass",
        warning: "bg-joy-sun/25 text-joy-sun-ink",
        info: "bg-joy-sky/12 text-joy-sky-ink",
        muted: "bg-joy-ink/6 text-joy-ink-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
