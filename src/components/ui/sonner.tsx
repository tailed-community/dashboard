import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  // default value = "light"
  // we don't have dark mode yet
  // const { theme = "system" } = useTheme();

  return (
    <Sonner
      // theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          // Joy silhouette: same 2xl radius as cards and dialogs.
          "--border-radius": "1rem",
          "--success-bg": "var(--joy-mint)",
          "--success-text": "var(--joy-grass)",
          "--success-border": "var(--joy-grass)",
          "--error-bg": "var(--card)",
          "--error-text": "var(--destructive)",
          "--error-border": "var(--destructive)",
        } as React.CSSProperties
      }
      toastOptions={{ className: "font-joy-body font-semibold" }}
      {...props}
    />
  );
};

export { Toaster };
