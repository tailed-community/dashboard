import * as React from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Loader2, RotateCcw, RotateCw, ZoomIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

/** Longest edge of the exported image. Keeps uploads sane without visible loss. */
const MAX_OUTPUT_EDGE = 1600;

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", (error) => reject(error));
        image.src = src;
    });
}

/**
 * Renders the selected crop area to a canvas and returns it as a File, so the
 * result slots straight into the existing multipart upload.
 */
export async function cropImageToFile(
    imageSrc: string,
    area: Area,
    rotation: number,
    fileName: string,
    mimeType = "image/jpeg"
): Promise<File> {
    const image = await loadImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get a 2D canvas context");

    // Draw the rotated source onto an intermediate canvas first, so the crop
    // rectangle react-easy-crop reports lines up with the pixels we sample.
    const radians = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const boxWidth = image.width * cos + image.height * sin;
    const boxHeight = image.width * sin + image.height * cos;

    const rotated = document.createElement("canvas");
    const rotatedCtx = rotated.getContext("2d");
    if (!rotatedCtx) throw new Error("Could not get a 2D canvas context");
    rotated.width = boxWidth;
    rotated.height = boxHeight;
    rotatedCtx.translate(boxWidth / 2, boxHeight / 2);
    rotatedCtx.rotate(radians);
    rotatedCtx.drawImage(image, -image.width / 2, -image.height / 2);

    const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(area.width, area.height));
    canvas.width = Math.round(area.width * scale);
    canvas.height = Math.round(area.height * scale);

    ctx.drawImage(
        rotated,
        area.x,
        area.y,
        area.width,
        area.height,
        0,
        0,
        canvas.width,
        canvas.height
    );

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mimeType, 0.92)
    );
    if (!blob) throw new Error("Could not export the cropped image");

    return new File([blob], fileName, { type: mimeType });
}

type ImageCropperDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Object URL or data URL of the image being cropped. */
    imageSrc: string | null;
    /** Width / height. Omit for a free-form crop. */
    aspect?: number;
    title?: string;
    description?: string;
    fileName?: string;
    onCropped: (file: File) => void;
};

export function ImageCropperDialog({
    open,
    onOpenChange,
    imageSrc,
    aspect,
    title = "Crop your image",
    description,
    fileName = "image.jpg",
    onCropped,
}: ImageCropperDialogProps) {
    const [crop, setCrop] = React.useState({ x: 0, y: 0 });
    const [zoom, setZoom] = React.useState(1);
    const [rotation, setRotation] = React.useState(0);
    const [area, setArea] = React.useState<Area | null>(null);
    const [saving, setSaving] = React.useState(false);

    // Reset the transform whenever a new image is opened, otherwise the second
    // image inherits the first one's pan/zoom.
    React.useEffect(() => {
        if (open) {
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setRotation(0);
            setArea(null);
        }
    }, [open, imageSrc]);

    const handleSave = async () => {
        if (!imageSrc || !area) return;
        setSaving(true);
        try {
            const file = await cropImageToFile(imageSrc, area, rotation, fileName);
            onCropped(file);
            onOpenChange(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>

                <div className="relative h-[360px] w-full overflow-hidden rounded-lg bg-slate-900">
                    {imageSrc && (
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            rotation={rotation}
                            aspect={aspect}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onRotationChange={setRotation}
                            onCropComplete={(_, croppedAreaPixels) =>
                                setArea(croppedAreaPixels)
                            }
                        />
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <ZoomIn className="h-4 w-4 shrink-0 text-slate-400" />
                        <Slider
                            value={[zoom]}
                            min={1}
                            max={4}
                            step={0.01}
                            onValueChange={([next]) => setZoom(next)}
                            aria-label="Zoom"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setRotation((value) => (value - 90 + 360) % 360)}
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Rotate left
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setRotation((value) => (value + 90) % 360)}
                        >
                            <RotateCw className="mr-2 h-4 w-4" />
                            Rotate right
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={!area || saving}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Apply crop"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
