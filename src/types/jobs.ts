export interface Job {
  id: string;
  title: string;
  type: string;
  location: string;
  status: "Active" | "Draft";
  description?: string;
  requirements?: string;
  postingDate?: string;
  endPostingDate?: string;
  startDate?: string;
  endDate?: string;
  salary?: {
    min?: number;
    max?: number;
  };
  visibility?: "restricted" | "link" | "public";
  publicToken?: string;
  // Fields used by frontend but not in the API response
  applicants?: number;
  applicantStats?: any;
  shareSettings?: ShareSettings;
  // Reference to the organization
  organization?: Organization;
}

export interface Organization {
  id: string;
  name: string;
  logo: string | null;
}

export interface ShareSettings {
  visibility: "restricted" | "link" | "public";
  shareLink?: string;
  sharedWith?: SharedUser[];
  lastUpdated?: string;
}

export interface SharedUser {
  id: string;
  email: string;
  name?: string;
  accessLevel: "view" | "edit";
  addedAt: string;
}
