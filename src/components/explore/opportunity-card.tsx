import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type OpportunityType = "job" | "company" | "featured" | "event" | "community";

export interface BaseOpportunity {
  id: string;
  type: OpportunityType;
}

export interface JobOpportunity extends BaseOpportunity {
  type: "job";
  title: string;
  company: string;
  location: string;
  jobType: "Internship" | "New Grad" | "Event" | "Full-time" | "Part-time";
  status?: "Active hiring" | "New" | "Register" | "Closed";
  timeAgo: string;
  logo?: string;
  color?: string;
  url?: string; // For external job links
  companySlug?: string; // Company slug for navigation
  companyId?: string; // Company ID as fallback
}

export interface CompanyOpportunity extends BaseOpportunity {
  type: "company";
  name: string;
  description: string;
  industry: string;
  tags: string[];
  openRoles: number;
  logo?: string;
  gradient?: string;
}

export interface CommunityOpportunity extends BaseOpportunity {
  type: "community";
  name: string;
  description: string;
  category: string;
  tags: string[];
  logo?: string;
  gradient?: string;
}

export interface FeaturedOpportunity extends BaseOpportunity {
  type: "featured";
  title: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  logo?: string;
  gradient?: string;
}

export interface EventOpportunity extends BaseOpportunity {
  type: "event";
  title: string;
  organization: string;
  date: string;
  time: string;
  logo?: string;
  color?: string;
}

export type Opportunity =
  | JobOpportunity
  | CompanyOpportunity
  | CommunityOpportunity
  | FeaturedOpportunity
  | EventOpportunity;

interface OpportunityCardProps {
  opportunity: Opportunity;
  className?: string;
}

export function OpportunityCard({
  opportunity,
  className,
}: OpportunityCardProps) {
  if (opportunity.type === "job") {
    return <JobCard opportunity={opportunity} className={className} />;
  }

  if (opportunity.type === "company") {
    return <CompanyCard opportunity={opportunity} className={className} />;
  }

  if (opportunity.type === "community") {
    return <CommunityCard opportunity={opportunity} className={className} />;
  }

  if (opportunity.type === "featured") {
    return <FeaturedCard opportunity={opportunity} className={className} />;
  }

  if (opportunity.type === "event") {
    return <EventCard opportunity={opportunity} className={className} />;
  }

  return null;
}

