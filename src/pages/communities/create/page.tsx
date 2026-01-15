import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Users, Loader2, Upload, Image as ImageIcon } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useAuth } from "@/hooks/use-auth";

// Zod schema for community validation
const communitieschema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name must be less than 100 characters"),
    slug: z.string()
        .min(3, "Slug must be at least 3 characters")
        .max(100, "Slug must be less than 100 characters")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only"),
    shortDescription: z.string().min(10, "Short description must be at least 10 characters").max(200, "Short description must be less than 200 characters"),
    description: z.string().min(10, "Description must be at least 10 characters").max(5000, "Description must be less than 5000 characters"),
    category: z.string().min(1, "Category is required"),
    logo: z.instanceof(File).optional(),
    banner: z.instanceof(File).optional(),
});

type CommunityFormData = z.infer<typeof communitieschema>;

const categories = [
    "Academic",
    "Technology",
    "Arts & Culture",
    "Sports",
    "Business",
    "Health & Wellness",
    "Social",
    "Professional",
];

export default function CreateCommunityPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);

    const form = useForm<CommunityFormData>({
        resolver: zodResolver(communitieschema),
        defaultValues: {
            name: "",
            slug: "",
            shortDescription: "",
            description: "",
            category: "",
        },
    });

    // Auto-generate slug from name
    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    };

    const onSubmit = async (data: CommunityFormData) => {
        if (!user) {
            toast.error("You must be signed in to create a community");
            return;
        }

        setIsSubmitting(true);

        try {
            // Build FormData for multipart/form-data request
            const formData = new FormData();
            
            // Append all text fields
            formData.append("name", data.name);
            formData.append("slug", data.slug);
            formData.append("shortDescription", data.shortDescription);
            formData.append("description", data.description);
            formData.append("category", data.category);

            // Append optional file fields
            if (data.logo) {
                formData.append("logo", data.logo);
            }
            if (data.banner) {
                formData.append("banner", data.banner);
            }

            // Call API endpoint (always uses multipart/form-data)
            const response = await apiFetch("/communities", {
                method: "POST",
                body: formData,
                // Don't set Content-Type header - browser sets it with boundary
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to create community");
            }

            toast.success("Community created successfully!", {
                description: "Your community has been published.",
            });

            navigate("/communities");
        } catch (error) {
            console.error("Error creating community:", error);
            toast.error("Failed to create community", {
                description: error instanceof Error ? error.message : "Please try again",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Redirect if not authenticated
    if (!user) {
        return (
            <div className="min-h-screen bg-brand-cream flex items-center justify-center px-4">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>Authentication Required</CardTitle>
                        <CardDescription>
                            Please sign in to create an community
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate("/sign-in")} className="w-full">
                            Sign In
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-slate-900">Create New Community</h1>
                    <p className="mt-2 text-slate-600">
                        Start a new community or club to connect with like-minded people
                    </p>
                </div>

                {/* Form */}
                <Card className="border-slate-200/80 bg-white shadow-soft-xl">
                    <CardHeader>
                        <CardTitle>Community Details</CardTitle>
                        <CardDescription>
                            All fields marked with * are required
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {/* Community Name */}
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Community Name *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="AI Enthusiasts Club"
                                                    {...field}
                                                    onChange={(e) => {
                                                        field.onChange(e);
                                                        // Auto-generate slug if slug is empty
                                                        if (!form.getValues("slug")) {
                                                            form.setValue("slug", generateSlug(e.target.value));
                                                        }
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Slug */}
                                <FormField
                                    control={form.control}
                                    name="slug"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>URL Slug *</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-slate-500">tailed.ca/communities/</span>
                                                    <Input
                                                        placeholder="ai-enthusiasts-club"
                                                        {...field}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormDescription>
                                                A unique URL-friendly identifier (lowercase letters, numbers, and hyphens only)
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
                                            <FormLabel>Short Description *</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="A brief tagline or summary of your community..."
                                                    rows={2}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                A concise summary shown in community listings (10-200 characters)
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
                                            <FormLabel>Description *</FormLabel>
                                            <FormControl>
                                                <RichTextEditor
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Tell people what your community is about..."
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Describe your community's purpose and activities
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
                                            <FormLabel>Category *</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {categories.map((cat) => (
                                                        <SelectItem key={cat} value={cat}>
                                                            {cat}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Logo Upload */}
                                <FormField
                                    control={form.control}
                                    name="logo"
                                    render={({ field: { value, onChange, ...field } }) => (
                                        <FormItem>
                                            <FormLabel>Community Logo</FormLabel>
                                            <FormControl>
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-4">
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    onChange(file);
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => {
                                                                        setLogoPreview(reader.result as string);
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                            {...field}
                                                        />
                                                    </div>
                                                    {logoPreview && (
                                                        <div className="relative h-32 w-32 rounded-lg border-2 border-slate-200 overflow-hidden">
                                                            <img
                                                                src={logoPreview}
                                                                alt="Logo preview"
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </FormControl>
                                            <FormDescription>
                                                Upload a logo for your community (square images work best)
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Banner Upload */}
                                <FormField
                                    control={form.control}
                                    name="banner"
                                    render={({ field: { value, onChange, ...field } }) => (
                                        <FormItem>
                                            <FormLabel>Banner Image</FormLabel>
                                            <FormControl>
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-4">
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    onChange(file);
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => {
                                                                        setBannerPreview(reader.result as string);
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                            {...field}
                                                        />
                                                    </div>
                                                    {bannerPreview && (
                                                        <div className="relative h-44 w-full rounded-lg border-2 border-slate-200 overflow-hidden">
                                                            <img
                                                                src={bannerPreview}
                                                                alt="Banner preview"
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </FormControl>
                                            <FormDescription>
                                                Upload a banner image for your community card
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Preview */}
                                {form.watch("name") && (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                        <p className="mb-3 text-sm font-semibold text-slate-700">Preview</p>
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm border-2 border-slate-200 overflow-hidden bg-white">
                                                {logoPreview ? (
                                                    <img
                                                        src={logoPreview}
                                                        alt="Logo preview"
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                                                        <span className="text-slate-600 font-bold text-xl">
                                                            {form.watch("name")?.charAt(0).toUpperCase() || "A"}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">
                                                    {form.watch("name") || "Community Name"}
                                                </p>
                                                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                                    <Users className="h-4 w-4" />
                                                    <span>1 member</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Submit Buttons */}
                                <div className="flex gap-3 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => navigate("/community")}
                                        disabled={isSubmitting}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 bg-slate-900 hover:bg-slate-800"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            "Create Community"
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
