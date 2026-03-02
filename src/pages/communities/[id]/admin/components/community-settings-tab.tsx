import { useState, useRef, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";
import { getFileUrl } from "@/lib/firebase-client";

type CommunityData = {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    description: string;
    category: string;
    logo?: string;
    banner?: string;
    logoUrl?: string;
    bannerUrl?: string;
    memberCount: number;
    members: string[];
    createdBy: string;
    createdByName: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    status: string;
};

const CATEGORIES = [
    "Academic",
    "Technology",
    "Arts & Culture",
    "Sports",
    "Business",
    "Health & Wellness",
    "Social",
    "Professional",
];

const communitySchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters").max(100),
    shortDescription: z.string().min(10, "Short description must be at least 10 characters").max(200).optional(),
    description: z.string().min(10, "Description must be at least 10 characters").max(5000),
    category: z.string().min(1, "Please select a category"),
});

type CommunityFormData = z.infer<typeof communitySchema>;

interface CommunitySettingsTabProps {
    community: CommunityData;
    onUpdate: (community: CommunityData) => void;
}

export default function CommunitySettingsTab({ community, onUpdate }: Readonly<CommunitySettingsTabProps>) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Logo state
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(community.logoUrl ?? null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Banner state
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(community.bannerUrl ?? null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    // Revoke object URLs on unmount to avoid memory leaks
    useEffect(() => {
        return () => {
            if (logoFile && logoPreview) URL.revokeObjectURL(logoPreview);
            if (bannerFile && bannerPreview) URL.revokeObjectURL(bannerPreview);
        };
    }, []);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (logoFile && logoPreview) URL.revokeObjectURL(logoPreview);
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (bannerFile && bannerPreview) URL.revokeObjectURL(bannerPreview);
        setBannerFile(file);
        setBannerPreview(URL.createObjectURL(file));
    };

    const clearLogo = () => {
        if (logoFile && logoPreview) URL.revokeObjectURL(logoPreview);
        setLogoFile(null);
        setLogoPreview(community.logoUrl ?? null);
        if (logoInputRef.current) logoInputRef.current.value = "";
    };

    const clearBanner = () => {
        if (bannerFile && bannerPreview) URL.revokeObjectURL(bannerPreview);
        setBannerFile(null);
        setBannerPreview(community.bannerUrl ?? null);
        if (bannerInputRef.current) bannerInputRef.current.value = "";
    };

    const form = useForm<CommunityFormData>({
        resolver: zodResolver(communitySchema),
        defaultValues: {
            name: community.name,
            shortDescription: community.shortDescription || "",
            description: community.description,
            category: community.category,
        },
    });

    const onSubmit = async (data: CommunityFormData) => {
        try {
            setIsSubmitting(true);

            // Always use FormData so we can attach optional image files
            const formData = new FormData();
            formData.append("name", data.name);
            formData.append("category", data.category);
            if (data.shortDescription) formData.append("shortDescription", data.shortDescription);
            formData.append("description", data.description);
            if (logoFile) formData.append("logo", logoFile);
            if (bannerFile) formData.append("banner", bannerFile);

            const response = await apiFetch(`/communities/${community.id}`, {
                method: "PATCH",
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to update community");
            }

            // Resolve new storage paths → download URLs if the backend returned them
            let newLogoUrl = community.logoUrl;
            let newBannerUrl = community.bannerUrl;
            let newLogo = community.logo;
            let newBanner = community.banner;

            if (result.logo) {
                newLogo = result.logo;
                try { newLogoUrl = await getFileUrl(result.logo); } catch { /* keep old */ }
            }
            if (result.banner) {
                newBanner = result.banner;
                try { newBannerUrl = await getFileUrl(result.banner); } catch { /* keep old */ }
            }

            // Clear pending file selections now that they're saved
            setLogoFile(null);
            setBannerFile(null);
            if (logoInputRef.current) logoInputRef.current.value = "";
            if (bannerInputRef.current) bannerInputRef.current.value = "";

            onUpdate({
                ...community,
                ...data,
                logo: newLogo,
                banner: newBanner,
                logoUrl: newLogoUrl,
                bannerUrl: newBannerUrl,
                updatedAt: Timestamp.now(),
            });

            toast.success("Community updated successfully!");
        } catch (error) {
            console.error("Error updating community:", error);
            toast.error("Failed to update community");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Community Settings</CardTitle>
                <CardDescription>
                    Update your community information and settings
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        {/* ── Images ── */}
                        <div className="space-y-4">
                            {/* Banner */}
                            <div className="space-y-2">
                                <label
                                    htmlFor="banner-input"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Banner Image
                                </label>
                                <p className="text-sm text-muted-foreground">
                                    Recommended size: 1200 × 300 px (wide, landscape)
                                </p>
                                <button
                                    type="button"
                                    aria-label="Upload banner image"
                                    className="relative w-full h-36 rounded-lg border-2 border-dashed border-muted-foreground/30 overflow-hidden cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                                    onClick={() => bannerInputRef.current?.click()}
                                >
                                    {bannerPreview ? (
                                        <img
                                            src={bannerPreview}
                                            alt="Banner preview"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                                            <Upload className="h-6 w-6" />
                                            <span className="text-sm">Click to upload banner</span>
                                        </div>
                                    )}
                                    {bannerPreview && (
                                        <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                            <span className="text-white text-sm font-medium">Change banner</span>
                                        </div>
                                    )}
                                </button>
                                {bannerFile && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span className="truncate">{bannerFile.name}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 shrink-0"
                                            onClick={clearBanner}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                                <input
                                    ref={bannerInputRef}
                                    id="banner-input"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleBannerChange}
                                />
                            </div>

                            {/* Logo */}
                            <div className="space-y-2">
                                <label
                                    htmlFor="logo-input"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Community Logo
                                </label>
                                <p className="text-sm text-muted-foreground">
                                    Recommended size: 200 × 200 px (square)
                                </p>
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        aria-label="Upload logo image"
                                        className="relative h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 overflow-hidden cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors shrink-0"
                                        onClick={() => logoInputRef.current?.click()}
                                    >
                                        {logoPreview ? (
                                            <img
                                                src={logoPreview}
                                                alt="Logo preview"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full gap-1 text-muted-foreground">
                                                <Upload className="h-4 w-4" />
                                                <span className="text-xs text-center leading-tight">Upload logo</span>
                                            </div>
                                        )}
                                        {logoPreview && (
                                            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                                <Upload className="h-4 w-4 text-white" />
                                            </div>
                                        )}
                                    </button>
                                    <div className="flex flex-col gap-1 min-w-0">
                                        {logoFile ? (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <span className="truncate">{logoFile.name}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 shrink-0"
                                                    onClick={clearLogo}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => logoInputRef.current?.click()}
                                            >
                                                <Upload className="mr-2 h-3 w-3" />
                                                {logoPreview ? "Change logo" : "Upload logo"}
                                            </Button>
                                        )}
                                        <p className="text-xs text-muted-foreground">PNG, JPG, GIF, WebP</p>
                                    </div>
                                </div>
                                <input
                                    ref={logoInputRef}
                                    id="logo-input"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleLogoChange}
                                />
                            </div>
                        </div>

                        {/* Name */}
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Community Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., Tech Enthusiasts"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        The name of your community (3-100 characters)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Category */}
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {CATEGORIES.map((category) => (
                                                <SelectItem key={category} value={category}>
                                                    {category}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Choose the category that best describes your community
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Short Description */}
                        <FormField
                            control={form.control}
                            name="shortDescription"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Short Description</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="A brief tagline for your community"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        A brief one-line description (10-200 characters)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Description */}
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Description</FormLabel>
                                    <FormControl>
                                        <RichTextEditor
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Tell people about your community..."
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Detailed description of your community (10-5000 characters)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Submit Button */}
                        <div className="flex justify-end gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => { form.reset(); clearLogo(); clearBanner(); }}
                                disabled={isSubmitting}
                            >
                                Reset
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