function JobCard({
  opportunity,
  className,
}: {
  opportunity: JobOpportunity;
  className?: string;
}) {
  const navigate = useNavigate();
  
  const getJobTypeBadgeColor = (jobType: string) => {
    switch (jobType) {
      case "Internship":
        return "bg-green-100 text-green-700 hover:bg-green-100";
      case "New Grad":
        return "bg-blue-100 text-blue-700 hover:bg-blue-100";
      case "Event":
        return "bg-orange-100 text-orange-700 hover:bg-orange-100";
      default:
        return "bg-brand-cream-100 text-brand-cream-700 hover:bg-brand-cream-100";
    }
  };

  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case "Active hiring":
        return "bg-green-100 text-green-700 hover:bg-green-100";
      case "New":
        return "bg-blue-100 text-blue-700 hover:bg-blue-100";
      case "Register":
        return "bg-purple-100 text-purple-700 hover:bg-purple-100";
      default:
        return "bg-brand-cream-100 text-brand-cream-700 hover:bg-brand-cream-100";
    }
  };

  const isExternal = !!opportunity.url;

  const handleClick = () => {
    if (isExternal && opportunity.url) {
      window.open(opportunity.url, "_blank", "noopener,noreferrer");
    } else {
      navigate(`/jobs/${opportunity.id}`);
    }
  };

  const handleCompanyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (opportunity.companySlug) {
      navigate(`/companies/${opportunity.companySlug}`);
    } else if (opportunity.companyId) {
      navigate(`/companies/${opportunity.companyId}`);
    }
  };

  return (
    <Card
      className={cn(
        "p-6 hover:shadow-md transition-shadow cursor-pointer border border-brand-cream-200",
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center text-brand-cream font-semibold overflow-hidden",
              !opportunity.logo && (opportunity.color || "bg-brand-cream-800"),
              (opportunity.companySlug || opportunity.companyId) && "cursor-pointer hover:opacity-80 transition-opacity"
            )}
            onClick={(opportunity.companySlug || opportunity.companyId) ? handleCompanyClick : undefined}
          >
            {opportunity.logo ? (
              <img
                src={opportunity.logo}
                alt={opportunity.company}
                className="w-full h-full object-cover"
              />
            ) : (
              opportunity.company.charAt(0)
            )}
          </div>
          <Badge className={getJobTypeBadgeColor(opportunity.jobType)}>
            {opportunity.jobType}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isExternal && (
            <ExternalLink className="w-4 h-4 text-brand-cream-500" />
          )}
          {opportunity.status && (
            <Badge className={getStatusBadgeColor(opportunity.status)}>
              {opportunity.status}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-1 mb-4">
        <h3 className="font-semibold text-lg text-brand-cream-900">
          {opportunity.title}
        </h3>
        {(opportunity.companySlug || opportunity.companyId) ? (
          <p 
            className="text-sm text-brand-cream-600 hover:text-brand-cream-800 cursor-pointer transition-colors"
            onClick={handleCompanyClick}
          >
            {opportunity.company}
          </p>
        ) : (
          <p className="text-sm text-brand-cream-600">{opportunity.company}</p>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-brand-cream-500">
        <div className="flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          <span>{opportunity.location}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{opportunity.timeAgo}</span>
        </div>
      </div>
    </Card>
  );
}

function CompanyCard({
  opportunity,
  className,
}: {
  opportunity: CompanyOpportunity;
  className?: string;
}) {
  const navigate = useNavigate();
  
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-0 hover:shadow-lg transition-shadow cursor-pointer",
        className
      )}
      onClick={() => navigate(`/companies/${opportunity.id}`)}
    >
      {/* Gradient Background */}
      <div
        className={cn(
          "absolute inset-0",
          opportunity.gradient ||
            "bg-gradient-to-br from-red-400 via-orange-400 to-pink-400"
        )}
      />

      {/* Content */}
      <div className="relative p-6 h-full flex flex-col">
        {/* Logo */}
        <div className="w-12 h-12 bg-brand-cream rounded-xl flex items-center justify-center mb-auto">
          {opportunity.logo ? (
            <img
              src={opportunity.logo}
              alt={opportunity.name}
              className="w-8 h-8"
            />
          ) : (
            <span className="text-xl font-bold text-brand-cream-800">
              {opportunity.name.charAt(0)}
            </span>
          )}
        </div>

        {/* Company Info */}
        <div className="mt-16 space-y-2">
          <h3 className="font-semibold text-xl text-brand-cream">
            {opportunity.name}
          </h3>
          <p className="text-brand-cream/90 text-sm line-clamp-2">
            {opportunity.description}
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {opportunity.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-brand-cream/20 text-brand-cream hover:bg-brand-cream/30 backdrop-blur-sm border-0"
              >
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-1 pt-2">
            <span className="text-brand-cream/90 text-sm">●</span>
            <span className="text-brand-cream/90 text-sm font-medium">
              {opportunity.openRoles} Open Roles
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CommunityCard({
  opportunity,
  className,
}: {
  opportunity: CommunityOpportunity;
  className?: string;
}) {
  const navigate = useNavigate();
  
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-0 hover:shadow-lg transition-shadow cursor-pointer",
        className
      )}
      onClick={() => navigate(`/communities/${opportunity.id}`)}
    >
      {/* Gradient Background */}
      <div
        className={cn(
          "absolute inset-0",
          opportunity.gradient ||
            "bg-gradient-to-br from-purple-400 via-pink-400 to-rose-400"
        )}
      />

      {/* Content */}
      <div className="relative p-6 h-full flex flex-col">
        {/* Logo */}
        <div className="w-12 h-12 bg-brand-cream rounded-xl flex items-center justify-center mb-auto">
          {opportunity.logo ? (
            <img
              src={opportunity.logo}
              alt={opportunity.name}
              className="w-8 h-8"
            />
          ) : (
            <span className="text-xl font-bold text-brand-cream-800">
              {opportunity.name.charAt(0)}
            </span>
          )}
        </div>

        {/* Community Info */}
        <div className="mt-16 space-y-2">
          <h3 className="font-semibold text-xl text-brand-cream">
            {opportunity.name}
          </h3>
          <p className="text-brand-cream/90 text-sm line-clamp-2">
            {opportunity.description}
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {opportunity.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-brand-cream/20 text-brand-cream hover:bg-brand-cream/30 backdrop-blur-sm border-0"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function FeaturedCard({
  opportunity,
  className,
}: {
  opportunity: FeaturedOpportunity;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-0 hover:shadow-lg transition-shadow",
        className
      )}
    >
      {/* Dark Background */}
      <div
        className={cn(
          "absolute inset-0",
          opportunity.gradient || "bg-gradient-to-br from-brand-cream-900 to-brand-cream-800"
        )}
      />

      {/* Content */}
      <div className="relative p-6 h-full flex flex-col">
        {/* Featured Badge */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-brand-cream/10 rounded">
            <svg
              className="w-4 h-4 text-brand-cream"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <span className="text-brand-cream/80 text-xs font-semibold uppercase tracking-wider">
            Featured
          </span>
        </div>

        {/* Title and Description */}
        <div className="space-y-2 mb-6">
          <h3 className="font-bold text-xl text-brand-cream leading-tight">
            {opportunity.title}
          </h3>
          <p className="text-brand-cream/80 text-sm">{opportunity.description}</p>
        </div>

        {/* CTA Button */}
        <Button
          className="w-full bg-brand-cream text-brand-cream-900 hover:bg-brand-cream-100 font-semibold mt-auto"
          asChild
        >
          <a href={opportunity.ctaUrl}>{opportunity.ctaText}</a>
        </Button>
      </div>
    </Card>
  );
}

