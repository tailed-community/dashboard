import * as React from "react";
import { Calendar, Crop, ImageIcon, Trash2, Upload, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ImageCropperDialog } from "@/components/ui/image-cropper";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Each variant mirrors how the image is *actually* rendered in production, so
 * the mockups below are a truthful preview rather than a decorative one.
 * Keep these in sync with the display sites referenced in each comment.
 */
type Variant =
    | "event-hero"
    | "event-schedule"
    | "community-logo"
    | "community-banner";

type VariantConfig = {
    /** Fixed crop ratio, or undefined for a free-form crop. */
    aspect?: number;
    recommendation: string;
    cropTitle: string;
    /** Frame used for the primary inline preview. */
    frameClassName: string;
    imageFit: "cover" | "contain";
};

const VARIANTS: Record<Variant, VariantConfig> = {
    // Rendered 1:1 on the event detail page (events/[id]/page.tsx) and as a
    // full-bleed card background on the events listing.
    "event-hero": {
        aspect: 1,
        recommendation: "Square image, at least 800×800px. JPG or PNG, up to 5MB.",
        cropTitle: "Crop your cover image",
        frameClassName: "aspect-square w-40",
        imageFit: "cover",
    },
    // Rendered full width with object-contain, so the natural ratio is kept.
    "event-schedule": {
        aspect: undefined,
        recommendation:
            "Any shape — tall schedules work well. Keep text large enough to read. Up to 5MB.",
        cropTitle: "Trim your schedule image",
        frameClassName: "w-full",
        imageFit: "contain",
    },
    // Rendered 1:1 on the community page and as a 48px tile in the grid.
    "community-logo": {
        aspect: 1,
        recommendation: "Square image, at least 400×400px. JPG or PNG, up to 5MB.",
        cropTitle: "Crop your logo",
        frameClassName: "aspect-square w-32",
        imageFit: "cover",
    },
    // Rendered as a full-width banner (h-64 / md:h-80) with object-cover.
    "community-banner": {
        aspect: 16 / 5,
        recommendation: "Wide image, at least 1600×500px. JPG or PNG, up to 5MB.",
        cropTitle: "Crop your banner",
        frameClassName: "w-full aspect-[16/5]",
        imageFit: "cover",
    },
};

