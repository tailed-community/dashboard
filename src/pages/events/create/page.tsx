import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarDays, MapPin, Users, Loader2, Upload, Link as LinkIcon } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useAuth } from "@/hooks/use-auth";

// Zod schema for event validation
const eventSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must be less than 200 characters"),
    slug: z.string()
        .min(3, "Slug must be at least 3 characters")
        .max(200, "Slug must be less than 200 characters")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    startDate: z.string().min(1, "Start date is required"),
    startTime: z.string().min(1, "Start time is required"),
    endDate: z.string().optional(),
    endTime: z.string().optional(),
    location: z.string().optional(),
    city: z.string().optional(),
    digitalLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    mode: z.enum(["Online", "In Person", "Hybrid"], {
        required_error: "Please select event mode",
    }),
    isPaid: z.boolean().default(false),
    registrationLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    category: z.string().min(1, "Category is required"),
    hostType: z.enum(["community", "custom"], {
        required_error: "Please select host type",
    }),
    communityId: z.string().optional(),
    customHostName: z.string().optional(),
    heroImage: z.instanceof(File).optional(),
    capacity: z.string().optional(),
}).refine((data) => {
    // If mode is In Person or Hybrid, location and city are required
    if ((data.mode === "In Person" || data.mode === "Hybrid") && (!data.location || !data.city)) {
        return false;
    }
    // If mode is Online or Hybrid, digitalLink is required
    if ((data.mode === "Online" || data.mode === "Hybrid") && !data.digitalLink) {
        return false;
    }
    // If hostType is custom, customHostName is required
    if (data.hostType === "custom" && !data.customHostName) {
        return false;
    }
    // If hostType is community, communityId is required
    if (data.hostType === "community" && !data.communityId) {
        return false;
    }
    return true;
}, {
    message: "Please fill in all required fields based on your selections",
});

type EventFormData = z.infer<typeof eventSchema>;

type Community = {
    id: string;
    name: string;
    acronym?: string;
};

const categories = [
    "Tech",
    "Product",
    "AI",
    "Arts & Culture",
    "Fitness",
    "Wellness",
    "Crypto",
    "Climate",
    "Design",
    "Business",
    "Academic",
    "Sports",
];

const cities = [
    { name: "Atlanta", region: "North America" },
    { name: "Austin", region: "North America" },
    { name: "Boston", region: "North America" },
    { name: "Chicago", region: "North America" },
    { name: "Dallas", region: "North America" },
    { name: "Denver", region: "North America" },
    { name: "Houston", region: "North America" },
    { name: "Los Angeles", region: "North America" },
    { name: "Montréal", region: "North America" },
    { name: "New York", region: "North America" },
    { name: "San Francisco", region: "North America" },
    { name: "Seattle", region: "North America" },
    { name: "Toronto", region: "North America" },
    { name: "Vancouver", region: "North America" },
    { name: "Washington, DC", region: "North America" },
    { name: "Amsterdam", region: "Europe" },
    { name: "Barcelona", region: "Europe" },
    { name: "Berlin", region: "Europe" },
    { name: "Dublin", region: "Europe" },
    { name: "London", region: "Europe" },
    { name: "Paris", region: "Europe" },
    { name: "Stockholm", region: "Europe" },
    { name: "Zurich", region: "Europe" },
    { name: "Auckland", region: "Asia & Pacific" },
    { name: "Seoul", region: "Asia & Pacific" },
    { name: "Singapore", region: "Asia & Pacific" },
    { name: "Sydney", region: "Asia & Pacific" },
    { name: "Tokyo", region: "Asia & Pacific" },
];

