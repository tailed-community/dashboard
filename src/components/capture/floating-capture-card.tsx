import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingCaptureCardProps {
  icon: LucideIcon;
  title: string;
  onDismiss: () => void;
  /**
   * True while another capture surface is in the viewport. While true, the
   * card fades/slides out of view instead of unmounting, so it can transition
   * back in once the other surface scrolls out of view.
   */
  suppressed?: boolean;
  children: React.ReactNode;
}

/**
 * Small, easily-dismissible bottom-right card used by capture surfaces
 * (digest prompt, save-job prompt) to offer an email capture without ever
 * blocking browsing.
 */
export function FloatingCaptureCard({
  icon: Icon,
  title,
  onDismiss,
  suppressed = false,
  children,
}: FloatingCaptureCardProps) {
  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-brand-cream-200 dark:border-brand-cream-800 bg-white dark:bg-brand-cream-950 shadow-xl p-4 transition-all duration-300 ease-out",
        suppressed
          ? "opacity-0 translate-y-4 pointer-events-none"
          : "opacity-100 translate-y-0 animate-in fade-in slide-in-from-bottom-4"
      )}
      aria-hidden={suppressed}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 p-1 rounded-full text-brand-cream-400 hover:text-brand-cream-700 dark:hover:text-brand-cream-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
      <div className="flex items-start gap-2 mb-2 pr-5">
        <Icon className="w-4 h-4 text-brand-orange mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm font-semibold text-brand-cream-950 dark:text-brand-cream-50">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}
