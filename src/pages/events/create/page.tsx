import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MapPin, Users, Loader2, Link as LinkIcon, Info } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import { EventAwardsEditor } from "@/components/events/awards";
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
import { DateTimeField } from "@/components/ui/date-time-field";
import { splitWireDateTime } from "@/lib/datetime-wire";
import { ImageUploadField } from "@/components/media/image-upload-field";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useAuth } from "@/hooks/use-auth";

const awardSchema = z.object({
    type: z.enum(["main_place", "special"]),
    place: z.preprocess(
        (value) => {
            if (value === "" || value === undefined || value === null) {
                return null;
            }

            if (value === "1" || value === 1) return 1;
            if (value === "2" || value === 2) return 2;
            if (value === "3" || value === 3) return 3;

            return value;
        },
        z.union([z.literal(1), z.literal(2), z.literal(3), z.null()])
    ),
    title: z.string().min(1, "Award title is required").max(120, "Title must be less than 120 characters"),
    prizeDescription: z.string().max(200, "Prize description must be less than 200 characters").optional(),
}).superRefine((value, ctx) => {
    if (value.type === "main_place" && value.place === null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Place is required for main place awards",
            path: ["place"],
        });
    }
});

// Zod schema for event validation
const eventSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must be less than 200 characters"),
    slug: z.string()
        .min(3, "Slug must be at least 3 characters")
        .max(200, "Slug must be less than 200 characters")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    start: z.date({ required_error: "Start date and time are required" }),
    end: z.date().optional(),
    location: z.string().optional(),
    city: z.string().optional(),
    digitalLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    mode: z.enum(["Online", "In Person", "Hybrid"], {
        required_error: "Please select event mode",
    }),
    isPaid: z.boolean().default(false),
    requiresApproval: z.boolean().default(false),
    registrationLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    category: z.string().min(1, "Category is required"),
    hostType: z.enum(["community", "custom"], {
        required_error: "Please select host type",
    }),
    communityId: z.string().optional(),
    customHostName: z.string().optional(),
    awards: z.array(awardSchema).max(20, "You can add up to 20 awards").optional(),
    heroImage: z.instanceof(File).optional(),
    scheduleImage: z.instanceof(File).optional(),
    capacity: z.string().optional(),
    maxTeamSize: z.string().optional(),
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
}).refine((data) => !data.end || !data.start || data.end > data.start, {
    message: "End must be after the start",
    path: ["end"],
});

type EventFormValues = z.input<typeof eventSchema>;
type EventFormData = z.output<typeof eventSchema>;