/** Small, faithful mockups of where the image shows up on the live site. */
function ContextPreviews({ variant, src }: { variant: Variant; src: string }) {
    if (variant === "event-hero") {
        return (
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <p className="mb-2 text-xs font-medium text-slate-500">
                        On the event page
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <img
                            src={src}
                            alt="Event page preview"
                            className="w-full aspect-square rounded-2xl object-cover"
                        />
                        <div className="mt-3 space-y-1.5">
                            <div className="h-2.5 w-3/4 rounded bg-slate-200" />
                            <div className="h-2 w-1/2 rounded bg-slate-100" />
                        </div>
                    </div>
                </div>
                <div>
                    <p className="mb-2 text-xs font-medium text-slate-500">
                        In the events list
                    </p>
                    <div className="relative overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10">
                        <img
                            src={src}
                            alt="Event card preview"
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-slate-900/5" />
                        <div className="relative flex h-full flex-col justify-end gap-2 p-4 pt-16">
                            <div className="h-2.5 w-2/3 rounded bg-white/80" />
                            <div className="h-2 w-1/3 rounded bg-white/40" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (variant === "event-schedule") {
        return (
            <div>
                <p className="mb-2 text-xs font-medium text-slate-500">
                    On the event page, under “Schedule”
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <div className="h-2.5 w-24 rounded bg-slate-200" />
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <img
                            src={src}
                            alt="Schedule preview"
                            className="h-auto w-full object-contain"
                        />
                    </div>
                </div>
            </div>
        );
    }

    if (variant === "community-logo") {
        return (
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <p className="mb-2 text-xs font-medium text-slate-500">
                        On the community page
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <img
                            src={src}
                            alt="Community page preview"
                            className="w-full aspect-square rounded-2xl object-cover"
                        />
                    </div>
                </div>
                <div>
                    <p className="mb-2 text-xs font-medium text-slate-500">
                        In the communities grid
                    </p>
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                        <div className="flex items-start gap-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-slate-900/10">
                                <img
                                    src={src}
                                    alt="Community tile preview"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <div className="mt-1 flex-1 space-y-2">
                                <div className="h-2.5 w-2/3 rounded bg-slate-200" />
                                <div className="h-2 w-1/2 rounded bg-slate-100" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <p className="mb-2 text-xs font-medium text-slate-500">
                At the top of your community page
            </p>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img
                    src={src}
                    alt="Community banner preview"
                    className="h-28 w-full object-cover"
                />
                <div className="flex items-start gap-3 p-4">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" />
                    <div className="mt-1 flex-1 space-y-2">
                        <div className="h-2.5 w-1/2 rounded bg-slate-200" />
                        <div className="h-2 w-1/3 rounded bg-slate-100" />
                    </div>
                </div>
            </div>
        </div>
    );
}

type ImageUploadFieldProps = {
    variant: Variant;
    /** The pending file, if the user has picked one this session. */
    value?: File;
    onChange: (file: File | undefined) => void;
    /** Already-saved image URL, for edit forms. */
    existingUrl?: string;
    /** Called when the user clears an already-saved image. */
    onRemoveExisting?: () => void;
    disabled?: boolean;
    id?: string;
};

export function ImageUploadField({
    variant,
    value,
    onChange,
    existingUrl,
    onRemoveExisting,
    disabled,
    id,
}: ImageUploadFieldProps) {
    const config = VARIANTS[variant];
    const inputRef = React.useRef<HTMLInputElement>(null);

    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    /** The untouched source, kept so "Adjust crop" re-crops the original. */
    const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
    const [cropperOpen, setCropperOpen] = React.useState(false);
    const [dragging, setDragging] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Keep the preview in step with the file, and never leak object URLs.
    React.useEffect(() => {
        if (!value) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(value);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [value]);

    React.useEffect(() => {
        return () => {
            if (sourceUrl) URL.revokeObjectURL(sourceUrl);
        };
    }, [sourceUrl]);

    const acceptFile = (file: File | undefined) => {
        if (!file) return;
        setError(null);

        if (!file.type.startsWith("image/")) {
            setError("That file isn’t an image. Please choose a JPG, PNG, or WebP.");
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            setError("That image is larger than 5MB. Please choose a smaller file.");
            return;
        }

        if (sourceUrl) URL.revokeObjectURL(sourceUrl);
        const url = URL.createObjectURL(file);
        setSourceUrl(url);

        if (config.aspect) {
            // Fixed-ratio images are cropped up front so what the user sees in
            // the preview is exactly what gets uploaded.
            setCropperOpen(true);
        } else {
            onChange(file);
        }
    };

    const clear = () => {
        // With a pending file over a saved image, "Remove" discards the pending
        // pick and falls back to the saved one — it does not delete the saved
        // image. Only a second Remove (nothing pending) deletes that.
        const hadPendingFile = Boolean(value);

        onChange(undefined);
        setError(null);
        if (sourceUrl) {
            URL.revokeObjectURL(sourceUrl);
            setSourceUrl(null);
        }
        if (inputRef.current) inputRef.current.value = "";
        if (existingUrl && !hadPendingFile) onRemoveExisting?.();
    };

    const displayUrl = previewUrl ?? existingUrl ?? null;

    return (
        <div className="space-y-4">
            <input
                ref={inputRef}
                id={id}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={disabled}
                onChange={(event) => acceptFile(event.target.files?.[0])}
            />

            {!displayUrl ? (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        acceptFile(event.dataTransfer.files?.[0]);
                    }}
                    className={cn(
                        "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                        dragging
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50",
                        disabled && "cursor-not-allowed opacity-60"
                    )}
                >
                    <div className="rounded-full bg-slate-100 p-3">
                        <Upload className="h-5 w-5 text-slate-500" />
                    </div>
                    <span className="text-sm font-medium text-slate-900">
                        Drag an image here, or click to browse
                    </span>
                    <span className="text-xs text-slate-500">
                        {config.recommendation}
                    </span>
                </button>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-start gap-4">
                        <div
                            className={cn(
                                "shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50",
                                config.frameClassName,
                                variant === "event-schedule" && "max-w-xs"
                            )}
                        >
                            <img
                                src={displayUrl}
                                alt="Selected image"
                                className={cn(
                                    "h-full w-full",
                                    config.imageFit === "cover"
                                        ? "object-cover"
                                        : "object-contain"
                                )}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={disabled}
                                onClick={() => inputRef.current?.click()}
                            >
                                <ImageIcon className="mr-2 h-4 w-4" />
                                Replace
                            </Button>
                            {sourceUrl && config.aspect && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={disabled}
                                    onClick={() => setCropperOpen(true)}
                                >
                                    <Crop className="mr-2 h-4 w-4" />
                                    Adjust crop
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={disabled}
                                onClick={clear}
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Users className="h-3.5 w-3.5" />
                            How attendees will see it
                        </p>
                        <ContextPreviews variant={variant} src={displayUrl} />
                    </div>
                </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <ImageCropperDialog
                open={cropperOpen}
                onOpenChange={(open) => {
                    setCropperOpen(open);
                    // Backing out before the first crop leaves nothing selected.
                    if (!open && !value && inputRef.current) inputRef.current.value = "";
                }}
                imageSrc={sourceUrl}
                aspect={config.aspect}
                title={config.cropTitle}
                description="Drag to reposition and use the slider to zoom. This is exactly how your image will be cropped."
                fileName={`${variant}.jpg`}
                onCropped={(file) => onChange(file)}
            />
        </div>
    );
}
