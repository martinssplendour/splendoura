const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

export const API_BASE_URL = BASE_URL;
export const API_HOST = BASE_URL.replace(/\/api\/v1\/?$/, "");

export function resolveMediaUrl(url?: string | null) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_HOST}${url}`;
}

interface RequestOptions extends RequestInit {
  token?: string | null;
}

export async function apiFetch(endpoint: string, options: RequestOptions = {}) {
  const { token, ...rest } = options;
  const headers = new Headers(rest.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (rest.body && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers,
  });
}
