import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save } from "lucide-react";
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

type CommunityData = {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    description: string;
    category: string;
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

export default function CommunitySettingsTab({ community, onUpdate }: CommunitySettingsTabProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

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

            const response = await apiFetch(`/communities/${community.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error("Failed to update community");
            }

            // Update local state
            onUpdate({
                ...community,
                ...data,
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
                                onClick={() => form.reset()}
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
