import { useState, useEffect } from "react";
import { DateTime } from "luxon";
import {
    CalendarDays,
    Globe2,
    MapPin,
    Monitor,
    Sparkles,
    Users,
    Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import { getFileUrl } from "@/lib/firebase-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

type HighlightedEvent = {
    id: string;
    slug: string;
    title: string;
    datetime: string;
    location: string;
    mode: "Online" | "In Person" | "Hybrid";
    priceTag: string;
    host: string;
    hostTitle: string;
    attendees: number;
    heroImage: string;
    communityLogoUrl?: string;
    daysUntil: number;
};

type EventCard = {
    id: string;
    slug: string;
    title: string;
    date: string;
    time: string;
    location: string;
    city?: string;
    mode: "Online" | "In Person" | "Hybrid";
    price: string;
    category: string;
};

type Category = {
    name: string;
    count: string;
    accent: string;
};

type City = {
    name: string;
    eventCount: number;
};

type CityGroup = {
    region: string;
    cities: City[];
};

type FirestoreEvent = {
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
};

const categoryAccents: Record<string, string> = {
    "Tech": "bg-indigo-50 text-indigo-800",
    "Product": "bg-amber-50 text-amber-800",
    "AI": "bg-slate-50 text-slate-800",
    "Arts & Culture": "bg-rose-50 text-rose-800",
    "Fitness": "bg-emerald-50 text-emerald-800",
    "Wellness": "bg-teal-50 text-teal-800",
    "Crypto": "bg-purple-50 text-purple-800",
    "Climate": "bg-lime-50 text-lime-800",
    "Design": "bg-pink-50 text-pink-800",
    "Business": "bg-blue-50 text-blue-800",
    "Academic": "bg-cyan-50 text-cyan-800",
    "Sports": "bg-orange-50 text-orange-800",
};

const cityRegionMapping: Record<string, string> = {
    "Atlanta": "North America",
    "Austin": "North America",
    "Boston": "North America",
    "Chicago": "North America",
    "Dallas": "North America",
    "Denver": "North America",
    "Houston": "North America",
    "Los Angeles": "North America",
    "New York": "North America",
    "NYC": "North America",
    "San Francisco": "North America",
    "Seattle": "North America",
    "Washington": "North America",
    "Washington, DC": "North America",
    "Montréal": "North America",
    "Montreal": "North America",
    "Toronto": "North America",
    "Vancouver": "North America",
    "London": "Europe",
    "Dublin": "Europe",
    "Paris": "Europe",
    "Berlin": "Europe",
    "Amsterdam": "Europe",
    "Barcelona": "Europe",
    "Stockholm": "Europe",
    "Zurich": "Europe",
    "Singapore": "Asia & Pacific",
    "Tokyo": "Asia & Pacific",
    "Seoul": "Asia & Pacific",
    "Sydney": "Asia & Pacific",
    "Auckland": "Asia & Pacific",
};

function formatEventDateTime(startDate: string, startTime: string): { date: string; time: string; relative: string; daysUntil: number } {
    const eventDate = DateTime.fromISO(`${startDate}T${startTime}`);
    const now = DateTime.now();
    const diff = eventDate.diff(now, ['days']).toObject();
    const diffInDays = Math.ceil(diff.days || 0);
    
    let relative = "";
    if (diffInDays === 0) {
        relative = "Today";
    } else if (diffInDays === 1) {
        relative = "Tomorrow";
    } else if (diffInDays > 1 && diffInDays <= 7) {
        relative = eventDate.toFormat('ccc'); // Mon, Tue, etc.
    } else if (diffInDays > 7 && diffInDays <= 30) {
        relative = `In ${diffInDays} days`;
    } else {
        relative = eventDate.toFormat('MMM d');
    }

    const formattedDate = eventDate.toFormat('MMM d, yyyy');
    const time = eventDate.toFormat('h:mm a');
    
    return { date: formattedDate, time, relative, daysUntil: diffInDays };
}


function CategoryChip({ category, isActive, onClick }: { category: Category; isActive: boolean; onClick: () => void }) {
    return (
        <div 
            onClick={onClick}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 shadow-soft cursor-pointer hover:shadow-soft-lg transition ${
                isActive ? 'border-slate-900 bg-slate-50' : 'border-slate-200/70 bg-white'
            }`}
        >
            <div>
                <p className="text-sm font-semibold text-slate-900">{category.name}</p>
                <p className="text-xs text-slate-500">{category.count}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${isActive ? 'bg-slate-900 text-white' : category.accent}`}>
                {isActive ? 'Clear' : 'Browse'}
            </span>
        </div>
    );
}

