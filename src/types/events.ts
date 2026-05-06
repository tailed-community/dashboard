/**
 * Event and Team types for event management
 */

export interface Team {
  id: string;
  name: string;
  maxSize: number;
  members: string[]; // Array of userId/email
  captainId: string;
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface EventData {
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
  requiresApproval?: boolean;
  registrationLink?: string;
  category: string;
  hostType: "community" | "custom";
  communityId?: string;
  communityName?: string;
  customHostName?: string;
  heroImage?: string;
  capacity?: number;
  maxTeamSize?: number; // Max team size for this event
  attendees: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  canEdit?: boolean;
  community?: CommunityData;
}

export interface CommunityData {
  name: string;
  logo?: string;
  logoUrl?: string;
  description?: string;
  shortDescription?: string;
  slug?: string;
}

export interface EventTeamResponse {
  success: boolean;
  data: Team;
  message?: string;
}

export interface EventTeamsListResponse {
  success: boolean;
  data: Team[];
}

export interface TeamMemberInfo extends Team {
  memberCount: number;
  isFull: boolean;
}
