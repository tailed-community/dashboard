import { useCallback, useEffect, useRef, useState } from "react";
import {
    Copy,
    Download,
    Eye,
    FileSpreadsheet,
    FileText,
    Image as ImageIcon,
    Link2 as LinkIcon,
    Loader2,
    Megaphone,
    Pencil,
    Plus,
    Presentation,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/fetch";

/**
 * "Marketing" tab of /communities/:slug/admin.
 *
 * Where a community keeps the collateral it hands to outsiders — sponsorship
 * packages, media kits, posters, one-pagers. Each upload gets a permanent,
 * account-free download link the organizer copies into an email to a sponsor,
 * so the sharing story is the same as a Drive link: anyone holding the URL can
 * download it, and deleting the file is what revokes it.
 *
 * Backed by functions/src/routes/community-marketing.ts
 * (`/communities/:communityId/marketing-assets`), which is where the size,
 * count and content-type limits mirrored below are actually enforced.
 */

type MarketingAssetKind =
    | "sponsorship-package"
    | "media-kit"
    | "brand-assets"
    | "poster"
    | "one-pager"
    | "other";

type ShareLink = {
    shareId: string;
    /** Recipient this link was minted for; null on the default link. */
    label: string | null;
    url: string;
    viewCount: number;
    downloadCount: number;
    lastViewedAt: string | null;
    lastDownloadedAt: string | null;
    revokedAt: string | null;
    createdAt: string | null;
};

type MarketingAsset = {
    id: string;
    title: string;
    description: string;
    kind: MarketingAssetKind;
    fileName: string;
    contentType: string;
    size: number;
    /** Raw Storage URL — the admin's own download, not what sponsors get. */
    downloadUrl: string | null;
    /** Branded, trackable link (community.tailed.ca/s/…). */
    shareUrl: string | null;
    links: ShareLink[];
    viewCount: number;
    downloadCount: number;
    activeLinkCount: number;
    createdAt: string | null;
    updatedAt: string | null;
};

const KIND_LABELS: Record<MarketingAssetKind, string> = {
    "sponsorship-package": "Sponsorship package",
    "media-kit": "Media kit",
    "brand-assets": "Brand assets",
    poster: "Poster / flyer",
    "one-pager": "One-pager",
    other: "Other",
};

const KIND_ORDER: MarketingAssetKind[] = [
    "sponsorship-package",
    "media-kit",
    "brand-assets",
    "poster",
    "one-pager",
    "other",
];

/** Client-side mirror of ALLOWED_CONTENT_TYPES in the backend route. */
const ACCEPTED_CONTENT_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const formatBytes = (bytes: number): string => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string | null): string => {
    if (!iso) return "—";
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
          });
};

/** Strips the extension so an auto-filled title reads like a title. */
const titleFromFileName = (fileName: string): string => {
    const withoutExtension = fileName.replace(/\.[^.]+$/, "");
    return withoutExtension.replace(/[-_]+/g, " ").trim().slice(0, 120);
};

/**
 * Views vs downloads for one asset, summed across its links.
 *
 * Counts exclude traffic we recognized as automated — corporate mail scanners
 * (Safe Links, Proofpoint) fetch every URL in an inbound email, and counting
 * those as opens would have organizers chasing sponsors who never looked.
 */
const AssetStats = ({ asset }: { asset: MarketingAsset }) => {
    if (!asset.viewCount && !asset.downloadCount) {
        return <span className="text-sm text-slate-400">Not opened yet</span>;
    }

    return (
        <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="flex items-center gap-1" title="Opens">
                <Eye className="h-3.5 w-3.5 text-slate-400" />
                {asset.viewCount}
            </span>
            <span className="flex items-center gap-1" title="Downloads">
                <Download className="h-3.5 w-3.5 text-slate-400" />
                {asset.downloadCount}
            </span>
        </div>
    );
};

