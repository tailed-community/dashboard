import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove, increment, serverTimestamp } from "firebase/firestore";
import { getApp } from "firebase/app";
import { toast } from "sonner";
import { CommunityCard, type Community } from "@/components/community/community-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const categories = [
  "All",
  "Academic",
  "Technology",
  "Arts & Culture",
  "Sports",
  "Business",
  "Health & Wellness",
  "Social",
  "Professional",
];

export default function CommunityPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [communities, setcommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Fetch communities from Firestore
  useEffect(() => {
    const fetchcommunities = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const db = getFirestore(getApp());
        const communitiesRef = collection(db, "communities");
        const q = query(communitiesRef, orderBy("createdAt", "desc"));
        
        const querySnapshot = await getDocs(q);
        const fetchedcommunities: Community[] = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            description: data.description,
            shortDescription: data.shortDescription,
            slug: data.slug,
            category: data.category,
            memberCount: data.memberCount || 0,
            logoUrl: data.logoUrl,
            bannerUrl: data.bannerUrl,
            members: data.members || [],
          };
        });
        
        setcommunities(fetchedcommunities);
      } catch (err) {
        console.error("Error fetching communities:", err);
        setError("Failed to load communities. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchcommunities();
  }, []);

  // Filter communities based on search and category
  const filteredcommunities = communities.filter((community) => {
    const matchesSearch =
      searchQuery === "" ||
      community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      community.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" || community.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleJoin = async (communityId: string) => {
    if (!user) {
      toast.error("Please sign in to join communities");
      navigate("/sign-in");
      return;
    }

    setJoiningId(communityId);

    try {
      const db = getFirestore(getApp());
      const communityRef = doc(db, "communities", communityId);
      
      const community = communities.find(a => a.id === communityId);
      const isMember = community?.members?.includes(user.uid);

      if (isMember) {
        // Leave community
        await updateDoc(communityRef, {
          members: arrayRemove(user.uid),
          memberCount: increment(-1),
          updatedAt: serverTimestamp(),
        });

        // Update local state
        setcommunities(prev => prev.map(a => 
          a.id === communityId 
            ? { 
                ...a, 
                members: a.members?.filter(id => id !== user.uid) || [],
                memberCount: Math.max(0, a.memberCount - 1)
              }
            : a
        ));

        toast.success("Left community", {
          description: `You've left ${community?.name}`,
        });
      } else {
        // Join community
        await updateDoc(communityRef, {
          members: arrayUnion(user.uid),
          memberCount: increment(1),
          updatedAt: serverTimestamp(),
        });

        // Update local state
        setcommunities(prev => prev.map(a => 
          a.id === communityId 
            ? { 
                ...a, 
                members: [...(a.members || []), user.uid],
                memberCount: a.memberCount + 1
              }
            : a
        ));

        toast.success("Joined community!", {
          description: `Welcome to ${community?.name}`,
        });
      }
    } catch (error) {
      console.error("Error joining/leaving community:", error);
      toast.error("Failed to update membership", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold text-gray-900">
              Find your community
            </h1>
          </div>
          <p className="text-gray-600 mb-6">
            Discover clubs, join organizations, and connect with like-minded students.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "rounded-full",
                selectedCategory === category
                  ? "bg-black hover:bg-gray-800 text-white"
                  : "bg-white hover:bg-gray-50"
              )}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* communities Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-slate-400 mb-4" />
            <p className="text-slate-600">Loading communities...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 text-lg">{error}</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        ) : filteredcommunities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {filteredcommunities.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                onJoin={handleJoin}
                onClick={() => navigate(`/communities/${community.slug || community.id}`)}
                currentUserId={user?.uid}
                isJoining={joiningId === community.id}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {communities.length === 0
                ? "No communities yet."
                : "No communities found matching your criteria."}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {communities.length === 0
                ? ""
                : "Try adjusting your search or category filters."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
