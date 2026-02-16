// frontend3/lib/auth-context.tsx
"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setAccessTokenMemory } from "@/lib/token-store";

// --- FIX START: Define API URL with Fallback ---
// This prevents "undefined" errors if the .env file isn't loading correctly
const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
// -----------------------------------------------

export interface User {
  id: number;
  email: string;
  username?: string;
  full_name: string;
  age: number;
  gender: string;
  sexual_orientation?: string;
  location_city?: string | null;
  location_country?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  verification_status?: string;
  role?: string;
  bio?: string;
  name?: string;
  profile_image_url?: string;
  profile_video_url?: string;
  interests?: string[];
  badges?: string[];
  reputation_score?: number;
  safety_score?: number;
  profile_details?: Record<string, unknown> | null;
  discovery_settings?: Record<string, unknown> | null;
  profile_media?: Record<string, unknown> | null;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (data: AuthResponse, redirectTo?: string) => void;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const router = useRouter();

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const data: { access_token: string; refresh_token: string } = await res.json();
        setAccessToken(data.access_token);
        setRefreshToken(data.refresh_token);
        setAccessTokenMemory(data.access_token);

        const userRes = await fetch(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
          credentials: "include",
        });
        if (userRes.ok) {
          const userData: User = await userRes.json();
          setUser(userData);
          return true;
        }
        setAccessToken(null);
        setRefreshToken(null);
        setAccessTokenMemory(null);
        return false;
      }
      setAccessToken(null);
      setRefreshToken(null);
      setAccessTokenMemory(null);
      return false;
    } catch (err) {
      console.error("Refresh failed:", err);
      setAccessToken(null);
      setRefreshToken(null);
      setAccessTokenMemory(null);
      return false;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await refreshSession();
    };
    initAuth();
  }, [refreshSession]);

  useEffect(() => {
    const onTokenRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<{ access_token: string; refresh_token: string | null }>).detail;
      if (!detail?.access_token) return;
      setAccessToken(detail.access_token);
      setRefreshToken(detail.refresh_token);
      setAccessTokenMemory(detail.access_token);
    };
    const onSessionExpired = () => {
      setAccessToken(null);
      setRefreshToken(null);
      setAccessTokenMemory(null);
      setUser(null);
    };
    window.addEventListener("auth:token-refreshed", onTokenRefreshed as EventListener);
    window.addEventListener("auth:session-expired", onSessionExpired);
    return () => {
      window.removeEventListener("auth:token-refreshed", onTokenRefreshed as EventListener);
      window.removeEventListener("auth:session-expired", onSessionExpired);
    };
  }, []);

  const login = (data: AuthResponse, redirectTo?: string) => {
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    setAccessTokenMemory(data.access_token);
    setUser(data.user);
    router.push(redirectTo || "/groups");
  };

  const logout = () => {
    const token = accessToken;
    void fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).catch(() => undefined);
    setAccessToken(null);
    setRefreshToken(null);
    setAccessTokenMemory(null);
    setUser(null);
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, refreshToken, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
