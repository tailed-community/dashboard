import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Joy button. Same shape language as `PlaygroundButton`: rounded-xl, bold
 * label, and a solid bottom edge on the filled variants that collapses when
 * pressed (`.joy-press`, defined in index.css). `--joy-press-edge` sets the
 * edge colour per variant.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 aria-invalid:ring-2 aria-invalid:ring-destructive/40 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "joy-press [--joy-press-edge:var(--joy-grass-deep)] bg-primary text-primary-foreground hover:brightness-105",
        destructive:
          "joy-press [--joy-press-edge:var(--destructive-deep)] bg-destructive text-white hover:brightness-105 focus-visible:ring-destructive/50",
        outline:
          "border-2 border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent/40 active:translate-y-px",
        secondary:
          "joy-press bg-secondary text-secondary-foreground hover:brightness-[0.98]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:translate-y-px",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm: "h-9 gap-1.5 px-3.5 has-[>svg]:px-3",
        lg: "h-11 px-6 text-base has-[>svg]:px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
