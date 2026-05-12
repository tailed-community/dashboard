import { apiFetch } from '../fetch';

function httpStatusToErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Generic API request wrapper with type safety
 * Handles JSON and FormData request bodies
 * Returns typed response or throws typed error
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
    headers?: Record<string, string>;
    body?: Record<string, any> | FormData;
    isPublic?: boolean;
  }
): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    body,
    isPublic = false,
  } = options || {};

  const fetchOptions: RequestInit = {
    method,
    headers: new Headers(headers),
  };

  // Handle body: JSON vs FormData
  if (body) {
    if (body instanceof FormData) {
      fetchOptions.body = body;
      // Don't set Content-Type for FormData — browser will set it with boundary
    } else {
      fetchOptions.headers?.set('Content-Type', 'application/json');
      fetchOptions.body = JSON.stringify(body);
    }
  }

  let response: Response;
  try {
    response = await apiFetch(endpoint, fetchOptions, isPublic);
  } catch (err) {
    throw {
      success: false,
      code: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Network request failed',
    };
  }

  const data = await response.json();

  // Check HTTP status and API success flag
  if (!response.ok) {
    const errorCode = httpStatusToErrorCode(response.status);
    const message = data.error || `Request failed with status ${response.status}`;

    throw {
      success: false,
      code: errorCode,
      message,
      details: data.details,
    };
  }

  // Return typed response (assume successful status = API success)
  return data as T;
}

/**
 * Build FormData from object, handling File fields
 */
export function buildFormData(data: Record<string, any>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (value instanceof File) {
      formData.append(key, value);
    } else if (typeof value === 'boolean') {
      formData.append(key, String(value));
    } else if (typeof value === 'number') {
      formData.append(key, String(value));
    } else if (typeof value === 'string') {
      formData.append(key, value);
    } else if (Array.isArray(value)) {
      // For arrays, convert to JSON string
      formData.append(key, JSON.stringify(value));
    } else if (typeof value === 'object') {
      // For objects, convert to JSON string
      formData.append(key, JSON.stringify(value));
    }
  }

  return formData;
}

/**
 * Utility: map HTTP response to typed error for error handling in components
 */
export function parseApiError(error: unknown): {
  code: string;
  message: string;
  details?: unknown;
} {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return error as { code: string; message: string; details?: unknown };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  };
}
