import { useState, useEffect } from "react";
import { OpportunityCard, type Opportunity } from "@/components/explore/opportunity-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";
import { getFirestore, collection, getDocs, query, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { getApp } from "firebase/app";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { type ExternalJob } from "@/types/jobs";

const INTERNSHIPS_URL =
  "https://raw.githubusercontent.com/tailed-community/tech-internships-2025-2026/refs/heads/main/data/current.json";
const NEW_GRADS_URL =
  "https://raw.githubusercontent.com/tailed-community/tech-new-grads-2025-2026/refs/heads/main/data/current.json";

export default function ExplorePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [allFetchedData, setAllFetchedData] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [visibleCount, setVisibleCount] = useState(12);
  const [totalCounts, setTotalCounts] = useState({
    featuredJobs: 0,
    internships: 0,
    newGrads: 0,
    events: 0,
    communities: 0,
  });
  const { user } = useAuth();
  
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        setLoading(true);
        const db = getFirestore(getApp());
        
        // Separate arrays for each type
        const featuredJobsArray: Opportunity[] = [];
        const internshipsArray: Opportunity[] = [];
        const newGradsArray: Opportunity[] = [];
        const eventsArray: Opportunity[] = [];
        const communitiesArray: Opportunity[] = [];

        // Fetch all data at once (no limits initially)
        const featuredJobsLimit = 50; // Reasonable max
        const internshipsLimit = 100;
        const newGradsLimit = 100;
        const eventsLimit = 20;
        const communitiesLimit = 20;

        // Fetch featured jobs and external jobs in parallel
        const results = await Promise.allSettled([
          apiFetch("/public/jobs", {}, true),
          fetch(INTERNSHIPS_URL),
          fetch(NEW_GRADS_URL),
        ]);

        const [featuredJobsResult, internshipsResult, newGradsResult] = results;

        let totalFeaturedJobs = 0;
        let totalInternships = 0;
        let totalNewGrads = 0;

        // Process featured jobs
        if (featuredJobsResult.status === "fulfilled") {
          try {
            const jobsData = await featuredJobsResult.value.json();
            const jobs = jobsData.jobs || [];
            totalFeaturedJobs = jobs.length;
            
            // Take limited featured jobs
            jobs.slice(0, featuredJobsLimit).forEach((job: any) => {
              const timeAgo = job.postingDate 
                ? calculateTimeAgo(new Date(job.postingDate))
                : "Recently posted";
              
              featuredJobsArray.push({
                id: `${job.id}`,
                type: "job",
                title: job.title,
                company: job.organization?.name || "Company",
                location: job.location || "Remote",
                jobType: mapJobType(job.type),
                status: job.status === "Active" ? "Active hiring" : undefined,
                timeAgo,
                logo: job.organization?.logo,
                color: getRandomColor(),
                companySlug: job.organization?.slug,
                companyId: job.organizationId,
              });
            });
          } catch (error) {
            console.error("Error parsing featured jobs:", error);
          }
        }

        // Process external internships
        if (internshipsResult.status === "fulfilled") {
          try {
            const internships: ExternalJob[] = await internshipsResult.value.json();
            totalInternships = internships.length;
            
            // Take limited internships
            internships.slice(0, internshipsLimit).forEach((job) => {
              const timeAgo = calculateTimeAgo(new Date(job.date_posted * 1000));
              
              internshipsArray.push({
                id: `external-${job.id}`,
                type: "job",
                title: job.title,
                company: job.company_name,
                location: job.locations.join(", ") || "Remote",
                jobType: "Internship",
                timeAgo,
                color: getRandomColor(),
                url: job.url,
              });
            });
          } catch (error) {
            console.error("Error parsing internships:", error);
          }
        }

        // Process external new grads
        if (newGradsResult.status === "fulfilled") {
          try {
            const newGrads: ExternalJob[] = await newGradsResult.value.json();
            totalNewGrads = newGrads.length;
            
            // Take limited new grad positions
            newGrads.slice(0, newGradsLimit).forEach((job) => {
              const timeAgo = calculateTimeAgo(new Date(job.date_posted * 1000));
              
              newGradsArray.push({
                id: `external-${job.id}`,
                type: "job",
                title: job.title,
                company: job.company_name,
                location: job.locations.join(", ") || "Remote",
                jobType: "New Grad",
                timeAgo,
                color: getRandomColor(),
                url: job.url,
              });
            });
          } catch (error) {
            console.error("Error parsing new grads:", error);
          }
        }

        // Fetch events
        const eventsRef = collection(db, "events");
        const eventsQuery = query(
          eventsRef,
          where("status", "==", "published"),
          where("datetime", ">=", Timestamp.now()),
          orderBy("datetime", "asc"),
          limit(eventsLimit)
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        const totalEvents = eventsSnapshot.size;
        
        eventsSnapshot.forEach((doc) => {
          const data = doc.data();
          const eventDate = data.datetime.toDate();
          
          eventsArray.push({
            id: doc.id,
            type: "event",
            title: data.title,
            organization: data.hostType === "community" && data.communityName 
              ? data.communityName 
              : data.customHostName || "Community Event",
            date: eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            time: eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
            color: "bg-blue-500",
          });
        });

        // Fetch communities/communities as company cards
        const communitiesRef = collection(db, "communities");
        const communitiesQuery = query(
          communitiesRef,
          orderBy("memberCount", "desc"),
          limit(communitiesLimit)
        );
        const communitiesSnapshot = await getDocs(communitiesQuery);
        const totalcommunities = communitiesSnapshot.size;
        
        communitiesSnapshot.forEach((doc) => {
          const data = doc.data();
          
          communitiesArray.push({
            id: data.slug || doc.id,
            type: "community",
            name: data.name,
            description: data.shortDescription || "Join our community",
            category: data.category || "Community",
            tags: [data.category || "Community", `${data.memberCount || 0} members`],
            logo: data.logoUrl,
            gradient: "bg-gradient-to-br from-purple-400 via-pink-400 to-rose-400",
          });
        });
        
        // Interleave opportunities to ensure each "page" has a mix of types
        const allOpportunities: Opportunity[] = [];
        const maxLength = Math.max(
          featuredJobsArray.length,
          internshipsArray.length,
          newGradsArray.length,
          eventsArray.length,
          communitiesArray.length
        );
        
        // Round-robin distribution to ensure even mixing
        for (let i = 0; i < maxLength; i++) {
          if (i < featuredJobsArray.length) allOpportunities.push(featuredJobsArray[i]);
          if (i < internshipsArray.length) allOpportunities.push(internshipsArray[i]);
          if (i < eventsArray.length) allOpportunities.push(eventsArray[i]);
          if (i < newGradsArray.length) allOpportunities.push(newGradsArray[i]);
          if (i < communitiesArray.length) allOpportunities.push(communitiesArray[i]);
        }
        
        setAllFetchedData(allOpportunities);
        setOpportunities(allOpportunities.slice(0, visibleCount));
        
        // Store total counts
        const counts = {
          featuredJobs: totalFeaturedJobs,
          internships: totalInternships,
          newGrads: totalNewGrads,
          events: totalEvents,
          communities: totalcommunities,
        };
        setTotalCounts(counts);
        
        // Log the totals for debugging
        console.log("Total counts by type:", counts);
        console.log("Interleaved opportunities:", allOpportunities.length);
        
        // Determine if there are more opportunities to load
        setHasMore(allOpportunities.length > visibleCount);
      } catch (error) {
        console.error("Error fetching opportunities:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, []);

  // Helper function to calculate time ago
  const calculateTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return `${Math.floor(diffInDays / 7)}w ago`;
    }
  };

  // Helper function to map job types
  const mapJobType = (type: string): "Internship" | "New Grad" | "Full-time" | "Part-time" | "Event" => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes("intern")) return "Internship";
    if (lowerType.includes("grad") || lowerType.includes("entry")) return "New Grad";
    if (lowerType.includes("part")) return "Part-time";
    return "Full-time";
  };

  // Helper function to get random color for job cards
  const getRandomColor = (): string => {
    const colors = [
      "bg-blue-600",
      "bg-purple-600",
      "bg-green-600",
      "bg-indigo-600",
      "bg-pink-600",
      "bg-slate-800",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Format current date
  const getCurrentDate = () => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).toUpperCase();
  };

  // Get user's display name or first name
  const getUserName = () => {
    if (!user) return "";
    return user.displayName || "there";
  };

  // Handle load more
  const handleLoadMore = () => {
    setLoadingMore(true);
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
    setLoadingMore(false);
  };

  // Update visible opportunities when visibleCount changes
  useEffect(() => {
    if (allFetchedData.length > 0) {
      setOpportunities(allFetchedData.slice(0, visibleCount));
      setHasMore(allFetchedData.length > visibleCount);
    }
  }, [visibleCount, allFetchedData]);

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          {user ? (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-500 mb-1">
                {getCurrentDate()}
              </p>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {getGreeting()}, {getUserName()}
              </h1>
                <Separator className="my-4" />
            </div>
          ) : (
            <>
              
            </>
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Explore Opportunities
              </h1>
              <p className="text-gray-600">
                Discover internships, jobs, companies, and events
              </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600 mb-4" />
            <p className="text-sm text-slate-600">Loading opportunities...</p>
          </div>
        ) : (
          <>
            {/* Opportunities Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {opportunities.map((opportunity) => {
                // Company and Community cards span 2 columns on larger screens
                const isLargeCard = opportunity.type === "company" || opportunity.type === "community";

                return (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    className={isLargeCard ? "md:col-span-2 h-full" : ""}
                  />
                );
              })}
            </div>

            {/* Load More Button */}
            {hasMore && opportunities.length > 0 && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  className="px-8"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load more opportunities"
                  )}
                </Button>
              </div>
            )}

            {/* Empty State */}
            {opportunities.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-500 text-lg">No opportunities available at the moment.</p>
                <p className="text-gray-400 text-sm mt-2">Check back later for new events and communities!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
