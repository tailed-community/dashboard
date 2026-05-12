/**
 * Registration and Attendee types for event management
 */

export interface FormAnswer {
  questionId?: string | null;
  label: string;
  value: any;
}

export interface Registration {
  id: string;
  userId: string;
  eventId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: 'mentor' | 'judge' | 'participant';
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'waitlisted' | 'attended' | 'no-show';
  registeredAt: string | Date;
  registeredBy?: string;
  source: 'form' | 'self-join' | 'admin-import';
  communityId?: string | null;
  formId?: string | null;
  formLabel?: string | null;
  formAnswers?: FormAnswer[];
  reviewedBy?: string;
  reviewedAt?: string | Date;
  approvedAt?: string | Date;
  reviewNotes?: string | null;
  updatedAt?: string | Date;
}

export interface AttendeeListResponse {
  success: boolean;
  data: Registration[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export type SortByField = 'registeredAt' | 'firstName' | 'lastName' | 'status';