export default function CreateEventPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [communities, setCommunities] = useState<Community[]>([]);
    const [loadingCommunities, setLoadingCommunities] = useState(true);
    const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);

    const form = useForm<EventFormData>({
        resolver: zodResolver(eventSchema),
        defaultValues: {
            title: "",
            slug: "",
            description: "",
            startDate: "",
            startTime: "",
            endDate: "",
            endTime: "",
            location: "",
            city: "",
            digitalLink: "",
            mode: undefined,
            isPaid: false,
            registrationLink: "",
            category: "",
            hostType: "custom",
            communityId: "",
            customHostName: user?.displayName || "",
            capacity: "",
        },
    });

    const watchMode = form.watch("mode");
    const watchHostType = form.watch("hostType");

    // Auto-generate slug from title
    const generateSlug = (title: string) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    };

    // Fetch communities from API
    useEffect(() => {
        const fetchCommunities = async () => {
            try {
                const response = await apiFetch("/communities?limit=100");
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.error || "Failed to fetch communities");
                }
                
                const fetchedCommunities: Community[] = result.communities.map((c: any) => ({
                    id: c.id,
                    name: c.name || "Unnamed Community",
                    acronym: c.acronym,
                }));

                setCommunities(fetchedCommunities);
            } catch (error) {
                console.error("Error fetching communities:", error);
                toast.error("Failed to load communities");
            } finally {
                setLoadingCommunities(false);
            }
        };

        fetchCommunities();
    }, []);

    const onSubmit = async (data: EventFormData) => {
        if (!user) {
            toast.error("You must be signed in to create an event");
            return;
        }

        setIsSubmitting(true);

        try {
            // Build FormData for multipart/form-data request
            const formData = new FormData();
            
            // Append all text fields
            formData.append("title", data.title);
            formData.append("slug", data.slug);
            formData.append("description", data.description);
            formData.append("startDate", data.startDate);
            formData.append("startTime", data.startTime);
            formData.append("mode", data.mode);
            formData.append("isPaid", String(data.isPaid));
            formData.append("category", data.category);
            
            // Optional fields
            if (data.endDate) formData.append("endDate", data.endDate);
            if (data.endTime) formData.append("endTime", data.endTime);
            if (data.location) formData.append("location", data.location);
            if (data.city) formData.append("city", data.city);
            if (data.digitalLink) formData.append("digitalLink", data.digitalLink);
            if (data.registrationLink) formData.append("registrationLink", data.registrationLink);
            if (data.capacity) formData.append("capacity", data.capacity);
            
            // Community or custom host
            if (data.hostType === "community" && data.communityId) {
                formData.append("communityId", data.communityId);
            }
            if (data.hostType === "custom" && data.customHostName) {
                formData.append("customHostName", data.customHostName);
            }

            // Append optional hero image
            if (data.heroImage) {
                formData.append("heroImage", data.heroImage);
            }

            // Call API endpoint (always uses multipart/form-data)
            const response = await apiFetch("/events", {
                method: "POST",
                body: formData,
                // Don't set Content-Type header - browser sets it with boundary
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to create event");
            }

            toast.success("Event created successfully!", {
                description: "Your event has been published.",
            });

            navigate("/events");
        } catch (error) {
            console.error("Error creating event:", error);
            toast.error("Failed to create event", {
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
                            Please sign in to create an event
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
                    <h1 className="text-4xl font-bold text-slate-900">Create New Event</h1>
                    <p className="mt-2 text-slate-600">
                        Fill out the details below to create a new event for your community
                    </p>
                </div>

                {/* Form */}
                <Card className="border-slate-200/80 bg-white shadow-soft-xl">
                    <CardHeader>
                        <CardTitle>Event Details</CardTitle>
                        <CardDescription>
                            All fields marked with * are required
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {/* Title */}
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Event Title *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="NYC Tech Students Mixer"
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
                                                    <span className="text-sm text-slate-500">tailed.ca/events/</span>
                                                    <Input
                                                        placeholder="nyc-tech-students-mixer"
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
                                                    placeholder="Tell attendees what your event is about..."
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Use the toolbar to format your event description with headings, lists, and more
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Start Date & Time */}
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="startDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Start Date *</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                        <Input
                                                            type="date"
                                                            className="pl-10"
                                                            {...field}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="startTime"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Start Time *</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="time"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* End Date & Time (Optional) */}
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="endDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>End Date (Optional)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                        <Input
                                                            type="date"
                                                            className="pl-10"
                                                            {...field}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormDescription>
                                                    Leave empty for single-day event
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="endTime"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>End Time (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="time"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Mode & Category */}
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="mode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Event Mode *</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select mode" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Online">Online</SelectItem>
                                                        <SelectItem value="In Person">In Person</SelectItem>
                                                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

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
                                </div>

                                {/* Location & City - Show for In Person or Hybrid */}
                                {(watchMode === "In Person" || watchMode === "Hybrid") && (
                                    <div className="grid gap-6 sm:grid-cols-2">
                                        <FormField
                                            control={form.control}
                                            name="city"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>City *</FormLabel>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        defaultValue={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select city" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {cities.map((city) => (
                                                                <SelectItem key={city.name} value={city.name}>
                                                                    {city.name} ({city.region})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="location"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Venue/Address *</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                            <Input
                                                                placeholder="The Standard, High Line"
                                                                className="pl-10"
                                                                {...field}
                                                            />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}

                                {/* Digital Link - Show for Online or Hybrid */}
                                {(watchMode === "Online" || watchMode === "Hybrid") && (
                                    <FormField
                                        control={form.control}
                                        name="digitalLink"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Digital Link *</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                        <Input
                                                            placeholder="https://zoom.us/j/123456789"
                                                            className="pl-10"
                                                            {...field}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                {/* Paid Event Toggle & Registration Link */}
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="isPaid"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">Paid Event</FormLabel>
                                                    <FormDescription>
                                                        Toggle if this is a paid event
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="capacity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Max Attendees</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                        <Input
                                                            type="number"
                                                            placeholder="100"
                                                            className="pl-10"
                                                            {...field}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormDescription>
                                                    Leave empty for unlimited
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Registration Link */}
                                <FormField
                                    control={form.control}
                                    name="registrationLink"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Registration Link (Optional)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                    <Input
                                                        placeholder="https://eventbrite.com/..."
                                                        className="pl-10"
                                                        {...field}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormDescription>
                                                External registration or ticketing link
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Host Type Selection */}
                                <FormField
                                    control={form.control}
                                    name="hostType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Event Host *</FormLabel>
                                            <FormControl>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            value="community"
                                                            checked={field.value === "community"}
                                                            onChange={() => field.onChange("community")}
                                                            className="h-4 w-4"
                                                        />
                                                        <span className="text-sm">Community</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            value="custom"
                                                            checked={field.value === "custom"}
                                                            onChange={() => field.onChange("custom")}
                                                            className="h-4 w-4"
                                                        />
                                                        <span className="text-sm">Custom Name</span>
                                                    </label>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Community Dropdown - Show if community selected */}
                                {watchHostType === "community" && (
                                    <FormField
                                        control={form.control}
                                        name="communityId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Select Community *</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                    disabled={loadingCommunities}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue 
                                                                placeholder={
                                                                    loadingCommunities 
                                                                        ? "Loading communities..." 
                                                                        : "Select a community"
                                                                } 
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {communities.map((community) => (
                                                            <SelectItem key={community.id} value={community.id}>
                                                                {community.name}
                                                                {community.acronym && ` (${community.acronym})`}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormDescription>
                                                    The community hosting this event
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                {/* Custom Host Name - Show if custom selected */}
                                {watchHostType === "custom" && (
                                    <FormField
                                        control={form.control}
                                        name="customHostName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Host Name *</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Tailed Community"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                    Your name or organization hosting this event
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                {/* Hero Image Upload */}
                                <FormField
                                    control={form.control}
                                    name="heroImage"
                                    render={({ field: { value, onChange, ...field } }) => (
                                        <FormItem>
                                            <FormLabel>Hero Image</FormLabel>
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
                                                                    // Create preview
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => {
                                                                        setHeroImagePreview(reader.result as string);
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                            {...field}
                                                        />
                                                        <Upload className="h-5 w-5 text-slate-400" />
                                                    </div>
                                                    {heroImagePreview && (
                                                        <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                                                            <img
                                                                src={heroImagePreview}
                                                                alt="Hero preview"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </FormControl>
                                            <FormDescription>
                                                Upload a cover image for your event (optional)
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Submit Buttons */}
                                <div className="flex gap-3 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => navigate("/events")}
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
                                            "Create Event"
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
