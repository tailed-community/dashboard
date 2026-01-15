import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DateTime } from "luxon";
import {
    CalendarDays,
    MapPin,
    Users,
    Clock,
    ArrowLeft,
    Share2,
    Bookmark,
    ExternalLink,
    Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { getFileUrl } from "@/lib/firebase-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { HTMLContent } from "@/components/ui/html-content";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type EventData = {
    id: string;
    title: string;
    description: string;
    startDate: string;
    startTime: string;
    endDate?: string;
    endTime?: string;
    location?: string;
    city?: string;
    digitalLink?: string;
    mode: "Online" | "In Person" | "Hybrid";
    isPaid: boolean;
    registrationLink?: string;
    category: string;
    hostType: "community" | "custom";
    communityId?: string;
    communityName?: string;
    customHostName?: string;
    heroImage?: string;
    capacity?: number;
    attendees: number;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    status: string;
    community?: CommunityData; // Populated by backend
};

type CommunityData = {
    name: string;
    logoUrl?: string;
    description?: string;
    shortDescription?: string;
    slug?: string;
};

export default function EventDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<EventData | null>(null);
    const [community, setCommunity] = useState<CommunityData | null>(null);
    const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRegistered, setIsRegistered] = useState(false);

    useEffect(() => {
        if (!id) {
            navigate("/events");
            return;
        }

        const fetchEvent = async () => {
            try {
                // Fetch event via API (includes populated community data)
                const response = await apiFetch(`/events/${id}`);
                const result = await response.json();

                if (!response.ok) {
                    if (response.status === 404) {
                        toast.error("Event not found");
                        navigate("/events");
                        return;
                    }
                    throw new Error(result.error || "Failed to load event");
                }

                const eventData: EventData = {
                    ...result.event,
                    createdAt: result.event.createdAt?._seconds 
                        ? DateTime.fromSeconds(result.event.createdAt._seconds).toJSDate() 
                        : DateTime.now().toJSDate(),
                    updatedAt: result.event.updatedAt?._seconds 
                        ? DateTime.fromSeconds(result.event.updatedAt._seconds).toJSDate() 
                        : DateTime.now().toJSDate(),
                };

                setEvent(eventData);

                // Community data is already populated by backend
                if (eventData.community) {
                    setCommunity(eventData.community);
                }
                
                // Load hero image from Firebase Storage if available
                if (eventData.heroImage) {
                    try {
                        const imageUrl = await getFileUrl(eventData.heroImage);
                        setHeroImageUrl(imageUrl);
                    } catch (error) {
                        console.error("Failed to load hero image:", error);
                        setHeroImageUrl(null);
                    }
                }
            } catch (error) {
                console.error("Error fetching event:", error);
                toast.error("Failed to load event");
            } finally {
                setLoading(false);
            }
        };

        fetchEvent();
    }, [id, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-cream flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                    <p className="text-sm text-slate-600">Loading event...</p>
                </div>
            </div>
        );
    }

    if (!event) {
        return null;
    }

    // Parse start date/time
    const eventDateTime = DateTime.fromISO(`${event.startDate}T${event.startTime}`);
    const now = DateTime.now();
    const isPastEvent = eventDateTime < now;
    const diff = eventDateTime.diff(now, ['days']).toObject();
    const diffInDays = Math.ceil(diff.days || 0);

    const formattedDate = eventDateTime.toFormat('EEEE, MMMM d, yyyy');
    const formattedTime = eventDateTime.toFormat('h:mm a');
    
    // Parse end date/time if provided
    const hasEndTime = event.endDate && event.endTime;
    const endDateTime = hasEndTime ? DateTime.fromISO(`${event.endDate}T${event.endTime}`) : null;
    const formattedEndDate = endDateTime ? endDateTime.toFormat('EEEE, MMMM d, yyyy') : null;
    const formattedEndTime = endDateTime ? endDateTime.toFormat('h:mm a') : null;
    const isSameDay = endDateTime && eventDateTime.hasSame(endDateTime, 'day');

    const hostName = event.hostType === "community" && event.communityName
        ? event.communityName
        : event.customHostName || "Community Event";

    const handleShare = async () => {
        try {
            await navigator.share({
                title: event.title,
                text: event.description,
                url: window.location.href,
            });
        } catch (error) {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            toast.success("Link copied to clipboard!");
        }
    };

    const handleRegister = () => {
        setIsRegistered(!isRegistered);
        toast.success(isRegistered ? "Registration cancelled" : "Successfully registered!");
    };

    return (
        <div className="min-h-screen">
            {/* Main Content */}
            <div className="mx-auto max-w-7xl px-6 py-12">
                {/* Back Button */}
                <button
                    onClick={() => navigate("/events")}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Events
                </button>

                <div className="grid gap-12 lg:grid-cols-[240px_1fr_260px]">
                    {/* Left Column - Event Image */}
                    <div className="lg:col-span-1">
                        {heroImageUrl ? (
                            <img
                                src={heroImageUrl}
                                alt={event.title}
                                className="w-full aspect-square object-cover rounded-2xl"
                            />
                        ) : (
                            <div className="w-full aspect-square bg-slate-100 rounded-2xl flex items-center justify-center">
                                <CalendarDays className="w-16 h-16 text-slate-300" />
                            </div>
                        )}
                    </div>

                    {/* Middle Column - Event Details */}
                    <div className="lg:col-span-1 space-y-10">
                        {/* Header */}
                        <div className="space-y-4">
                            <h1 className="text-4xl font-bold text-slate-900 leading-tight">
                                {event.title}
                            </h1>
                            <div className="flex items-center gap-3 text-sm">
                                <Badge variant="outline" className="rounded-full">
                                    {event.category}
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                    {event.mode}
                                </Badge>
                                <Badge variant="outline" className={cn(
                                    "rounded-full",
                                    !event.isPaid && "bg-emerald-50 text-emerald-700 border-emerald-200"
                                )}>
                                    {event.isPaid ? "Paid" : "Free"}
                                </Badge>
                            </div>
                        </div>

                        <Separator />

                        {/* Description */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-slate-900">
                                About Event
                            </h2>
                            <HTMLContent 
                                content={event.description} 
                                className="text-slate-600 leading-relaxed"
                            />
                        </div>

                        <Separator />

                        {/* Event Details Grid */}
                        <div className="space-y-6">
                            {/* Date & Time */}
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <CalendarDays className="h-5 w-5 text-slate-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-900">{formattedDate}</p>
                                    <p className="text-sm text-slate-600">
                                        {formattedTime}
                                        {hasEndTime && isSameDay && ` - ${formattedEndTime}`}
                                    </p>
                                    {hasEndTime && !isSameDay && (
                                        <p className="text-sm text-slate-600 mt-1">
                                            Ends: {formattedEndDate} at {formattedEndTime}
                                        </p>
                                    )}
                                    {!isPastEvent && diffInDays >= 0 && (
                                        <p className="text-xs text-slate-500 mt-1">
                                            {diffInDays === 0 ? "Today" : diffInDays === 1 ? "Tomorrow" : `In ${diffInDays} days`}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Location */}
                            {(event.mode === "In Person" || event.mode === "Hybrid") && event.location && (
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-900">{event.location}</p>
                                        {event.city && (
                                            <p className="text-sm text-slate-600">{event.city}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Digital Link */}
                            {(event.mode === "Online" || event.mode === "Hybrid") && event.digitalLink && (
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <ExternalLink className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-900">Virtual event</p>
                                        <Button
                                            variant="link"
                                            onClick={() => window.open(event.digitalLink, "_blank")}
                                            className="h-auto p-0 text-sm text-blue-600 hover:text-blue-700"
                                        >
                                            Join online
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* Host */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-slate-900">
                                Hosted by
                            </h2>
                            <div 
                                className={cn(
                                    "flex items-center gap-4",
                                    event.hostType === "community" && event.communityId && "cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-2 rounded-lg transition-colors"
                                )}
                                onClick={() => {
                                    if (event.hostType === "community" && event.communityId) {
                                        navigate(`/communities/${community?.slug || event.communityId}`);
                                    }
                                }}
                            >
                                <Avatar className="h-14 w-14">
                                    <AvatarImage src={community?.logoUrl || ""} alt={hostName} />
                                    <AvatarFallback className="bg-slate-100 text-slate-700 text-base font-semibold">
                                        {hostName.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold text-slate-900">{hostName}</p>
                                    {community && (
                                        <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">
                                            {community.shortDescription || community.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Registration Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-8 border border-slate-200 rounded-2xl p-6 space-y-6 bg-slate-50/50">
                            {/* Price */}
                            <div className="text-center pb-4 border-b border-slate-200">
                                <p className="text-3xl font-bold text-slate-900">{event.isPaid ? "Paid Event" : "Free"}</p>
                                {event.capacity && (
                                    <p className="text-sm text-slate-500 mt-1">
                                        {event.capacity - event.attendees} spots left
                                    </p>
                                )}
                            </div>

                            {/* Quick Info */}
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center gap-3">
                                    <CalendarDays className="h-4 w-4 text-slate-500 flex-shrink-0" />
                                    <span className="text-slate-700">{formattedDate.split(',')[0]}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Clock className="h-4 w-4 text-slate-500 flex-shrink-0" />
                                    <span className="text-slate-700">{formattedTime}</span>
                                </div>
                                {event.location && (
                                    <div className="flex items-center gap-3">
                                        <MapPin className="h-4 w-4 text-slate-500 flex-shrink-0" />
                                        <span className="text-slate-700 line-clamp-1">{event.city || event.location}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <Users className="h-4 w-4 text-slate-500 flex-shrink-0" />
                                    <span className="text-slate-700">{event.attendees} attending</span>
                                </div>
                            </div>

                            <Separator />

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                {!isPastEvent ? (
                                    event.registrationLink ? (
                                        <Button
                                            onClick={() => window.open(event.registrationLink, "_blank")}
                                            className="w-full bg-slate-900 hover:bg-slate-800 rounded-lg"
                                            size="lg"
                                        >
                                            Register Now
                                            <ExternalLink className="h-4 w-4 ml-2" />
                                        </Button>
                                    ) : (
                                        <>  </>
                                    )
                                ) : (
                                    <Button disabled className="w-full rounded-lg" size="lg">
                                        Event Ended
                                    </Button>
                                )}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleShare}
                                        className="flex-1 rounded-lg"
                                        size="sm"
                                    >
                                        <Share2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