type Community = {
    id: string;
    name: string;
    acronym?: string;
    status?: string;
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
    const [createdEventId, setCreatedEventId] = useState<string | null>(null);
    const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);
    const [communities, setCommunities] = useState<Community[]>([]);
    const [loadingCommunities, setLoadingCommunities] = useState(true);

    const form = useForm<EventFormValues, undefined, EventFormData>({
        resolver: zodResolver(eventSchema),
        defaultValues: {
            title: "",
            slug: "",
            description: "",
            start: undefined,
            end: undefined,
            location: "",
            city: "",
            digitalLink: "",
            mode: undefined,
            isPaid: false,
            requiresApproval: false,
            registrationLink: "",
            category: "",
            hostType: "custom",
            communityId: "",
            customHostName: user?.displayName || "",
            awards: [],
            capacity: "",
            maxTeamSize: "",
        },
    });

    const { fields: awardFields, append: appendAward, remove: removeAward, replace: replaceAwards } = useFieldArray({
        control: form.control,
        name: "awards",
    });

    const [removedAwardIds, setRemovedAwardIds] = useState<string[]>([]);

    const watchMode = form.watch("mode");
    const watchHostType = form.watch("hostType");
    const watchAwards = form.watch("awards") || [];

    // Auto-generate slug from title
    const generateSlug = (title: string) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    };

    // Fetch communities the current user administers — only communities they
    // can actually host an event under (i.e. approved by a moderator) are
    // offered in the dropdown below.
    useEffect(() => {
        const fetchCommunities = async () => {
            try {
                const response = await apiFetch("/communities/mine");
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "Failed to fetch communities");
                }

                const fetchedCommunities: Community[] = (result.communities || [])
                    .map((c: any) => ({
                        id: c.id,
                        name: c.name || "Unnamed Community",
                        acronym: c.acronym,
                        status: c.status,
                    }))
                    // Missing status is treated as approved (older records predate moderation).
                    .filter((c: Community) => !c.status || c.status === "approved");

                setCommunities(fetchedCommunities);
            } catch (error) {
                console.error("Error fetching communities:", error);
                toast.error("Failed to load your communities");
            } finally {
                setLoadingCommunities(false);
            }
        };

        fetchCommunities();
    }, []);

    // If the user isn't an admin of any approved community, the "Community"
    // host option isn't usable — default them into the independent/custom
    // path once we know that for sure.
    useEffect(() => {
        if (!loadingCommunities && communities.length === 0 && form.getValues("hostType") === "community") {
            form.setValue("hostType", "custom");
        }
    }, [loadingCommunities, communities, form]);

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
            // The API still takes day and time as separate fields.
            const start = splitWireDateTime(data.start);
            formData.append("startDate", start.date);
            formData.append("startTime", start.time);
            formData.append("mode", data.mode);
            formData.append("isPaid", String(data.isPaid));
            formData.append("requiresApproval", String(data.requiresApproval));
            formData.append("category", data.category);
            formData.append("hostType", data.hostType);
            
            // Optional fields
            if (data.end) {
                const end = splitWireDateTime(data.end);
                formData.append("endDate", end.date);
                formData.append("endTime", end.time);
            }
            if (data.location) formData.append("location", data.location);
            if (data.city) formData.append("city", data.city);
            if (data.digitalLink) formData.append("digitalLink", data.digitalLink);
            if (data.registrationLink) formData.append("registrationLink", data.registrationLink);
            if (data.capacity) formData.append("capacity", data.capacity);
            if (data.maxTeamSize) formData.append("maxTeamSize", data.maxTeamSize);
            
            // Community or custom host
            if (data.hostType === "community" && data.communityId) {
                formData.append("communityId", data.communityId);
            }
            if (data.hostType === "custom" && data.customHostName) {
                formData.append("customHostName", data.customHostName);
            }

            if (data.awards && data.awards.length > 0) {
                formData.append("awards", JSON.stringify(data.awards));
            }

            // Append optional hero image
            if (data.heroImage) {
                formData.append("heroImage", data.heroImage);
            }

            // Append optional schedule image
            if (data.scheduleImage) {
                formData.append("scheduleImage", data.scheduleImage);
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

            if (result.moderationStatus === "pending") {
                toast.success("Event submitted for review", {
                    description: "It'll go live once a moderator approves it.",
                });
            } else {
                toast.success("Event created successfully!", {
                    description: "Your event has been published.",
                });
            }

            // Keep created event id
            const newEventId = result.eventId || null;
            setCreatedEventId(newEventId);

            // Automatically create default registration form (name + email)
            if (newEventId) {
                try {
                    await createDefaultRegistrationForm(newEventId);
                } catch (err) {
                    // createDefaultRegistrationForm already logs and toasts on error
                }
            }

            // Show prompt asking if organizer wants to create a custom form
            setShowRegistrationPrompt(true);
        } catch (error) {
            console.error("Error creating event:", error);
            toast.error("Failed to create event", {
                description: error instanceof Error ? error.message : "Please try again",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Create default registration form for the event (called when organizer chooses No)
    const createDefaultRegistrationForm = async (eventId: string) => {
        try {
            const resp = await apiFetch(`/events/${eventId}/registration-form`, {
                method: "POST",
            });

            const json = await resp.json();
            if (!resp.ok) {
                throw new Error(json.error || "Failed to create registration form");
            }

            toast.success("Registration form created", { description: "Default registration fields added (name, email)." });
        } catch (err) {
            console.error("Failed to create default registration form:", err);
            toast.error("Failed to create registration form");
        }
    };

    const handlePromptNo = async () => {
        // Default form was already created automatically. Close prompt and go to event page.
        setShowRegistrationPrompt(false);
        if (createdEventId) {
            navigate(`/events/${createdEventId}`);
        } else {
            navigate("/events");
        }
    };

    const handlePromptYes = () => {
        setShowRegistrationPrompt(false);
        if (createdEventId) {
            navigate(`/events/${createdEventId}/forms/custom`);
        } else {
            toast.info("Event created — you can edit the registration form later.");
            navigate("/events");
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

                                {/* Start & End */}
                                <div className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="start"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Starts *</FormLabel>
                                                <FormControl>
                                                    <DateTimeField
                                                        name={field.name}
                                                        date={field.value}
                                                        setDate={field.onChange}
                                                        onBlur={field.onBlur}
                                                        datePlaceholder="Pick a start date"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="end"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Ends (Optional)</FormLabel>
                                                <FormControl>
                                                    <DateTimeField
                                                        name={field.name}
                                                        date={field.value}
                                                        setDate={field.onChange}
                                                        onBlur={field.onBlur}
                                                        datePlaceholder="Pick an end date"
                                                        minDate={form.watch("start")}
                                                        clearable
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                    Leave empty for a single-day event
                                                </FormDescription>
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
                                        name="requiresApproval"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">Require Approval</FormLabel>
                                                    <FormDescription>
                                                        Participants submit a request and wait for organizer approval before gaining access.
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

                                    <FormField
                                        control={form.control}
                                        name="maxTeamSize"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Max Team Size (Optional)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            placeholder="4"
                                                            className="pl-10"
                                                            {...field}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormDescription>
                                                    Leave empty for solo or unlimited team sizes
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
                                    render={({ field }) => {
                                        const hasApprovedCommunities = !loadingCommunities && communities.length > 0;
                                        return (
                                            <FormItem>
                                                <FormLabel>Event Host *</FormLabel>
                                                <FormControl>
                                                    <div className="flex gap-4">
                                                        <label
                                                            className={`flex items-center gap-2 ${
                                                                hasApprovedCommunities ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                                                            }`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                value="community"
                                                                checked={field.value === "community"}
                                                                disabled={!hasApprovedCommunities}
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
                                                {!loadingCommunities && !hasApprovedCommunities && (
                                                    <FormDescription className="flex items-start gap-1.5">
                                                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                        <span>
                                                            You&apos;re not an admin of any (approved) community yet — you can still
                                                            submit an independent event, or{" "}
                                                            <Link to={LIVE_ROUTES.communityCreate} className="font-semibold underline underline-offset-2">
                                                                create a community first
                                                            </Link>
                                                            .
                                                        </span>
                                                    </FormDescription>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
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
                                    <>
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
                                        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                            <span>
                                                Independent events are reviewed by a moderator before they appear
                                                publicly. Events hosted by an approved community go live immediately.
                                            </span>
                                        </div>
                                    </>
                                )}

                                {/* Awards */}
                                <EventAwardsEditor
                                    form={form}
                                    awardFields={awardFields}
                                    appendAward={appendAward}
                                    removeAward={removeAward}
                                    replaceAwards={replaceAwards}
                                    watchAwards={watchAwards}
                                    registrations={[]}
                                    loadingRegistrations={false}
                                    removedAwardIds={removedAwardIds}
                                    setRemovedAwardIds={setRemovedAwardIds}
                                />

                                {/* Hero Image Upload */}
                                <FormField
                                    control={form.control}
                                    name="heroImage"
                                    render={({ field: { value, onChange } }) => (
                                        <FormItem>
                                            <FormLabel>Cover Image (Optional)</FormLabel>
                                            <FormControl>
                                                <ImageUploadField
                                                    variant="event-hero"
                                                    value={value}
                                                    onChange={onChange}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Shown as a square on your event page and as the
                                                background of your event card.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {/* Registration form prompt dialog */}
                                <Dialog open={showRegistrationPrompt} onOpenChange={setShowRegistrationPrompt}>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Create registration form?</DialogTitle>
                                            <DialogDescription>
                                                Do you want to create a custom registration form for this event?
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={handlePromptYes} className="mr-2">Yes (custom)</Button>
                                            <Button onClick={handlePromptNo}>No — create default form</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                {/* Schedule Image Upload */}
                                <FormField
                                    control={form.control}
                                    name="scheduleImage"
                                    render={({ field: { value, onChange } }) => (
                                        <FormItem>
                                            <FormLabel>Schedule Image (Optional)</FormLabel>
                                            <FormControl>
                                                <ImageUploadField
                                                    variant="event-schedule"
                                                    value={value}
                                                    onChange={onChange}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Shown at full width under “Schedule” on your event
                                                page — its original shape is kept.
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
