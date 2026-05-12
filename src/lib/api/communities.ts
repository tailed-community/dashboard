import { apiRequest, buildFormData, parseApiError } from './client';
import type {
  GetCommunitiesResponse,
  GetCommunityResponse,
  CreateCommunityResponse,
  CreateCommunityFormData,
  UpdateCommunityFormData,
  CommunityResponse,
} from './types';

export async function getCommunities(options?: {
  category?: string;
  search?: string;
  limit?: number;
}): Promise<CommunityResponse[]> {
  try {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.search) params.append('search', options.search);
    if (options?.limit) params.append('limit', String(options.limit));

    const endpoint = `/public/communities${params.toString() ? `?${params}` : ''}`;
    const response = await apiRequest<GetCommunitiesResponse>(endpoint, {
      method: 'GET',
      isPublic: true,
    });

    return response.communities;
  } catch (error) {
    const err = parseApiError(error);
    throw new Error(err.message);
  }
}

/**
 * Fetch all communities for authenticated user (for selection in event creation)
 * Requires authentication
 */
export async function getCommunitiesForSelection(limit?: number): Promise<CommunityResponse[]> {
  try {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));

    const endpoint = `/communities${params.toString() ? `?${params}` : ''}`;
    const response = await apiRequest<GetCommunitiesResponse>(endpoint, {
      method: 'GET',
    });

    return response.communities;
  } catch (error) {
    const err = parseApiError(error);
    throw new Error(err.message);
  }
}

/**
 * Fetch a single community by ID or slug (public endpoint)
 * No authentication required
 */
export async function getCommunity(idOrSlug: string): Promise<CommunityResponse> {
  try {
    const response = await apiRequest<GetCommunityResponse>(`/public/communities/${idOrSlug}`, {
      method: 'GET',
      isPublic: true,
    });

    return response.community;
  } catch (error) {
    const err = parseApiError(error);
    throw new Error(err.message);
  }
}

/**
 * Fetch a single community by ID (authenticated endpoint)
 * Requires authentication - used in admin panel
 */
export async function getCommunityAdmin(idOrSlug: string): Promise<CommunityResponse> {
  try {
    const response = await apiRequest<GetCommunityResponse>(`/communities/${idOrSlug}`, {
      method: 'GET',
    });

    return response.community;
  } catch (error) {
    const err = parseApiError(error);
    throw new Error(err.message);
  }
}

/**
 * Create a new community
 * Requires authentication
 * Supports optional logo and banner file uploads
 */
export async function createCommunity(payload: CreateCommunityFormData): Promise<string> {
  try {
    const { logo, banner, ...fields } = payload;
    const body: Record<string, any> = { ...fields };
    if (logo) body.logo = logo;
    if (banner) body.banner = banner;

    const formData = buildFormData(body);

    const response = await apiRequest<CreateCommunityResponse>('/communities', {
      method: 'POST',
      body: formData,
    });

    return response.communityId;
  } catch (error) {
    const err = parseApiError(error);
    throw new Error(err.message);
  }
}

/**
 * Update a community
 * Requires authentication and admin permissions
 * Supports optional logo and banner file uploads
 */
export async function updateCommunity(
  communityId: string,
  payload: UpdateCommunityFormData
): Promise<void> {
  try {
    const { logo, banner, ...fields } = payload;

    const body: Record<string, any> = { ...fields };
    if (logo) body.logo = logo;
    if (banner) body.banner = banner;

    const formData = buildFormData(body);

    await apiRequest('/communities/' + communityId, {
      method: 'PATCH',
      body: formData,
    });
  } catch (error) {
    const err = parseApiError(error);
    throw new Error(err.message);
  }
}

/**
 * Join a community
 * Requires authentication
 */
export async function joinCommunity(communityId: string): Promise<void> {
  try {
    await apiRequest(`/communities/${communityId}/join`, {
      method: 'POST',
    });
  } catch (error) {
    const err = parseApiError(error);
    throw new Error(err.message);
  }
}

/**
 * Leave a community
 * Requires authentication
 */
export async function leaveCommunity(communityId: string): Promise<void> {
  try {
    await apiRequest(`/communities/${communityId}/leave`, {
      method: 'POST',
    });
  } catch (error) {
    const err = parseApiError(error);
    throw new Error(err.message);
  }
}