function EventCard({
  opportunity,
  className,
}: {
  opportunity: EventOpportunity;
  className?: string;
}) {
  const navigate = useNavigate();
  
  return (
    <Card
      className={cn(
        "p-6 hover:shadow-md transition-shadow cursor-pointer border border-brand-cream-200",
        className
      )}
      onClick={() => navigate(`/events/${opportunity.id}`)}
    >
      {/* Header with Calendar Icon and Event Badge */}
      <div className="flex items-start justify-between mb-6">
        <div className="w-10 h-10 bg-brand-cream-100 rounded-lg flex items-center justify-center">
          <svg
            className="w-5 h-5 text-brand-cream-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
            <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
            <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
            <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          <span className="text-sm font-medium text-brand-cream-700">Event</span>
        </div>
      </div>

      {/* Event Details */}
      <div className="space-y-2 mb-6">
        <h3 className="font-semibold text-xl text-brand-cream-900">
          {opportunity.title}
        </h3>
        <p className="text-sm text-brand-cream-600">
          {opportunity.organization}
        </p>
        <p className="text-sm font-medium text-indigo-600">
          {opportunity.date} • {opportunity.time}
        </p>
      </div>

      {/* Footer with Avatars and Register Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-brand-cream flex items-center justify-center">
              <span className="text-xs font-semibold text-brand-cream">A</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-brand-cream flex items-center justify-center">
              <span className="text-xs font-semibold text-brand-cream">B</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-brand-cream-200 border-2 border-brand-cream flex items-center justify-center">
              <span className="text-xs font-semibold text-brand-cream-600">+24</span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="font-medium"
        >
          Register
        </Button>
      </div>
    </Card>
  );
}
