import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import { useAuth } from "@/hooks/use-auth";
import { getFirestore, collection, query, where, orderBy, limit, getDocs, Timestamp, doc, getDoc } from "firebase/firestore";
import { getApp } from "firebase/app";
import {
    Building2,
    MapPin,
    Users,
    Briefcase,
    ArrowLeft,
    Share2,
    Bookmark,
    ExternalLink,
    Loader2,
    Globe,
    Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { HTMLContent } from "@/components/ui/html-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

type CompanyData = {
    id: string;
    name: string;
    description?: string | null;
    logo?: string | null;
    website?: string | null;
    industry?: string | null;
    size?: string | null;
    location?: string | null;
    socialMedia?: {
        linkedin?: string | null;
        twitter?: string | null;
        facebook?: string | null;
    };
    socialLinks?: Array<{
        url: string;
        type: string;
    }>;
    jobs?: Job[];
};

type Job = {
    id: string;
    title: string;
    type: string;
    location: string;
    description: string;
    requirements?: string;
    postingDate: string;
    endPostingDate: string;
    status: string;
    skills: string[];
};

type Event = {
    id: string;
    title: string;
    datetime: Timestamp;
    location?: string;
    mode: "Online" | "In Person" | "Hybrid";
    category: string;
    heroImageUrl?: string;
};

export default function CompanyDetailPage() {
    const { id: slug } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [company, setCompany] = useState<CompanyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [relatedJobs, setRelatedJobs] = useState<Job[]>([]);
    const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);
    const [loadingRelated, setLoadingRelated] = useState(true);

    useEffect(() => {
        if (!slug) {
            navigate("/companies");
            return;
        }

        const fetchCompany = async () => {
            try {
                const response = await apiFetch(`/public/companies/${slug}`, {}, true);

                if (!response.ok) {
                    toast.error("Company not found");
                    navigate("/companies");
                    return;
                }

                const companyData = await response.json() as CompanyData;
                setCompany(companyData);
                
                // Set jobs from company data
                if (companyData.jobs) {
                    setRelatedJobs(companyData.jobs.slice(0, 3));
                }
            } catch (error) {
                console.error("Error fetching company:", error);
                toast.error("Failed to load company");
            } finally {
                setLoading(false);
            }
        };

        fetchCompany();
    }, [slug, navigate]);

    useEffect(() => {
        if (!slug) return;

        const fetchRelatedEvents = async () => {
            try {
                setLoadingRelated(true);
                const db = getFirestore(getApp());

                // Fetch related events (events where company is involved)
                const eventsQuery = query(
                    collection(db, "events"),
                    where("status", "==", "published"),
                    where("datetime", ">=", Timestamp.now()),
                    orderBy("datetime", "asc"),
                    limit(20)
                );
                
                const eventsSnapshot = await getDocs(eventsQuery);
                const events: Event[] = [];
                
                eventsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Check if event is related to this company (by communityId or in description)
                    if (data.communityId === slug) {
                        events.push({
                            id: doc.id,
                            ...data,
                        } as Event);
                    }
                });

                setRelatedEvents(events.slice(0, 3)); // Show max 3 events
            } catch (error) {
                console.error("Error fetching related events:", error);
            } finally {
                setLoadingRelated(false);
            }
        };

        fetchRelatedEvents();
    }, [slug]);

    useEffect(() => {
        if (!user || !company) return;

        const checkFollowStatus = async () => {
            try {
                const db = getFirestore(getApp());
                const profileRef = doc(db, "profiles", user.uid);
                const profileDoc = await getDoc(profileRef);

                if (profileDoc.exists()) {
                    const profileData = profileDoc.data();
                    const subscribedCompanies = profileData?.subscribedCompanies || [];
                    
                    // Check if company is in subscribedCompanies using company.id
                    const isSubscribed = subscribedCompanies.some((sub: any) => sub.orgId === company.id)
                    
                    setIsFollowing(isSubscribed);
                }
            } catch (error) {
                console.error("Error checking follow status:", error);
            }
        };

        checkFollowStatus();
    }, [user, company]);

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-cream flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                    <p className="text-sm text-slate-600">Loading company...</p>
                </div>
            </div>
        );
    }

    if (!company) {
        return null;
    }

    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: company.name,
                    text: company.description || `Check out ${company.name} on our platform`,
                    url: window.location.href,
                });
                toast.success("Shared successfully!");
            } else {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard!");
            }
        } catch (error) {
            // User cancelled share or clipboard failed
            if ((error as Error).name !== 'AbortError') {
                // Try clipboard as fallback
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied to clipboard!");
                } catch (clipboardError) {
                    toast.error("Failed to share");
                }
            }
        }
    };

    const handleFollow = async () => {
        if (!user) {
            toast.error("Please sign in to follow companies");
            navigate("/auth/login");
            return;
        }

        if (!company) return;

        try {
            setFollowLoading(true);

            if (isFollowing) {
                // Unsubscribe - assuming endpoint exists
                const response = await apiFetch(`public/companies/${company.id}/unsubscribe`, {
                    method: "POST",
                }, true);

                if (response.ok) {
                    setIsFollowing(false);
                    toast.success("Unfollowed company");
                } else {
                    const error = await response.json();
                    toast.error(error.message || "Failed to unfollow company");
                }
            } else {
                // Subscribe
                const response = await apiFetch(`public/companies/${company.id}/subscribe`, {
                    method: "POST",
                }, true);

                if (response.ok) {
                    const data = await response.json();
                    setIsFollowing(true);
                    toast.success(data.message || "Following company!");
                } else {
                    const error = await response.json();
                    toast.error(error.message || "Failed to follow company");
                }
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
            toast.error("An error occurred. Please try again.");
        } finally {
            setFollowLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-brand-cream">
            {/* Main Content */}
            <div className="mx-auto max-w-7xl px-6 py-12">
                <div className="grid gap-12 lg:grid-cols-[240px_1fr_260px]">
                    {/* Left Column - Company Logo */}
                    <div className="lg:col-span-1">
                        {company.logo ? (
                            <img
                                src={company.logo}
                                alt={company.name}
                                className="w-full aspect-square object-cover rounded-2xl"
                            />
                        ) : (
                            <div className="w-full aspect-square bg-gradient-to-br from-purple-400 via-pink-400 to-rose-400 rounded-2xl flex items-center justify-center">
                                <Building2 className="w-16 h-16 text-white" />
                            </div>
                        )}
                    </div>

                    {/* Middle Column - Company Details */}
                    <div className="lg:col-span-1 space-y-10">
                        {/* Header */}
                        <div className="space-y-4">
                            <h1 className="text-4xl font-bold text-slate-900 leading-tight">
                                {company.name}
                            </h1>
                            <div className="flex items-center gap-3 text-sm flex-wrap">
                                {company.industry && (
                                    <Badge variant="outline" className="rounded-full">
                                        {company.industry}
                                    </Badge>
                                )}
                                {company.location && (
                                    <Badge variant="outline" className="rounded-full">
                                        <MapPin className="h-3 w-3 mr-1" />
                                        {company.location}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* Description */}
                        {company.description && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold text-slate-900">
                                    About {company.name}
                                </h2>
                                <HTMLContent 
                                    content={company.description} 
                                    className="text-slate-600 leading-relaxed"
                                />
                            </div>
                        )}

                        <Separator />

                        {/* Company Details Grid */}
                        <div className="space-y-6">
                            {/* Website */}
                            {company.website && (
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <Globe className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-900">Website</p>
                                        <Button
                                            variant="link"
                                            onClick={() => window.open(company.website, "_blank")}
                                            className="h-auto p-0 text-sm text-blue-600 hover:text-blue-700"
                                        >
                                            {company.website.replace(/^https?:\/\//, '')}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Location */}
                            {company.location && (
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-900">Location</p>
                                        <p className="text-sm text-slate-600">{company.location}</p>
                                    </div>
                                </div>
                            )}

                            {/* Company Size */}
                            {company.size && (
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <Users className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-900">Company Size</p>
                                        <p className="text-sm text-slate-600">{company.size}</p>
                                    </div>
                                </div>
                            )}

                            {/* Social Media */}
                            {((company.socialLinks && company.socialLinks.length > 0) || company.socialMedia?.linkedin || company.socialMedia?.twitter || company.socialMedia?.facebook) && (
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <Share2 className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-900 mb-2">Social Media</p>
                                        <div className="flex flex-wrap gap-2">
                                            {/* New socialLinks structure */}
                                            {company.socialLinks?.map((link, index) => (
                                                <Button
                                                    key={index}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => window.open(link.url, "_blank")}
                                                >
                                                    {link.type.charAt(0).toUpperCase() + link.type.slice(1)}
                                                </Button>
                                            ))}
                                            {/* Legacy socialMedia structure (fallback) */}
                                            {!company.socialLinks && (
                                                <>
                                                    {company.socialMedia?.linkedin && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => window.open(company.socialMedia!.linkedin!, "_blank")}
                                                        >
                                                            LinkedIn
                                                        </Button>
                                                    )}
                                                    {company.socialMedia?.twitter && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => window.open(company.socialMedia!.twitter!, "_blank")}
                                                        >
                                                            Twitter
                                                        </Button>
                                                    )}
                                                    {company.socialMedia?.facebook && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => window.open(company.socialMedia!.facebook!, "_blank")}
                                                        >
                                                            Facebook
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Action Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-8 border border-slate-200 rounded-2xl p-6 space-y-6 bg-slate-50/50">
                            {/* Company Info Header */}
                            <div className="text-center pb-4 border-b border-slate-200">
                                <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-600" />
                                <h3 className="font-semibold text-slate-900">{company.name}</h3>
                                {company.industry && (
                                    <p className="text-sm text-slate-500 mt-1">{company.industry}</p>
                                )}
                            </div>

                            {/* Quick Info */}
                            <div className="space-y-3 text-sm">
                                {company.location && (
                                    <div className="flex items-center gap-3">
                                        <MapPin className="h-4 w-4 text-slate-500 flex-shrink-0" />
                                        <span className="text-slate-700 line-clamp-1">{company.location}</span>
                                    </div>
                                )}
                                {company.size && (
                                    <div className="flex items-center gap-3">
                                        <Users className="h-4 w-4 text-slate-500 flex-shrink-0" />
                                        <span className="text-slate-700">{company.size}</span>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                <Button
                                    onClick={handleFollow}
                                    variant={isFollowing ? "outline" : "default"}
                                    className="w-full rounded-lg"
                                    size="lg"
                                    disabled={followLoading}
                                >
                                    {followLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            {isFollowing ? "Unfollowing..." : "Following..."}
                                        </>
                                    ) : (
                                        isFollowing ? "Following" : "Follow Company"
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
                                </div>
                                {company.website && (
                                    <Button
                                        variant="outline"
                                        onClick={() => window.open(company.website, "_blank")}
                                        className="w-full rounded-lg"
                                        size="sm"
                                    >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Visit Website
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Related Content Section */}
                {!loadingRelated && (relatedJobs.length > 0 || relatedEvents.length > 0) && (
                    <div className="mt-16 space-y-8">
                        {/* Related Jobs */}
                        {relatedJobs.length > 0 && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold text-slate-900">Open Positions</h2>
                                    {relatedJobs.length >= 3 && company && (
                                        <Link to={`/jobs?company=${company.id}`}>
                                            <Button variant="outline" size="sm">
                                                View All
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {relatedJobs.map((job) => (
                                        <Card 
                                            key={job.id} 
                                            className="hover:shadow-lg transition-shadow cursor-pointer"
                                            onClick={() => navigate(`/jobs/${job.id}`)}
                                        >
                                            <CardHeader>
                                                <CardTitle className="text-lg line-clamp-2">{job.title}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">
                                                    <Badge variant="outline">{job.type}</Badge>
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <MapPin className="h-4 w-4" />
                                                        <span className="line-clamp-1">{job.location}</span>
                                                    </div>
                                                    {job.postingDate && (
                                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                                            <Calendar className="h-4 w-4" />
                                                            <span>Posted {new Date(job.postingDate).toLocaleDateString()}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Related Events */}
                        {relatedEvents.length > 0 && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold text-slate-900">Upcoming Events</h2>
                                    {relatedEvents.length >= 3 && (
                                        <Link to="/events">
                                            <Button variant="outline" size="sm">
                                                View All
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {relatedEvents.map((event) => (
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
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
