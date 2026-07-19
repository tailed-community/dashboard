import { useState, useEffect, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import { useAuth } from "@/hooks/use-auth";
import {
    Building2,
    MapPin,
    Users,
    Share2,
    ExternalLink,
    Loader2,
    Globe,
    Calendar,
} from "lucide-react";
import { HTMLContent } from "@/components/ui/html-content";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { toast } from "sonner";
import { Seo } from "@/components/seo";

function truncate(text: string, max = 160): string {
    const clean = text.trim();
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function isAbsoluteHttpUrl(url?: string | null): url is string {
    return !!url && /^https?:\/\//i.test(url);
}

/* ---- Local joy primitives (presentation only) ---- */

/** Small joy tint chip. */
function JoyChip({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
        >
            {children}
        </span>
    );
}

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
    datetime: Date;
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

                const data = await response.json();
                const companyData = data.company || data;
                setCompany(companyData);

                // Set jobs from company data
                if (companyData.jobs) {
                    setRelatedJobs(companyData.jobs.slice(0, 3));
                }

                // Check if user is following this company (from profile)
                if (user) {
                    try {
                        const profileResponse = await apiFetch("/profile");
                        if (profileResponse.ok) {
                            const profileData = await profileResponse.json();
                            const organizations = profileData.organizations || [];
                            const isFollowingCompany = organizations.some(
                                (org: any) => org.id === companyData.id
                            );
                            setIsFollowing(isFollowingCompany);
                        }
                    } catch (profileError) {
                        console.error("Error fetching profile:", profileError);
                    }
                }
            } catch (error) {
                console.error("Error fetching company:", error);
                toast.error("Failed to load company");
            } finally {
                setLoading(false);
            }
        };

        fetchCompany();
    }, [slug, navigate, user]);

    useEffect(() => {
        // TODO: Implement proper company-event relationship endpoint if needed
        // Current implementation was comparing company slug with event communityId (incorrect)
        setLoadingRelated(false);
        setRelatedEvents([]);
    }, [slug]);

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-joy-grass" />
                    <p className="text-sm text-joy-ink-muted">Loading company...</p>
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
                // Unsubscribe
                const response = await apiFetch(`/profile/organizations/${company.id}/unsubscribe`, {
                    method: "POST",
                });

                if (response.ok) {
                    const data = await response.json();
                    setIsFollowing(false);
                    toast.success(data.message || "Unfollowed company");
                } else {
                    const error = await response.json();
                    toast.error(error.error || "Failed to unfollow company");
                }
            } else {
                // Subscribe
                const response = await apiFetch(`/profile/organizations/${company.id}/subscribe`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: company.name,
                        logo: company.logo,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setIsFollowing(true);
                    toast.success(data.message || "Following company!");
                } else {
                    const error = await response.json();
                    toast.error(error.error || "Failed to follow company");
                }
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
            toast.error("An error occurred. Please try again.");
        } finally {
            setFollowLoading(false);
        }
    };

    const seoDescription = company.description
        ? truncate(company.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "))
        : `Jobs and opportunities at ${company.name} for students and new grads.`;
    const seoImage = isAbsoluteHttpUrl(company.logo) ? company.logo : undefined;

    return (
        <div className="min-h-screen">
            <Seo
                title={company.name}
                description={seoDescription}
                path={`/companies/${slug}`}
                image={seoImage}
            />
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
                            <div className="w-full aspect-square bg-gradient-to-br from-joy-grass via-joy-grass-bright to-joy-sky rounded-2xl flex items-center justify-center">
                                <Building2 className="w-16 h-16 text-white" />
                            </div>
                        )}
                    </div>

                    {/* Middle Column - Company Details */}
                    <div className="lg:col-span-1 space-y-10">
                        {/* Header */}
                        <div className="space-y-4">
                            <h1 className="joy-display text-4xl font-extrabold text-joy-ink leading-tight">
                                {company.name}
                            </h1>
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                                {company.industry && (
                                    <JoyChip className="bg-joy-grass/10 text-joy-grass">
                                        {company.industry}
                                    </JoyChip>
                                )}
                                {company.location && (
                                    <JoyChip className="bg-joy-sky/12 text-joy-sky-ink">
                                        <MapPin className="h-3 w-3" />
                                        {company.location}
                                    </JoyChip>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-joy-ink/8" />

                        {/* Description */}
                        {company.description && (
                            <div className="space-y-4">
                                <h2 className="joy-display text-xl font-extrabold text-joy-ink">
                                    About {company.name}
                                </h2>
                                <HTMLContent
                                    content={company.description}
                                    className="text-joy-ink-muted leading-relaxed"
                                />
                            </div>
                        )}

                        <div className="border-t border-joy-ink/8" />

                        {/* Company Details Grid */}
                        <div className="space-y-6">
                            {/* Website */}
                            {company.website && (
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-joy-grass/10 flex items-center justify-center flex-shrink-0">
                                        <Globe className="h-5 w-5 text-joy-grass" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-joy-ink">Website</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const url = company.website;
                                                if (url) window.open(url, "_blank");
                                            }}
                                            className="text-sm font-semibold text-joy-grass hover:underline"
                                        >
                                            {company.website.replace(/^https?:\/\//, '')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Location */}
                            {company.location && (
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-joy-sky/12 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="h-5 w-5 text-joy-sky-ink" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-joy-ink">Location</p>
                                        <p className="text-sm text-joy-ink-muted">{company.location}</p>
                                    </div>
                                </div>
                            )}

                            {/* Company Size */}
                            {company.size && (
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-joy-sun/25 flex items-center justify-center flex-shrink-0">
                                        <Users className="h-5 w-5 text-joy-sun-ink" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-joy-ink">Company Size</p>
                                        <p className="text-sm text-joy-ink-muted">{company.size}</p>
                                    </div>
                                </div>
                            )}

                            {/* Social Media */}
                            {((company.socialLinks && company.socialLinks.length > 0) || company.socialMedia?.linkedin || company.socialMedia?.twitter || company.socialMedia?.facebook) && (
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-joy-grass/10 flex items-center justify-center flex-shrink-0">
                                        <Share2 className="h-5 w-5 text-joy-grass" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-joy-ink mb-2">Social Media</p>
                                        <div className="flex flex-wrap gap-2">
                                            {/* New socialLinks structure */}
                                            {company.socialLinks?.map((link, index) => (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    onClick={() => window.open(link.url, "_blank")}
                                                    className="inline-flex items-center rounded-xl border-2 border-joy-ink/12 bg-white px-3 py-1.5 text-sm font-bold text-joy-ink transition hover:border-joy-grass/50"
                                                >
                                                    {link.type.charAt(0).toUpperCase() + link.type.slice(1)}
                                                </button>
                                            ))}
                                            {/* Legacy socialMedia structure (fallback) */}
                                            {!company.socialLinks && (
                                                <>
                                                    {company.socialMedia?.linkedin && (
                                                        <button
                                                            type="button"
                                                            onClick={() => window.open(company.socialMedia!.linkedin!, "_blank")}
                                                            className="inline-flex items-center rounded-xl border-2 border-joy-ink/12 bg-white px-3 py-1.5 text-sm font-bold text-joy-ink transition hover:border-joy-grass/50"
                                                        >
                                                            LinkedIn
                                                        </button>
                                                    )}
                                                    {company.socialMedia?.twitter && (
                                                        <button
                                                            type="button"
                                                            onClick={() => window.open(company.socialMedia!.twitter!, "_blank")}
                                                            className="inline-flex items-center rounded-xl border-2 border-joy-ink/12 bg-white px-3 py-1.5 text-sm font-bold text-joy-ink transition hover:border-joy-grass/50"
                                                        >
                                                            Twitter
                                                        </button>
                                                    )}
                                                    {company.socialMedia?.facebook && (
                                                        <button
                                                            type="button"
                                                            onClick={() => window.open(company.socialMedia!.facebook!, "_blank")}
                                                            className="inline-flex items-center rounded-xl border-2 border-joy-ink/12 bg-white px-3 py-1.5 text-sm font-bold text-joy-ink transition hover:border-joy-grass/50"
                                                        >
                                                            Facebook
                                                        </button>
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
                        <div className="sticky top-8 border border-joy-ink/8 rounded-2xl p-6 space-y-6 bg-white shadow-sm">
                            {/* Company Info Header */}
                            <div className="text-center pb-4 border-b border-joy-ink/8">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-joy-grass/10">
                                    <Building2 className="h-7 w-7 text-joy-grass" />
                                </div>
                                <h3 className="joy-display font-extrabold text-joy-ink">{company.name}</h3>
                                {company.industry && (
                                    <p className="text-sm text-joy-ink-muted mt-1">{company.industry}</p>
                                )}
                            </div>

                            {/* Quick Info */}
                            <div className="space-y-3 text-sm">
                                {company.location && (
                                    <div className="flex items-center gap-3">
                                        <MapPin className="h-4 w-4 text-joy-ink-muted flex-shrink-0" />
                                        <span className="text-joy-ink line-clamp-1">{company.location}</span>
                                    </div>
                                )}
                                {company.size && (
                                    <div className="flex items-center gap-3">
                                        <Users className="h-4 w-4 text-joy-ink-muted flex-shrink-0" />
                                        <span className="text-joy-ink">{company.size}</span>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-joy-ink/8" />

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={handleFollow}
                                    disabled={followLoading}
                                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 disabled:cursor-not-allowed disabled:opacity-50 ${
                                        isFollowing
                                            ? "border-2 border-joy-ink/12 bg-white text-joy-ink hover:border-joy-grass/50"
                                            : "bg-joy-grass text-white shadow-[0_3px_0_var(--joy-grass-deep)] hover:brightness-105 active:translate-y-[2px]"
                                    }`}
                                >
                                    {followLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            {isFollowing ? "Unfollowing..." : "Following..."}
                                        </>
                                    ) : (
                                        isFollowing ? "Following" : "Follow Company"
                                    )}
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleShare}
                                        aria-label="Share"
                                        className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-joy-ink/12 bg-white px-4 py-2 text-joy-ink transition hover:border-joy-grass/50"
                                    >
                                        <Share2 className="h-4 w-4" />
                                    </button>
                                </div>
                                {company.website && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const url = company.website;
                                            if (url) window.open(url, "_blank");
                                        }}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-joy-ink/12 bg-white px-4 py-2 text-sm font-bold text-joy-ink transition hover:border-joy-grass/50"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Visit Website
                                    </button>
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
                                    <h2 className="joy-display text-2xl font-extrabold text-joy-ink">Open Positions</h2>
                                    {relatedJobs.length >= 3 && company && (
                                        <PlaygroundButton to={`/jobs?company=${company.id}`} variant="outline">
                                            View All
                                        </PlaygroundButton>
                                    )}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {relatedJobs.map((job) => (
                                        <button
                                            key={job.id}
                                            type="button"
                                            onClick={() => navigate(`/jobs/${job.id}`)}
                                            className="rounded-2xl border border-joy-ink/8 bg-white p-5 text-left shadow-sm transition hover:border-joy-grass/40 hover:shadow-md"
                                        >
                                            <h3 className="text-lg font-bold text-joy-ink line-clamp-2">{job.title}</h3>
                                            <div className="mt-3 space-y-3">
                                                <JoyChip className="bg-joy-grass/10 text-joy-grass">{job.type}</JoyChip>
                                                <div className="flex items-center gap-2 text-sm text-joy-ink-muted">
                                                    <MapPin className="h-4 w-4" />
                                                    <span className="line-clamp-1">{job.location}</span>
                                                </div>
                                                {job.postingDate && (
                                                    <div className="flex items-center gap-2 text-sm text-joy-ink-muted">
                                                        <Calendar className="h-4 w-4" />
                                                        <span>Posted {new Date(job.postingDate).toLocaleDateString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Related Events */}
                        {relatedEvents.length > 0 && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="joy-display text-2xl font-extrabold text-joy-ink">Upcoming Events</h2>
                                    {relatedEvents.length >= 3 && (
                                        <PlaygroundButton to="/events" variant="outline">
                                            View All
                                        </PlaygroundButton>
                                    )}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {relatedEvents.map((event) => (
                                        <button
                                            key={event.id}
                                            type="button"
                                            onClick={() => navigate(`/events/${event.id}`)}
                                            className="overflow-hidden rounded-2xl border border-joy-ink/8 bg-white text-left shadow-sm transition hover:border-joy-grass/40 hover:shadow-md"
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
                                            <div className="p-5">
                                                <h3 className="text-lg font-bold text-joy-ink line-clamp-2">{event.title}</h3>
                                                <div className="mt-3 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <JoyChip className="bg-joy-grass/10 text-joy-grass">{event.category}</JoyChip>
                                                        <JoyChip className="bg-joy-sky/12 text-joy-sky-ink">{event.mode}</JoyChip>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-joy-ink-muted">
                                                        <Calendar className="h-4 w-4" />
                                                        <span>{new Date(event.datetime).toLocaleDateString()}</span>
                                                    </div>
                                                    {event.location && (
                                                        <div className="flex items-center gap-2 text-sm text-joy-ink-muted">
                                                            <MapPin className="h-4 w-4" />
                                                            <span className="line-clamp-1">{event.location}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
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
