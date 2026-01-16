import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Loader2, Settings, Users, UserCog } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import CommunitySettingsTab from "./components/community-settings-tab.tsx";
import EventAttendeesTab from "./components/event-attendees-tab.tsx";
import CommunityMembersTab from "./components/community-members-tab.tsx";
import CommunityAdminsTab from "./components/community-admins-tab.tsx";

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
    createdAt: Date;
    updatedAt: Date;
    status: string;
};

export default function CommunityAdminPage() {
    const { id: slug } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [community, setCommunity] = useState<CommunityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCreator, setIsCreator] = useState(false);

    useEffect(() => {
        if (!slug || !user) {
            navigate("/communities");
            return;
        }

        const fetchCommunity = async () => {
            try {
                // Fetch community via API (supports both slug and ID)
                const response = await apiFetch(`/communities/${slug}`);
                const result = await response.json();

                if (!response.ok) {
                    // Handle 403 Forbidden - not creator
                    if (response.status === 403) {
                        toast.error("You don't have permission to access this page");
                        navigate(`/communities/${slug}`);
                        return;
                    }
                    
                    // Handle 404 Not Found
                    if (response.status === 404) {
                        toast.error("Community not found");
                        navigate("/communities");
                        return;
                    }

                    throw new Error(result.error || "Failed to load community");
                }

                const communityData = {
                    ...result.community,
                    createdAt: new Date(result.community.createdAt),
                    updatedAt: new Date(result.community.updatedAt),
                } as CommunityData;

                setCommunity(communityData);

                // Backend already validates creator access via authentication
                // If we get here, user is authorized
                setIsCreator(true);
            } catch (error) {
                console.error("Error fetching community:", error);
                toast.error("Failed to load community");
                navigate("/communities");
            } finally {
                setLoading(false);
            }
        };

        fetchCommunity();
    }, [slug, navigate, user]);

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-cream flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                    <p className="text-sm text-slate-600">Loading admin panel...</p>
                </div>
            </div>
        );
    }

    if (!community || !isCreator) {
        return null;
    }

    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="mx-auto max-w-7xl px-6 py-12">
                {/* Header */}
                <div className="mb-8 space-y-4">
                    <button
                        onClick={() => navigate(`/communities/${slug}`)}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Community
                    </button>

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-slate-900">
                                {community.name} Admin
                            </h1>
                            <p className="text-slate-600 mt-2">
                                Manage your community settings and event attendees
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabbed Interface */}
                <Tabs defaultValue="settings" className="w-full">
                    <TabsList className="grid w-full max-w-3xl grid-cols-4 mb-8">
                        <TabsTrigger value="settings" className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Settings
                        </TabsTrigger>
                        <TabsTrigger value="admins" className="flex items-center gap-2">
                            <UserCog className="h-4 w-4" />
                            Admins
                        </TabsTrigger>
                        <TabsTrigger value="members" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Members
                        </TabsTrigger>
                        <TabsTrigger value="attendees" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Import Attendees
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="settings">
                        <CommunitySettingsTab community={community} onUpdate={setCommunity} />
                    </TabsContent>

                    <TabsContent value="admins">
                        <CommunityAdminsTab 
                            communityId={community.id}
                        />
                    </TabsContent>

                    <TabsContent value="members">
                        <CommunityMembersTab 
                            communityId={community.id}
                        />
                    </TabsContent>

                    <TabsContent value="attendees">
                        <EventAttendeesTab communityId={community.id} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