const FileKindIcon = ({ contentType }: { contentType: string }) => {
    const className = "h-5 w-5 text-slate-500";
    if (contentType.startsWith("image/")) return <ImageIcon className={className} />;
    if (contentType.includes("presentation") || contentType.includes("powerpoint"))
        return <Presentation className={className} />;
    if (contentType.includes("sheet") || contentType.includes("excel"))
        return <FileSpreadsheet className={className} />;
    return <FileText className={className} />;
};

interface CommunityMarketingTabProps {
    communityId: string;
}

export default function CommunityMarketingTab({
    communityId,
}: Readonly<CommunityMarketingTabProps>) {
    const [assets, setAssets] = useState<MarketingAsset[]>([]);
    const [loading, setLoading] = useState(true);

    const [uploadOpen, setUploadOpen] = useState(false);
    const [editing, setEditing] = useState<MarketingAsset | null>(null);
    const [managingLinks, setManagingLinks] = useState<MarketingAsset | null>(null);
    const [deleting, setDeleting] = useState<MarketingAsset | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchAssets = useCallback(async () => {
        try {
            const response = await apiFetch(
                `/communities/${communityId}/marketing-assets`
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to load marketing files");
            }

            setAssets(result.assets || []);
        } catch (error) {
            console.error("Error fetching marketing assets:", error);
            toast.error(
                error instanceof Error ? error.message : "Failed to load marketing files"
            );
        }
    }, [communityId]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            await fetchAssets();
            if (!cancelled) setLoading(false);
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [fetchAssets]);

    const handleCopyLink = async (url: string | null, description: string) => {
        if (!url) {
            toast.error("This file has no share link yet");
            return;
        }

        try {
            await navigator.clipboard.writeText(url);
            toast.success("Share link copied", { description });
        } catch (error) {
            console.error("Clipboard write failed:", error);
            toast.error("Couldn't copy the link", {
                description: "Use “Download” and share the file directly instead.",
            });
        }
    };

    const handleDelete = async () => {
        if (!deleting) return;

        setIsDeleting(true);
        try {
            const response = await apiFetch(
                `/communities/${communityId}/marketing-assets/${deleting.id}`,
                { method: "DELETE" }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to delete file");
            }

            setAssets((current) => current.filter((asset) => asset.id !== deleting.id));
            toast.success("Marketing file deleted", {
                description: "Any link you shared for it no longer works.",
            });
            setDeleting(null);
        } catch (error) {
            console.error("Error deleting marketing asset:", error);
            toast.error(
                error instanceof Error ? error.message : "Failed to delete file"
            );
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                        Marketing &amp; promo files
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Sponsorship packages, media kits, posters — everything you send to
                        sponsors and partners, in one place.
                    </p>
                </div>
                <Button onClick={() => setUploadOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload file
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Your files ({assets.length})</CardTitle>
                    <CardDescription>
                        Each file gets a share link that works for anyone — no Tail&apos;ed
                        account needed. Deleting a file revokes its link.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {assets.length === 0 ? (
                        <div className="py-12 text-center">
                            <Megaphone className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                            <p className="font-medium text-slate-900">No files yet</p>
                            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                                Upload your sponsorship package so you can send it to a
                                company in one click, instead of digging through your drive.
                            </p>
                            <Button className="mt-6" onClick={() => setUploadOpen(true)}>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload your first file
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>File</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Shared</TableHead>
                                        <TableHead>Added</TableHead>
                                        <TableHead className="w-64 text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assets.map((asset) => (
                                        <TableRow key={asset.id}>
                                            <TableCell>
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 shrink-0">
                                                        <FileKindIcon
                                                            contentType={asset.contentType}
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-slate-900">
                                                            {asset.title}
                                                        </p>
                                                        {asset.description && (
                                                            <p className="mt-0.5 max-w-md text-sm text-slate-600">
                                                                {asset.description}
                                                            </p>
                                                        )}
                                                        <p className="mt-0.5 truncate font-mono text-xs text-slate-400">
                                                            {asset.fileName}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {KIND_LABELS[asset.kind] ??
                                                        KIND_LABELS.other}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                                {formatBytes(asset.size)}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                <AssetStats asset={asset} />
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                                {formatDate(asset.createdAt)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap justify-end gap-1.5">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleCopyLink(
                                                                asset.shareUrl,
                                                                "Anyone with this link can view and download the file."
                                                            )
                                                        }
                                                    >
                                                        <Copy className="mr-1.5 h-3 w-3" />
                                                        Copy link
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setManagingLinks(asset)}
                                                    >
                                                        <LinkIcon className="mr-1.5 h-3 w-3" />
                                                        Links
                                                        {asset.activeLinkCount > 1 && (
                                                            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">
                                                                {asset.activeLinkCount}
                                                            </span>
                                                        )}
                                                    </Button>
                                                    {asset.downloadUrl && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            asChild
                                                        >
                                                            <a
                                                                href={asset.downloadUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                <Download className="mr-1.5 h-3 w-3" />
                                                                Download
                                                            </a>
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        aria-label={`Edit ${asset.title}`}
                                                        onClick={() => setEditing(asset)}
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        aria-label={`Delete ${asset.title}`}
                                                        onClick={() => setDeleting(asset)}
                                                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <UploadAssetDialog
                communityId={communityId}
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onUploaded={(asset) => setAssets((current) => [asset, ...current])}
            />

            <ShareLinksDialog
                communityId={communityId}
                asset={managingLinks}
                onOpenChange={(open) => {
                    if (!open) setManagingLinks(null);
                }}
                onCopy={handleCopyLink}
                onAssetChange={(updated) => {
                    setAssets((current) =>
                        current.map((asset) =>
                            asset.id === updated.id ? updated : asset
                        )
                    );
                    setManagingLinks(updated);
                }}
            />

            <EditAssetDialog
                communityId={communityId}
                asset={editing}
                onOpenChange={(open) => {
                    if (!open) setEditing(null);
                }}
                onUpdated={(updated) =>
                    setAssets((current) =>
                        current.map((asset) =>
                            asset.id === updated.id ? updated : asset
                        )
                    )
                }
            />

            <AlertDialog
                open={Boolean(deleting)}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) setDeleting(null);
                }}
            >
                <AlertDialogContent style={{ colorScheme: "light" }}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{deleting?.title}&rdquo; will be permanently removed, and
                            any share link you already sent will stop working. This
                            can&apos;t be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                // Keep the dialog up while the request is in flight.
                                event.preventDefault();
                                handleDelete();
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete file"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

/* ---------------------------- Share links dialog -------------------------- */

/**
 * Per-recipient links for one asset.
 *
 * The default (unlabeled) link is what "Copy link" in the table hands you.
 * Minting one link per company you pitch is what turns an anonymous "4 opens"
 * into "Desjardins opened it twice, Hydro-Québec never did" — attribution by
 * link, not by person: sponsors forward decks internally.
 */
function ShareLinksDialog({
    communityId,
    asset,
    onOpenChange,
    onCopy,
    onAssetChange,
}: Readonly<{
    communityId: string;
    asset: MarketingAsset | null;
    onOpenChange: (open: boolean) => void;
    onCopy: (url: string | null, description: string) => void;
    onAssetChange: (asset: MarketingAsset) => void;
}>) {
    const [label, setLabel] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [revoking, setRevoking] = useState<string | null>(null);

    useEffect(() => {
        if (asset) setLabel("");
    }, [asset?.id]);

    // Every hook above runs unconditionally, so bailing out here is safe.
    if (!asset) return null;

    const applyLinks = (links: ShareLink[]) => {
        const active = links.filter((link) => !link.revokedAt);
        onAssetChange({
            ...asset,
            links,
            activeLinkCount: active.length,
            viewCount: links.reduce((total, link) => total + link.viewCount, 0),
            downloadCount: links.reduce(
                (total, link) => total + link.downloadCount,
                0
            ),
        });
    };

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault();
        if (label.trim().length < 1) return;

        setIsCreating(true);
        try {
            const response = await apiFetch(
                `/communities/${communityId}/marketing-assets/${asset.id}/links`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ label: label.trim() }),
                }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to create link");
            }

            const created = result.link as ShareLink;
            applyLinks([...asset.links, created]);
            setLabel("");
            onCopy(
                created.url,
                `Link for ${created.label} copied — send this one to them.`
            );
        } catch (error) {
            console.error("Error creating share link:", error);
            toast.error(
                error instanceof Error ? error.message : "Failed to create link"
            );
        } finally {
            setIsCreating(false);
        }
    };

    const handleRevoke = async (link: ShareLink) => {
        setRevoking(link.shareId);
        try {
            const response = await apiFetch(
                `/communities/${communityId}/marketing-assets/${asset.id}/links/${link.shareId}/revoke`,
                { method: "POST" }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to revoke link");
            }

            applyLinks(
                asset.links.map((existing) =>
                    existing.shareId === link.shareId
                        ? (result.link as ShareLink)
                        : existing
                )
            );
            toast.success("Link revoked", {
                description: "It now shows a “turned off” page instead of the file.",
            });
        } catch (error) {
            console.error("Error revoking share link:", error);
            toast.error(
                error instanceof Error ? error.message : "Failed to revoke link"
            );
        } finally {
            setRevoking(null);
        }
    };

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Share links — {asset.title}</DialogTitle>
                    <DialogDescription>
                        Create one link per company you pitch, and you&apos;ll see which
                        of them actually opened your package.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-96 space-y-2 overflow-y-auto">
                    {asset.links.map((link) => (
                        <div
                            key={link.shareId}
                            className={cn(
                                "rounded-xl border border-slate-200 p-3",
                                link.revokedAt && "bg-slate-50 opacity-60"
                            )}
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-900">
                                        {link.label ?? "General link"}
                                        {link.revokedAt && (
                                            <Badge
                                                variant="outline"
                                                className="ml-2 text-[11px]"
                                            >
                                                Revoked
                                            </Badge>
                                        )}
                                    </p>
                                    <p className="mt-0.5 truncate font-mono text-xs text-slate-400">
                                        {link.url}
                                    </p>
                                    <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-600">
                                        <span className="flex items-center gap-1">
                                            <Eye className="h-3 w-3 text-slate-400" />
                                            {link.viewCount} open
                                            {link.viewCount === 1 ? "" : "s"}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Download className="h-3 w-3 text-slate-400" />
                                            {link.downloadCount} download
                                            {link.downloadCount === 1 ? "" : "s"}
                                        </span>
                                        {link.lastViewedAt && (
                                            <span className="text-slate-400">
                                                last opened {formatDate(link.lastViewedAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-1.5">
                                    {!link.revokedAt && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    onCopy(
                                                        link.url,
                                                        link.label
                                                            ? `Link for ${link.label} copied.`
                                                            : "Anyone with this link can view and download the file."
                                                    )
                                                }
                                            >
                                                <Copy className="mr-1.5 h-3 w-3" />
                                                Copy
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={revoking === link.shareId}
                                                onClick={() => handleRevoke(link)}
                                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                            >
                                                {revoking === link.shareId ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    "Revoke"
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <form onSubmit={handleCreate} className="flex items-end gap-2 border-t pt-4">
                    <div className="flex-1 space-y-2">
                        <Label htmlFor="share-link-label">New link for</Label>
                        <Input
                            id="share-link-label"
                            value={label}
                            maxLength={80}
                            disabled={isCreating}
                            placeholder="e.g., Desjardins"
                            onChange={(event) => setLabel(event.target.value)}
                        />
                    </div>
                    <Button type="submit" disabled={isCreating || !label.trim()}>
                        {isCreating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Plus className="mr-1.5 h-4 w-4" />
                                Create
                            </>
                        )}
                    </Button>
                </form>

                <p className="text-xs text-slate-500">
                    Opens are counted server-side and exclude traffic we can identify as
                    automated — corporate mail scanners fetch every link in an email.
                    Treat a single open as a signal, not proof.
                </p>
            </DialogContent>
        </Dialog>
    );
}

/* ------------------------------ Upload dialog ----------------------------- */

function UploadAssetDialog({
    communityId,
    open,
    onOpenChange,
    onUploaded,
}: Readonly<{
    communityId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUploaded: (asset: MarketingAsset) => void;
}>) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [kind, setKind] = useState<MarketingAssetKind>("sponsorship-package");
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const reset = () => {
        setFile(null);
        setTitle("");
        setDescription("");
        setKind("sponsorship-package");
        setError(null);
        setDragging(false);
        if (inputRef.current) inputRef.current.value = "";
    };

    const acceptFile = (picked: File | undefined) => {
        if (!picked) return;
        setError(null);

        if (picked.size > MAX_FILE_BYTES) {
            setError("That file is larger than 25MB. Try compressing the PDF first.");
            return;
        }
        // Some browsers report an empty type for less common Office files; let
        // those through and rely on the backend allowlist to be the authority.
        if (picked.type && !ACCEPTED_CONTENT_TYPES.includes(picked.type)) {
            setError(
                "Unsupported file type. Upload a PDF, image, Word, PowerPoint or Excel file."
            );
            return;
        }

        setFile(picked);
        // Only auto-fill an untouched title, so re-picking a file doesn't
        // clobber a title the organizer already wrote.
        setTitle((current) => current || titleFromFileName(picked.name));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!file) {
            setError("Choose a file to upload.");
            return;
        }
        if (title.trim().length < 2) {
            setError("Give this file a name so your team recognizes it.");
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("title", title.trim());
            formData.append("description", description.trim());
            formData.append("kind", kind);
            formData.append("file", file);

            const response = await apiFetch(
                `/communities/${communityId}/marketing-assets`,
                { method: "POST", body: formData }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to upload file");
            }

            onUploaded(result.asset as MarketingAsset);
            toast.success("File uploaded", {
                description: "Copy its share link whenever you need to send it out.",
            });
            reset();
            onOpenChange(false);
        } catch (uploadError) {
            console.error("Error uploading marketing asset:", uploadError);
            const message =
                uploadError instanceof Error
                    ? uploadError.message
                    : "Failed to upload file";
            setError(message);
            toast.error(message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (isUploading) return;
                if (!next) reset();
                onOpenChange(next);
            }}
        >
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Upload a marketing file</DialogTitle>
                    <DialogDescription>
                        Sponsorship packages, media kits, posters and one-pagers. PDF,
                        images, Word, PowerPoint or Excel, up to 25MB.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <input
                        ref={inputRef}
                        id="marketing-file-input"
                        type="file"
                        className="sr-only"
                        accept={ACCEPTED_CONTENT_TYPES.join(",")}
                        onChange={(event) => acceptFile(event.target.files?.[0])}
                    />

                    {!file ? (
                        <button
                            type="button"
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
                                    : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                            )}
                        >
                            <div className="rounded-full bg-slate-100 p-3">
                                <Upload className="h-5 w-5 text-slate-500" />
                            </div>
                            <span className="text-sm font-medium text-slate-900">
                                Drag a file here, or click to browse
                            </span>
                            <span className="text-xs text-slate-500">
                                PDF, images, Word, PowerPoint or Excel — up to 25MB
                            </span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                            <FileKindIcon contentType={file.type} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-slate-900">
                                    {file.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {formatBytes(file.size)}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isUploading}
                                onClick={() => {
                                    setFile(null);
                                    if (inputRef.current) inputRef.current.value = "";
                                }}
                                aria-label="Remove selected file"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="marketing-title">Name</Label>
                        <Input
                            id="marketing-title"
                            value={title}
                            maxLength={120}
                            disabled={isUploading}
                            placeholder="e.g., 2026 Sponsorship Package"
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="marketing-kind">Category</Label>
                        <Select
                            value={kind}
                            disabled={isUploading}
                            onValueChange={(value) =>
                                setKind(value as MarketingAssetKind)
                            }
                        >
                            <SelectTrigger id="marketing-kind">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                {KIND_ORDER.map((value) => (
                                    <SelectItem key={value} value={value}>
                                        {KIND_LABELS[value]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="marketing-description">
                            Description{" "}
                            <span className="font-normal text-slate-500">(optional)</span>
                        </Label>
                        <Textarea
                            id="marketing-description"
                            value={description}
                            maxLength={600}
                            rows={3}
                            disabled={isUploading}
                            placeholder="What's in it, and who it's for — e.g. “Tiers, audience stats and past partners for the fall semester.”"
                            onChange={(event) => setDescription(event.target.value)}
                        />
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isUploading}
                            onClick={() => {
                                reset();
                                onOpenChange(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isUploading || !file}>
                            {isUploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/* ------------------------------- Edit dialog ------------------------------ */

function EditAssetDialog({
    communityId,
    asset,
    onOpenChange,
    onUpdated,
}: Readonly<{
    communityId: string;
    asset: MarketingAsset | null;
    onOpenChange: (open: boolean) => void;
    onUpdated: (asset: MarketingAsset) => void;
}>) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [kind, setKind] = useState<MarketingAssetKind>("other");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Re-seed the form each time a different asset is opened for editing.
    useEffect(() => {
        if (!asset) return;
        setTitle(asset.title);
        setDescription(asset.description ?? "");
        setKind(asset.kind);
        setError(null);
    }, [asset]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!asset) return;

        if (title.trim().length < 2) {
            setError("Give this file a name so your team recognizes it.");
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const response = await apiFetch(
                `/communities/${communityId}/marketing-assets/${asset.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: title.trim(),
                        description: description.trim(),
                        kind,
                    }),
                }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to update file");
            }

            onUpdated(result.asset as MarketingAsset);
            toast.success("File details updated");
            onOpenChange(false);
        } catch (saveError) {
            console.error("Error updating marketing asset:", saveError);
            const message =
                saveError instanceof Error ? saveError.message : "Failed to update file";
            setError(message);
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog
            open={Boolean(asset)}
            onOpenChange={(next) => {
                if (isSaving) return;
                onOpenChange(next);
            }}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit file details</DialogTitle>
                    <DialogDescription>
                        Renaming is metadata only — the file itself and its share link stay
                        the same. To swap the file, upload a new one and delete this.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="marketing-edit-title">Name</Label>
                        <Input
                            id="marketing-edit-title"
                            value={title}
                            maxLength={120}
                            disabled={isSaving}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="marketing-edit-kind">Category</Label>
                        <Select
                            value={kind}
                            disabled={isSaving}
                            onValueChange={(value) => setKind(value as MarketingAssetKind)}
                        >
                            <SelectTrigger id="marketing-edit-kind">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                {KIND_ORDER.map((value) => (
                                    <SelectItem key={value} value={value}>
                                        {KIND_LABELS[value]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="marketing-edit-description">
                            Description{" "}
                            <span className="font-normal text-slate-500">(optional)</span>
                        </Label>
                        <Textarea
                            id="marketing-edit-description"
                            value={description}
                            maxLength={600}
                            rows={3}
                            disabled={isSaving}
                            onChange={(event) => setDescription(event.target.value)}
                        />
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isSaving}
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save changes"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
