import { studentAuth } from "./auth";

/**
 * Fetches data from a Firebase Function endpoint with authentication
 * Automatically adds the current user's ID token to the request headers
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  // check if user is student or org
  const user = studentAuth.currentUser;
  // Clone the headers to avoid mutating the original object
  const headers = new Headers(options.headers || {});

  // Add the auth token if a user is signed in
  if (user) {
    try {
      const token = await user.getIdToken();

      headers.set("Authorization", `Bearer ${token}`);
    } catch (error) {
      console.error("Error getting auth token:", error);
    }
  }

  // Merge the options with the updated headers
  const updatedOptions: RequestInit = {
    ...options,
    headers,
  };

  return fetch(url, updatedOptions);
}

/**
 * Wrapper for API calls to Firebase Functions endpoints
 * Automatically prefixes the API URL from environment variables
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  companiesCall: boolean = false,
): Promise<Response> {
  const apiUrl = companiesCall
    ? import.meta.env.VITE_COMPANIES_API_URL
    : import.meta.env.VITE_API_URL;
  const url = `${apiUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  return authenticatedFetch(url, options);
}

// Example usage:
// const response = await apiFetch('/auth/create-account', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify(userData),
// });
