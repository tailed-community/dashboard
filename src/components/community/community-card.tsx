import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Users, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Community {
  id: string;
  name: string;
  description: string;
  shortDescription?: string;
  slug?: string;
  category: string;
  memberCount: number;
  bannerUrl?: string;
  logoUrl?: string;
  members?: string[]; // Avatar URLs or initials
}

interface CommunityCardProps {
  community: Community;
  className?: string;
  onJoin?: (communityId: string) => void;
  onClick?: () => void;
  currentUserId?: string;
  isJoining?: boolean;
}

export function CommunityCard({
  community,
  className,
  onJoin,
  onClick,
  currentUserId,
  isJoining = false,
}: CommunityCardProps) {
  const handleJoin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onJoin) {
      onJoin(community.id);
    }
  };

  const isMember = currentUserId && community.members?.includes(currentUserId);

  const formatMemberCount = () => {
    if (community.memberCount >= 1000) {
      const value = (community.memberCount / 1000).toFixed(1).replace(/\.0$/, "");
      return `${value}k`;
    }
    return community.memberCount.toString();
  };

  return (
    <Card 
      className={cn("p-0 gap-0 hover:shadow-lg transition-shadow", onClick && "cursor-pointer", className)}
      onClick={onClick}
    >
      {/* Banner */}
      <div className="relative h-44 rounded-t-xl">
        {community.bannerUrl ? (
          <img
            src={community.bannerUrl}
            alt={community.name}
            className="w-full h-full object-cover rounded-t-xl"
          />
        ) : (
          <div className="w-full h-full rounded-t-xl bg-gradient-to-br from-slate-100 to-slate-200" />
        )}
        
        {/* Community size - top right */}
        <div className="absolute top-3 right-3 bg-white rounded-full px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium shadow-sm">
          <Users className="h-4 w-4 text-gray-600" />
          <span className="text-gray-900">{formatMemberCount()}</span>
        </div>

        {/* Logo - overlaying banner at bottom left */}
        <div className="absolute -bottom-8 left-5 h-16 w-16 rounded-2xl shadow-lg border-4 border-white bg-white overflow-hidden">
          {community.logoUrl ? (
            <img
              src={community.logoUrl}
              alt={`${community.name} logo`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
              <span className="text-slate-600 font-bold text-xl">
                {community.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-10 pb-5">
        {/* Name */}
        <h3 className="font-bold text-xl mb-2 line-clamp-1 text-gray-900">
          {community.name}
        </h3>
        
        {/* Excerpt */}
        <p className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[2.5rem]">
          {community.shortDescription || community.description}
        </p>

        {/* Separator */}
        <Separator className="mb-4" />

        {/* Avatar icons overlaying and Join CTA */}
        <div className="flex items-center justify-between">
          {/* Member avatars */}
          <div className="flex -space-x-2">
            {community.members?.slice(0, 3).map((_, index) => {
              const grayShades = [
                "from-slate-200 to-slate-300",
                "from-slate-300 to-slate-400", 
                "from-slate-400 to-slate-500"
              ];
              return (
                <Avatar key={index} className="h-8 w-8 border-2 border-white shadow-sm">
                  <AvatarFallback className={`text-xs bg-gradient-to-br ${grayShades[index]} text-white font-medium`}>
                  </AvatarFallback>
                </Avatar>
              );
            })}
            {community.members && community.members.length > 3 && (
              <div className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700 shadow-sm">
                +{community.members.length - 3}
              </div>
            )}
          </div>

          {/* Join button */}
          <Button
            size="sm"
            variant={isMember ? "outline" : "default"}
            className={cn(
              "rounded-full px-6 font-medium shadow-sm",
              isMember 
                ? "border-gray-300 text-gray-700 hover:bg-brand-cream-100 hover:text-gray-500" 
                : "bg-gray-900 hover:bg-gray-800 text-white"
            )}
            onClick={handleJoin}
            disabled={isJoining}
          >
            {isJoining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isMember ? "Leaving..." : "Joining..."}
              </>
            ) : isMember ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Joined
              </>
            ) : (
              "Join"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
