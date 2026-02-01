// lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";
export const API_HOST = BASE_URL.replace(/\/api\/v1\/?$/, "");
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

interface RequestOptions extends RequestInit {
  token?: string | null;
}

const readStoredAccessToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

const refreshAccessToken = async () => {
  if (typeof window === "undefined") return null;
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const data: { access_token: string; refresh_token: string } = await res.json();
  localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  return data.access_token;
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

  const initialToken = token || readStoredAccessToken();
  let response = await fetch(`${BASE_URL}${endpoint}`, {
    ...rest,
    headers: buildHeaders(initialToken),
  });

  if (response.status === 401 && !endpoint.startsWith("/auth/")) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(`${BASE_URL}${endpoint}`, {
        ...rest,
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
