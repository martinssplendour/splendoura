// lib/api.ts
import { getAccessTokenMemory, setAccessTokenMemory } from "@/lib/token-store";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";
export const API_HOST = BASE_URL.replace(/\/api\/v1\/?$/, "");

interface RequestOptions extends RequestInit {
  token?: string | null;
}

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async () => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      setAccessTokenMemory(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:session-expired"));
      }
      return null;
    }
    const data: { access_token: string; refresh_token?: string | null } = await res.json();
    setAccessTokenMemory(data.access_token);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("auth:token-refreshed", {
          detail: { access_token: data.access_token, refresh_token: data.refresh_token ?? null },
        })
      );
    }
    return data.access_token;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

export async function apiFetch(endpoint: string, options: RequestOptions = {}) {
  const { token, ...rest } = options;

  const buildHeaders = (authToken?: string | null) => {
    const headers = new Headers(rest.headers);
    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }
    if (!(rest.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  };

  const initialToken = token || getAccessTokenMemory();
  let response = await fetch(`${BASE_URL}${endpoint}`, {
    ...rest,
    credentials: "include",
    headers: buildHeaders(initialToken),
  });

  if (response.status === 401 && !endpoint.startsWith("/auth/")) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(`${BASE_URL}${endpoint}`, {
        ...rest,
        credentials: "include",
        headers: buildHeaders(refreshed),
      });
    }
  }

  if (response.status === 401) {
    // Logic for refresh token would go here (omitted for brevity but hooks into AuthContext)
    console.error("Unauthorized - Session expired");
  }

  return response;
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_HOST}${url}`;
}
