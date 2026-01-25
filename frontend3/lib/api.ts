// lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

interface RequestOptions extends RequestInit {
  token?: string;
}

export async function apiFetch(endpoint: string, options: RequestOptions = {}) {
  const { token, ...rest } = options;
  
  const headers = new Headers(rest.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...rest,
    headers,
  });

  if (response.status === 401) {
    // Logic for refresh token would go here (omitted for brevity but hooks into AuthContext)
    console.error("Unauthorized - Session expired");
  }

  return response;
}