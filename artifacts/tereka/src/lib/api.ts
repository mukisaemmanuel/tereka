import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

declare global {
  interface Window {
    __TEREKA_FETCH_INTERCEPTED__?: boolean;
  }
}

/**
 * Tereka API Client Configuration
 * Supports decoupled deployment (Vercel Frontend + Render Express Backend)
 */

export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export function getApiUrl(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint;
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem("tereka_auth_token");
  } catch {
    return null;
  }
}

export function getAuthHeaders(extraHeaders: HeadersInit = {}): HeadersInit {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

/**
 * Universal fetch wrapper for custom API calls.
 * Automatically prefixes API_BASE_URL, attaches Bearer token, and ensures credentials: 'include'.
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(endpoint);
  const token = getAuthToken();

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Authorization") && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || "include",
  });

  const contentType = response.headers.get("content-type") || "";
  let data: any = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const errorMessage =
      (typeof data === "object" && data?.error) ||
      (typeof data === "object" && data?.message) ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

// Global fetch interceptor for decoupled deployment
if (typeof window !== "undefined" && !window.__TEREKA_FETCH_INTERCEPTED__) {
  window.__TEREKA_FETCH_INTERCEPTED__ = true;
  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
    }

    // Intercept relative /api routes
    if (url.startsWith("/api/") || url === "/api" || url.startsWith("/health")) {
      const targetUrl = API_BASE_URL ? `${API_BASE_URL}${url}` : url;
      const token = getAuthToken();

      const headers = new Headers(
        init?.headers || (typeof input === "object" && "headers" in input ? (input as Request).headers : {})
      );
      if (!headers.has("Authorization") && token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const options: RequestInit = {
        ...init,
        headers,
        credentials: init?.credentials || "include",
      };

      return originalFetch(targetUrl, options);
    }

    return originalFetch(input, init);
  };
}

// Automatically configure @workspace/api-client-react hooks
if (API_BASE_URL) {
  setBaseUrl(API_BASE_URL);
}
setAuthTokenGetter(() => getAuthToken());