function CityPill({ city, isActive, onClick }: { city: City; isActive: boolean; onClick: () => void }) {
    if (city.eventCount === 0) return null;
    
    return (
        <button 
            onClick={onClick}
            className={`rounded-full border px-4 py-2 text-sm font-medium shadow-soft transition hover:-translate-y-[1px] ${
                isActive 
                    ? 'border-slate-900 bg-slate-900 text-white' 
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
        >
            {city.name}
            <span className={`ml-2 text-xs ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{city.eventCount}</span>
        </button>
    );
}

function PopularEventCard({ event }: { event: EventCard }) {
    const navigate = useNavigate();
    const isOnline = event.mode === "Online";

    return (
        <Card 
            onClick={() => navigate(`/events/${event.slug}`)}
            className="border-slate-200/70 bg-white/90 shadow-soft-lg transition duration-200 hover:-translate-y-1 cursor-pointer">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <CalendarDays className="h-4 w-4" aria-hidden="true" />
                        <span>
                            {event.date} · {event.time}
                        </span>
                    </div>
                    <Badge className="bg-slate-900 text-white">{event.price}</Badge>
                </div>
                <CardTitle className="text-lg text-slate-900">{event.title}</CardTitle>
                <CardDescription className="text-sm text-slate-600">
                    {event.category}
                </CardDescription>
            </CardHeader>
            <CardFooter className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    <span>{event.city}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                    {isOnline ? (
                        <Monitor className="h-4 w-4" aria-hidden="true" />
                    ) : (
                        <Users className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{event.mode}</span>
                </div>
            </CardFooter>
        </Card>
    );
}

function HighlightedEventCard({ event }: { event: HighlightedEvent }) {
    const navigate = useNavigate();
    
    return (
        <div 
            onClick={() => navigate(`/events/${event.slug}`)}
            className="group relative overflow-hidden rounded-2xl bg-slate-900 shadow-soft-xl ring-1 ring-white/10 cursor-pointer transition hover:scale-[1.02]">
            <div className="absolute inset-0">
                <img
                    src={event.heroImage}
                    alt={event.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-slate-900/5" />
            </div>

            <div className="relative flex h-full flex-col gap-5 p-6">
                <div className="flex items-start justify-between text-sm font-semibold text-rose-300">
                    <span className="flex items-center gap-2 tracking-wide">
                        <CalendarDays className="h-4 w-4" aria-hidden="true" />
                        {event.datetime}
                    </span>
                    <div className="flex items-center gap-2">
                        {event.daysUntil > 7 && (
                            <Badge variant="secondary" className="bg-brand-orange/80 text-white border-0">
                                {event.daysUntil} days
                            </Badge>
                        )}
                        <Badge variant="secondary" className={event.priceTag === "Free" ? "bg-emerald-500/90 text-white" : "bg-white/15 text-white"}>
                            {event.priceTag}
                        </Badge>
                    </div>
                </div>

                <div className="space-y-2">
                    <Badge
                        variant="secondary"
                        className="bg-white/10 text-white ring-1 ring-inset ring-white/20"
                    >
                        {event.mode === "Online" ? "Online" : "In Person"}
                    </Badge>
                    <h3 className="text-2xl font-semibold text-white">{event.title}</h3>
                    <p className="text-white/80">{event.location}</p>
                </div>

                <Separator className="bg-white/15" />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="ring-2 ring-white/30">
                            <AvatarImage src={event.communityLogoUrl || ""} alt={event.host} />
                            <AvatarFallback className="bg-gradient-to-br from-amber-400 to-rose-400 text-white font-semibold">
                                {event.title.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-sm font-semibold text-white">{event.host}</p>
                            <p className="text-xs text-white/70">{event.hostTitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white">
                        <Users className="h-4 w-4" aria-hidden="true" />
                        {event.attendees} going
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function EventsPage() {
    const [highlightedEvents, setHighlightedEvents] = useState<HighlightedEvent[]>([]);
    const [popularEvents, setPopularEvents] = useState<EventCard[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [cityGroups, setCityGroups] = useState<CityGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedCity, setSelectedCity] = useState<string | null>(null);
    const [showAllEvents, setShowAllEvents] = useState(false);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const response = await apiFetch("/public/events?upcoming=true&limit=50");
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to fetch events");
                }

                const fetchedEvents: FirestoreEvent[] = data.events.map((evt: any) => ({
                    ...evt,
                    createdAt: evt.createdAt ? DateTime.fromSeconds(evt.createdAt._seconds).toJSDate() : DateTime.now().toJSDate(),
                    updatedAt: evt.updatedAt ? DateTime.fromSeconds(evt.updatedAt._seconds).toJSDate() : DateTime.now().toJSDate(),
                }));

                // Fetch community logos for events
                const communityIds = [...new Set(
                    fetchedEvents
                        .filter(e => e.hostType === "community" && e.communityId)
                        .map(e => e.communityId!)
                )];

                const communityLogos: Record<string, string> = {};
                if (communityIds.length > 0) {
                    for (const communityId of communityIds) {
                        try {
                            const communityResponse = await apiFetch(`/public/communities/${communityId}`);
                            const communityData = await communityResponse.json();
                            if (communityResponse.ok && communityData.community?.logo) {
                                communityLogos[communityId] = communityData.community.logo;
                            }
                        } catch (error) {
                            console.error(`Error fetching community ${communityId}:`, error);
                        }
                    }
                }

                // Process highlighted events (first 2 upcoming events with images and community)
                const eventsWithImages = fetchedEvents.filter(e => 
                    e.heroImage && e.hostType === "community" && e.communityId
                );
                
                // Fetch hero image URLs from storage
                const highlightedWithUrls = await Promise.all(
                    eventsWithImages.slice(0, 2).map(async (event) => {
                        const { time, relative, daysUntil } = formatEventDateTime(event.startDate, event.startTime);
                        const displayLocation = event.mode === "Online" 
                            ? event.digitalLink || "Virtual Event"
                            : event.location || "TBA";
                        
                        // Get hero image URL from Firebase Storage
                        let heroImageUrl = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80";
                        if (event.heroImage) {
                            try {
                                heroImageUrl = await getFileUrl(event.heroImage);
                            } catch (error) {
                                console.error(`Failed to load hero image for ${event.id}:`, error);
                            }
                        }
                        
                        return {
                            id: event.id,
                            slug: event.slug,
                            title: event.title,
                            datetime: `${relative} · ${time}`,
                            location: displayLocation,
                            mode: event.mode,
                            priceTag: event.isPaid ? "Paid" : "Free",
                            host: event.hostType === "community" && event.communityName 
                                ? event.communityName 
                                : event.customHostName || "Community Event",
                            hostTitle: event.hostType === "community" ? "Community Event" : "Hosted Event",
                            attendees: event.attendees || 0,
                            heroImage: heroImageUrl,
                            communityLogoUrl: event.hostType === "community" && event.communityId 
                                ? communityLogos[event.communityId] 
                                : undefined,
                            daysUntil,
                        } as HighlightedEvent;
                    })
                );
                setHighlightedEvents(highlightedWithUrls);

                // Process popular events (next 6 events)
                const popular = fetchedEvents.slice(0, 6).map(event => {
                    const { date, time } = formatEventDateTime(event.startDate, event.startTime);
                    const displayLocation = event.mode === "Online" 
                        ? "Virtual"
                        : event.location || "TBA";
                    
                    return {
                        id: event.id,
                        slug: event.slug,
                        title: event.title,
                        date,
                        time,
                        location: displayLocation,
                        city: event.city,
                        mode: event.mode,
                        price: event.isPaid ? "Paid" : "Free",
                        category: event.category,
                    } as EventCard;
                });
                setPopularEvents(popular);

                // Calculate category counts
                const categoryCounts: Record<string, number> = {};
                fetchedEvents.forEach(event => {
                    categoryCounts[event.category] = (categoryCounts[event.category] || 0) + 1;
                });

                const processedCategories = Object.entries(categoryCounts)
                    .map(([name, count]) => ({
                        name,
                        count: `${count} event${count !== 1 ? 's' : ''}`,
                        accent: categoryAccents[name] || "bg-gray-50 text-gray-800",
                    }))
                    .sort((a, b) => parseInt(b.count) - parseInt(a.count));
                setCategories(processedCategories);

                // Calculate city counts
                const cityCounts: Record<string, number> = {};
                fetchedEvents.forEach(event => {
                    if (event.mode !== "Online" && event.city) {
                        cityCounts[event.city] = (cityCounts[event.city] || 0) + 1;
                    }
                });

                // Group cities by region
                const regionGroups: Record<string, City[]> = {
                    "North America": [],
                    "Europe": [],
                    "Asia & Pacific": [],
                };

                Object.entries(cityCounts).forEach(([cityName, count]) => {
                    const region = cityRegionMapping[cityName] || "North America";
                    if (regionGroups[region]) {
                        regionGroups[region].push({ name: cityName, eventCount: count });
                    }
                });

                // Sort cities by event count within each region
                const processedCityGroups = Object.entries(regionGroups)
                    .map(([region, cities]) => ({
                        region,
                        cities: cities.sort((a, b) => b.eventCount - a.eventCount),
                    }))
                    .filter(group => group.cities.length > 0);

                setCityGroups(processedCityGroups);
            } catch (error) {
                console.error("Error fetching events:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-cream flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                    <p className="text-sm text-slate-600">Loading events...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-brand-cream">
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-16 top-10 h-64 w-64 rounded-full bg-amber-400/30 blur-3xl" />
                    <div className="absolute bottom-0 right-10 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
                </div>

                <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                                Event Hub
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                                    Discover events that keep you inspired
                                </h1>
                                <p className="max-w-2xl text-lg text-white/80">
                                    Browse curated meetups, learning sessions, and career mixers across cities and online. Save dates, meet your people, and never miss a moment.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-white/70">
                                <span className="flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                    Weekly drops
                                </span>
                                <span className="flex items-center gap-2">
                                    <Globe2 className="h-4 w-4" aria-hidden="true" />
                                    In person + online
                                </span>
                                <span className="flex items-center gap-2">
                                    <Users className="h-4 w-4" aria-hidden="true" />
                                    Community vetted
                                </span>
                            </div>
                        </div>
                        {/* <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                            >
                                See calendar
                            </Button>
                        </div> */}
                    </div>

                    {highlightedEvents.length > 0 ? (
                        <div className="grid gap-6 lg:grid-cols-2">
                            {highlightedEvents.map((event) => (
                                <HighlightedEventCard key={event.id} event={event} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl bg-white/10 border border-white/20 p-8 text-center">
                            <p className="text-white/80">No featured events available at the moment.</p>
                        </div>
                    )}
                </div>
            </section>

            <section className="mx-auto max-w-6xl space-y-8 px-4 py-16 sm:px-6 lg:px-8">
                {/* Popular Events Section */}
                <div className="rounded-3xl border border-slate-200/80 bg-white shadow-soft-xl">
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                                Discover Events
                            </p>
                            <h2 className="text-2xl font-semibold text-slate-900">
                                Popular this month
                            </h2>
                            <p className="text-sm text-slate-500">
                                Explore events happening near you or browse by category.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {/* <Button 
                                size="sm" 
                                className="bg-slate-900 text-white hover:bg-slate-800"
                                onClick={() => setShowAllEvents(!showAllEvents)}
                            >
                                {showAllEvents ? 'Show less' : 'View all'}
                            </Button> */}
                        </div>
                    </div>

                    <div className="space-y-8 px-8 py-8">
                        {/* Active Filters */}
                        {(selectedCategory || selectedCity) && (
                            <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-slate-100">
                                <span className="text-sm font-medium text-slate-600">Active filters:</span>
                                {selectedCategory && (
                                    <Badge 
                                        variant="secondary" 
                                        className="bg-slate-900 text-white cursor-pointer hover:bg-slate-700"
                                        onClick={() => setSelectedCategory(null)}
                                    >
                                        {selectedCategory} ✕
                                    </Badge>
                                )}
                                {selectedCity && (
                                    <Badge 
                                        variant="secondary" 
                                        className="bg-slate-900 text-white cursor-pointer hover:bg-slate-700"
                                        onClick={() => setSelectedCity(null)}
                                    >
                                        {selectedCity} ✕
                                    </Badge>
                                )}
                                <button
                                    onClick={() => {
                                        setSelectedCategory(null);
                                        setSelectedCity(null);
                                    }}
                                    className="text-xs text-slate-500 hover:text-slate-700 underline"
                                >
                                    Clear all
                                </button>
                            </div>
                        )}

                        {/* Event Grid */}
                        {(() => {
                            let filteredEvents = popularEvents;
                            
                            // Apply category filter
                            if (selectedCategory) {
                                filteredEvents = filteredEvents.filter(
                                    event => event.category === selectedCategory
                                );
                            }
                            
                            // Apply city filter
                            if (selectedCity) {
                                filteredEvents = filteredEvents.filter(
                                    event => event.city === selectedCity
                                );
                            }
                            
                            // Apply view limit
                            const displayEvents = showAllEvents ? filteredEvents : filteredEvents.slice(0, 6);
                            
                            return displayEvents.length > 0 ? (
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                    {displayEvents.map((event) => (
                                        <PopularEventCard key={event.id} event={event} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-slate-500">
                                        {selectedCategory || selectedCity 
                                            ? 'No events match your filters. Try clearing some filters.'
                                            : 'No events available yet.'}
                                    </p>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Browse by Category Section */}
                {categories.length > 0 && (
                    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-soft-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900">Browse by category</h3>
                                <p className="text-sm text-slate-500">Find events that match your interests</p>
                            </div>
                            {/* <span className="cursor-pointer text-xs font-medium uppercase tracking-[0.2em] text-slate-500 hover:text-slate-700">View all</span> */}
                        </div>
                        <div className="grid grid-cols-1 gap-4 px-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
                            {categories.map((category) => (
                                <CategoryChip 
                                    key={category.name} 
                                    category={category}
                                    isActive={selectedCategory === category.name}
                                    onClick={() => {
                                        setSelectedCategory(selectedCategory === category.name ? null : category.name);
                                        setSelectedCity(null); // Clear city filter when selecting category
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Explore Local Events Section */}
                {cityGroups.length > 0 && (
                    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-soft-xl">
                    <div className="flex flex-col gap-2 border-b border-slate-100 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                                Explore local events
                            </p>
                            <h3 className="text-xl font-semibold text-slate-900">Find events in your city</h3>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <MapPin className="h-4 w-4" aria-hidden="true" />
                            Click a city to filter
                        </div>
                    </div>

                    <div className="space-y-6 px-8 py-8">
                        {cityGroups.map((group) => {
                            const citiesWithEvents = group.cities.filter(city => city.eventCount > 0);
                            
                            if (citiesWithEvents.length === 0) return null;
                            
                            return (
                                <div key={group.region} className="space-y-4">
                                    <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                                        <Globe2 className="h-5 w-5" aria-hidden="true" />
                                        {group.region}
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {group.cities.map((city) => (
                                            <CityPill 
                                                key={city.name} 
                                                city={city}
                                                isActive={selectedCity === city.name}
                                                onClick={() => {
                                                    setSelectedCity(selectedCity === city.name ? null : city.name);
                                                    setSelectedCategory(null); // Clear category filter when selecting city
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}
            </section>
        </div>
    );
}
