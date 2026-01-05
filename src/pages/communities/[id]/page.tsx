import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { getFirestore, collection, query, where, orderBy, limit, getDocs, Timestamp, doc, getDoc } from "firebase/firestore";
import { getApp } from "firebase/app";
import {
    Users,
    MapPin,
    ArrowLeft,
    Share2,
    Bookmark,
    Loader2,
    Calendar,
    UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { HTMLContent } from "@/components/ui/html-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type CommunityData = {
    id: string;
    name: string;
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

type Event = {
    id: string;
    title: string;
    datetime: Timestamp;
    location?: string;
    mode: "Online" | "In Person" | "Hybrid";
    category: string;
    heroImageUrl?: string;
    price: string;
};

export default function CommunityDetailPage() {
    const { id: slug } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [community, setCommunity] = useState<CommunityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMember, setIsMember] = useState(false);
    const [joinLoading, setJoinLoading] = useState(false);
    const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);

    useEffect(() => {
        if (!slug) {
            navigate("/communities");
            return;
        }

        const fetchCommunity = async () => {
            try {
                const db = getFirestore(getApp());
                
                // Try to find community by slug first
                const communitiesRef = collection(db, "communities");
                const slugQuery = query(communitiesRef, where("slug", "==", slug), limit(1));
                const slugSnapshot = await getDocs(slugQuery);

                let communityDoc;
                if (!slugSnapshot.empty) {
                    communityDoc = slugSnapshot.docs[0];
                } else {
                    // Fallback to document ID
                    const docRef = doc(db, "communities", slug);
                    communityDoc = await getDoc(docRef);
                }

                if (!communityDoc || !communityDoc.exists()) {
                    toast.error("Community not found");
                    navigate("/communities");
                    return;
                }

                const communityData = {
                    id: communityDoc.id,
                    ...communityDoc.data(),
                } as CommunityData;

                setCommunity(communityData);

                // Check if user is a member
                if (user && communityData.members.includes(user.uid)) {
                    setIsMember(true);
                }
            } catch (error) {
                console.error("Error fetching community:", error);
                toast.error("Failed to load community");
            } finally {
                setLoading(false);
            }
        };

        fetchCommunity();
    }, [slug, navigate, user]);

    useEffect(() => {
        if (!community) return;

        const fetchUpcomingEvents = async () => {
            try {
                setLoadingEvents(true);
                const db = getFirestore(getApp());

                // Fetch events hosted by this community
                const eventsQuery = query(
                    collection(db, "events"),
                    where("status", "==", "published"),
                    where("communityId", "==", community.id),
                    where("datetime", ">=", Timestamp.now()),
                    orderBy("datetime", "asc"),
                    limit(6)
                );
                
                const eventsSnapshot = await getDocs(eventsQuery);
                const events: Event[] = [];
                
                eventsSnapshot.forEach((doc) => {
                    events.push({
                        id: doc.id,
                        ...doc.data(),
                    } as Event);
                });

                setUpcomingEvents(events);
            } catch (error) {
                console.error("Error fetching upcoming events:", error);
            } finally {
                setLoadingEvents(false);
            }
        };

        fetchUpcomingEvents();
    }, [community]);

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-cream flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                    <p className="text-sm text-slate-600">Loading community...</p>
                </div>
            </div>
        );
    }

    if (!community) {
        return null;
    }

    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: community.name,
                    text: community.shortDescription || community.description,
                    url: window.location.href,
                });
                toast.success("Shared successfully!");
            } else {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard!");
            }
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied to clipboard!");
                } catch (clipboardError) {
                    toast.error("Failed to share");
                }
            }
        }
    };

    const handleJoin = async () => {
        if (!user) {
            toast.error("Please sign in to join this community");
            navigate("/auth/login");
            return;
        }

        if (!community) return;

        try {
            setJoinLoading(true);

            const db = getFirestore(getApp());
            const { updateDoc, doc: docRef, arrayUnion, arrayRemove } = await import("firebase/firestore");
            const communityRef = docRef(db, "communities", community.id);

            if (isMember) {
                // Leave community
                await updateDoc(communityRef, {
                    members: arrayRemove(user.uid),
                    memberCount: community.memberCount - 1,
                });
                setIsMember(false);
                setCommunity({ ...community, memberCount: community.memberCount - 1 });
                toast.success("Left community");
            } else {
                // Join community
                await updateDoc(communityRef, {
                    members: arrayUnion(user.uid),
                    memberCount: community.memberCount + 1,
                });
                setIsMember(true);
                setCommunity({ ...community, memberCount: community.memberCount + 1 });
                toast.success("Joined community!");
            }
        } catch (error) {
            console.error("Error toggling membership:", error);
            toast.error("An error occurred. Please try again.");
        } finally {
            setJoinLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-brand-cream">
            {/* Banner Image */}
            {community.bannerUrl && (
                <div className="w-full h-64 md:h-80 overflow-hidden">
                    <img
                        src={community.bannerUrl}
                        alt={`${community.name} banner`}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* Main Content */}
            <div className="mx-auto max-w-7xl px-6 py-12">
                {/* Back Button */}
                <button
                    onClick={() => navigate("/communities")}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Communities
                </button>

                <div className="grid gap-12 lg:grid-cols-[240px_1fr_260px]">
                    {/* Left Column - Community Logo */}
                    <div className="lg:col-span-1">
                        {community.logoUrl ? (
                            <img
                                src={community.logoUrl}
                                alt={community.name}
                                className="w-full aspect-square object-cover rounded-2xl"
                            />
                        ) : (
                            <div className="w-full aspect-square bg-gradient-to-br from-purple-400 via-pink-400 to-rose-400 rounded-2xl flex items-center justify-center">
                                <Users className="w-16 h-16 text-white" />
                            </div>
                        )}
                    </div>

                    {/* Middle Column - Community Details */}
                    <div className="lg:col-span-1 space-y-10">
                        {/* Header */}
                        <div className="space-y-4">
                            <h1 className="text-4xl font-bold text-slate-900 leading-tight">
                                {community.name}
                            </h1>
                            {community.shortDescription && (
                                <p className="text-lg text-slate-600">
                                    {community.shortDescription}
                                </p>
                            )}
                            <div className="flex items-center gap-3 text-sm flex-wrap">
                                <Badge variant="outline" className="rounded-full">
                                    {community.category}
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                    <Users className="h-3 w-3 mr-1" />
                                    {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
                                </Badge>
                            </div>
                        </div>

                        <Separator />

                        {/* Description */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-slate-900">
                                About {community.name}
                            </h2>
                            <HTMLContent 
                                content={community.description} 
                                className="text-slate-600 leading-relaxed"
                            />
                        </div>

                        <Separator />

                        {/* Community Details */}
                        <div className="space-y-6">
                            {/* Created By */}
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <Users className="h-5 w-5 text-slate-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-900">Created by</p>
                                    <p className="text-sm text-slate-600">{community.createdByName}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {community.createdAt.toDate().toLocaleDateString("en-US", {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Action Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-8 border border-slate-200 rounded-2xl p-6 space-y-6 bg-slate-50/50">
                            {/* Community Info Header */}
                            <div className="text-center pb-4 border-b border-slate-200">
                                <Users className="h-12 w-12 mx-auto mb-3 text-slate-600" />
                                <h3 className="font-semibold text-slate-900">{community.name}</h3>
                                <p className="text-sm text-slate-500 mt-1">{community.category}</p>
                            </div>

                            {/* Quick Info */}
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center gap-3">
                                    <Users className="h-4 w-4 text-slate-500 flex-shrink-0" />
                                    <span className="text-slate-700">
                                        {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
                                    </span>
                                </div>
                            </div>

                            <Separator />

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                <Button
                                    onClick={handleJoin}
                                    variant={isMember ? "outline" : "default"}
                                    className="w-full rounded-lg"
                                    size="lg"
                                    disabled={joinLoading}
                                >
                                    {joinLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            {isMember ? "Leaving..." : "Joining..."}
                                        </>
                                    ) : (
                                        <>
                                            {isMember ? (
                                                "Member"
                                            ) : (
                                                <>
                                                    <UserPlus className="h-4 w-4 mr-2" />
                                                    Join Community
                                                </>
                                            )}
                                        </>
                                    )}
                                </Button>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleShare}
                                        className="flex-1 rounded-lg"
                                        size="sm"
                                    >
                                        <Share2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 rounded-lg"
                                        size="sm"
                                    >
                                        <Bookmark className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Upcoming Events Section */}
                {!loadingEvents && upcomingEvents.length > 0 && (
                    <div className="mt-16 space-y-8">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-slate-900">Upcoming Events</h2>
                                {upcomingEvents.length >= 6 && (
                                    <Link to="/events">
                                        <Button variant="outline" size="sm">
                                            View All
                                        </Button>
                                    </Link>
                                )}
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {upcomingEvents.map((event) => (
                                    <Card 
                                        key={event.id} 
                                        className="hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                                        onClick={() => navigate(`/events/${event.id}`)}
                                    >
                                        {event.heroImageUrl && (
                                            <div className="aspect-video w-full overflow-hidden">
                                                <img 
                                                    src={event.heroImageUrl} 
                                                    alt={event.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}
                                        <CardHeader>
                                            <CardTitle className="text-lg line-clamp-2">{event.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">{event.category}</Badge>
                                                    <Badge variant="secondary">{event.mode}</Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <Calendar className="h-4 w-4" />
                                                    <span>{event.datetime.toDate().toLocaleDateString()}</span>
                                                </div>
                                                {event.location && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <MapPin className="h-4 w-4" />
                                                        <span className="line-clamp-1">{event.location}</span>
                                                    </div>
                                                )}
                                                {event.price === "Free" && (
                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                                        Free
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
