import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getApp } from "firebase/app";
import { toast } from "sonner";
import { Users, Loader2, Upload, Image as ImageIcon } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";

// Zod schema for association validation
const associationSchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name must be less than 100 characters"),
    description: z.string().min(10, "Description must be at least 10 characters").max(500, "Description must be less than 500 characters"),
    category: z.string().min(1, "Category is required"),
    logo: z.instanceof(File).optional(),
    banner: z.instanceof(File).optional(),
});

type AssociationFormData = z.infer<typeof associationSchema>;

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

export default function CreateAssociationPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);

    const form = useForm<AssociationFormData>({
        resolver: zodResolver(associationSchema),
        defaultValues: {
            name: "",
            description: "",
            category: "",
        },
    });

    const onSubmit = async (data: AssociationFormData) => {
        if (!user) {
            toast.error("You must be signed in to create an association");
            return;
        }

        setIsSubmitting(true);

        try {
            const db = getFirestore(getApp());
            const storage = getStorage(getApp());
            
            // First, create the association document to get an ID
            const associationsRef = collection(db, "associations");
            const docRef = await addDoc(associationsRef, {
                name: data.name,
                description: data.description,
                category: data.category,
                memberCount: 1,
                members: [user.uid],
                createdBy: user.uid,
                createdByName: user.displayName || user.email || "Unknown",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: "active",
            });

            const associationId = docRef.id;
            let logoUrl = null;
            let bannerUrl = null;

            // Upload logo if provided
            if (data.logo) {
                const logoRef = ref(storage, `associations/${associationId}/logo`);
                await uploadBytes(logoRef, data.logo);
                logoUrl = await getDownloadURL(logoRef);
            }

            // Upload banner if provided
            if (data.banner) {
                const bannerRef = ref(storage, `associations/${associationId}/banner`);
                await uploadBytes(bannerRef, data.banner);
                bannerUrl = await getDownloadURL(bannerRef);
            }

            // Update the document with image URLs
            if (logoUrl || bannerUrl) {
                const { updateDoc, doc } = await import("firebase/firestore");
                await updateDoc(doc(db, "associations", associationId), {
                    ...(logoUrl && { logoUrl }),
                    ...(bannerUrl && { bannerUrl }),
                    updatedAt: serverTimestamp(),
                });
            }

            toast.success("Association created successfully!", {
                description: "Your association has been published.",
            });

            navigate("/association");
        } catch (error) {
            console.error("Error creating association:", error);
            toast.error("Failed to create association", {
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
                            Please sign in to create an association
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
                    <h1 className="text-4xl font-bold text-slate-900">Create New Association</h1>
                    <p className="mt-2 text-slate-600">
                        Start a new community or club to connect with like-minded people
                    </p>
                </div>

                {/* Form */}
                <Card className="border-slate-200/80 bg-white shadow-soft-xl">
                    <CardHeader>
                        <CardTitle>Association Details</CardTitle>
                        <CardDescription>
                            All fields marked with * are required
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {/* Association Name */}
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Association Name *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="AI Enthusiasts Club"
                                                    {...field}
                                                />
                                            </FormControl>
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
                                                <Textarea
                                                    placeholder="Tell people what your association is about..."
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Briefly describe your association (10-500 characters)
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
                                            <FormLabel>Association Logo</FormLabel>
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
                                                Upload a logo for your association (square images work best)
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
                                                Upload a banner image for your association card
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
                                                    {form.watch("name") || "Association Name"}
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
                                        onClick={() => navigate("/association")}
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
                                            "Create Association"
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
