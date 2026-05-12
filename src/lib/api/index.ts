// Re-export all API types
export * from './types';

// Re-export generic client utilities
export { apiRequest, buildFormData, parseApiError } from './client';

// Re-export community API functions
export {
  getCommunities,
  getCommunitiesForSelection,
  getCommunity,
  getCommunityAdmin,
  createCommunity,
  updateCommunity,
  joinCommunity,
  leaveCommunity,
} from './communities';
