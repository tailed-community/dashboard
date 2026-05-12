export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    details?: unknown;
}

/**
 * Discriminated union for error handling
 */
export type ApiError =
    | { success: false; code: 'NOT_FOUND'; message: string }
    | { success: false; code: 'FORBIDDEN'; message: string }
    | { success: false; code: 'UNAUTHORIZED'; message: string }
    | { success: false; code: 'BAD_REQUEST'; message: string; details?: unknown }
    | { success: false; code: 'CONFLICT'; message: string }
    | { success: false; code: 'INTERNAL_ERROR'; message: string };

/**
 * Event Types
 */
export type EventMode = 'Online' | 'In Person' | 'Hybrid';
export type EventStatus = 'draft' | 'published' | 'cancelled';
export type EventHostType = 'community' | 'custom';

export interface EventBase {
    title: string;
    description: string;
    startDate: string; // ISO date string
    startTime: string; // HH:mm format
    endDate?: string;
    endTime?: string;
    location?: string;
    city?: string;
    mode: EventMode;
    category: string;
    isPaid: boolean;
    capacity?: number;
    digitalLink?: string;
    registrationLink?: string;
    hostType?: EventHostType;
    customHostName?: string;
    communityId?: string;
    status?: EventStatus;
}

export interface CreateEventPayload extends EventBase {
    slug: string;
    awards?: CreateAwardPayload[];
}

export interface CreateEventFormData extends Omit<CreateEventPayload, 'awards'> {
    heroImage?: File;
    scheduleImage?: File;
    awards?: CreateAwardPayload[];
}

export interface UpdateEventPayload extends Partial<EventBase> {
    removeScheduleImage?: boolean;
}

export interface UpdateEventFormData extends Omit<UpdateEventPayload, never> {
    heroImage?: File;
    scheduleImage?: File;
    removeScheduleImage?: boolean;
}

export interface EventResponse extends EventBase {
    id: string;
    slug: string;
    heroImage?: string;
    scheduleImage?: string;
    createdBy: string;
    createdAt: string; // ISO 8601 string
    updatedAt: string; // ISO 8601 string
    attendees: number;
    canEdit?: boolean;
    community?: CommunityBasic;
}

export interface CommunityBasic {
    id: string;
    name: string;
    slug?: string;
    logo?: string;
    logoUrl?: string;
    shortDescription?: string;
}

export type AwardType = 'main_place' | 'special';
export type AwardPlace = 1 | 2 | 3 | null;

export interface AwardBase {
    type: AwardType;
    place?: AwardPlace;
    title: string;
    prizeDescription?: string;
    recipientIds?: string[];
}

export interface CreateAwardPayload extends AwardBase {
    // Enforced: main_place awards must have place
}

export interface UpdateAwardPayload extends Partial<AwardBase> {}

export interface AwardRecipient {
    userId: string;
    firstName: string;
    lastName: string;
    initials: string;
    displayName: string;
    email?: string;
}

export interface AwardResponse extends AwardBase {
    id: string;
    eventId: string;
    communityId?: string;
    createdBy: string;
    createdAt: string; // ISO 8601 string
    updatedAt: string; // ISO 8601 string
    recipientProfiles?: AwardRecipient[];
}


export interface CommunityBase {
    name: string;
    slug: string;
    shortDescription: string;
    description: string;
    category: string;
    websiteUrl?: string;
    discordUrl?: string;
    linkedinUrl?: string;
    instagramUrl?: string;
}

export interface CreateCommunityPayload extends CommunityBase {}

export interface CreateCommunityFormData extends Omit<CreateCommunityPayload, never> {
    logo?: File;
    banner?: File;
}

export interface UpdateCommunityPayload extends Partial<CommunityBase> {}

export interface UpdateCommunityFormData extends Omit<UpdateCommunityPayload, never> {
    logo?: File;
    banner?: File;
}

export interface CommunityResponse extends CommunityBase {
    id: string;
    logo?: string;
    banner?: string;
    logoUrl?: string;
    bannerUrl?: string;
    createdBy: string;
    admins: string[];
    members: string[];
    memberCount: number;
    eventCount?: number;
    createdAt: string; // ISO 8601 string
    updatedAt: string; // ISO 8601 string
}

/**
 * API List Response Envelope
 */
export interface ListResponse<T> {
    success: boolean;
    [key: string]: unknown; // events, communities, etc.
    count?: number;
}

/**
 * API Endpoint Response Types
 */
export interface GetEventsResponse {
    success: boolean;
    events: EventResponse[];
    count: number;
}

export interface GetEventResponse {
    success: boolean;
    event: EventResponse;
}

export interface CreateEventResponse {
    success: boolean;
    message: string;
    eventId: string;
}

export interface UpdateEventResponse {
    success: boolean;
    message: string;
}

export interface DeleteEventResponse {
    success: boolean;
    message: string;
}

export interface GetCommunitiesResponse {
    success: boolean;
    communities: CommunityResponse[];
    count: number;
}

export interface GetCommunityResponse {
    success: boolean;
    community: CommunityResponse;
}

export interface CreateCommunityResponse {
    success: boolean;
    message: string;
    communityId: string;
}

export interface UpdateCommunityResponse {
    success: boolean;
    message: string;
    logo?: string;
    banner?: string;
}

export interface DeleteCommunityResponse {
    success: boolean;
    message: string;
}

export interface JoinCommunityResponse {
    success: boolean;
    message: string;
}

export interface LeaveCommunityResponse {
    success: boolean;
    message: string;
}

/**
 * Award Endpoint Response Types
 */
export interface GetAwardsResponse {
    success: boolean;
    awards: AwardResponse[];
    count: number;
}

export interface CreateAwardResponse {
    success: boolean;
    message: string;
    award: AwardResponse;
}

export interface UpdateAwardResponse {
    success: boolean;
    message: string;
    award: AwardResponse;
}

export interface DeleteAwardResponse {
    success: boolean;
    message: string;
}

/**
 * Event Attendees Response
 */
export interface GetAttendeesResponse {
    success: boolean;
    registrations: EventAttendee[];
    count?: number;
}

export interface EventAttendee {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'waitlisted' | 'attended' | 'no-show';
}
