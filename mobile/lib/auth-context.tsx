"use client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { API_BASE_URL } from "@/lib/api";
import { registerForPushNotificationsAsync } from "@/lib/push";

const fetchWithTimeout = async (
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 8000
) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

export interface User {
  id: number;
  email: string;
  username?: string;
  full_name: string;
  age: number;
  gender: string;
  sexual_orientation?: string;
  location_city?: string;
  location_country?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  verification_status?: string;
  role?: string;
  last_active_at?: string;
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
  profile_media?: {
    photos?: string[];
    prompts?: string[];
    anthem?: string;
    video_loops?: string[];
    photo_verified?: boolean;
  } | null;
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
  isLoading: boolean;
  login: (data: AuthResponse, redirectTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshSession = useCallback(async () => {
    try {
      const storedRefresh = refreshToken || (await AsyncStorage.getItem("refresh_token"));
      if (!storedRefresh) {
        return false;
      }

      const res = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: storedRefresh }),
      });

      if (!res.ok) {
        return false;
      }

      const data: { access_token: string; refresh_token: string } = await res.json();
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
      await AsyncStorage.setItem("refresh_token", data.refresh_token);

      const userRes = await fetchWithTimeout(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userRes.ok) {
        const userData: User = await userRes.json();
        setUser(userData);
      }
      return true;
    } catch (err) {
      console.error("Refresh failed:", err);
      return false;
    }
  }, [refreshToken]);

  useEffect(() => {
    let active = true;
    const initAuth = async () => {
      await refreshSession();
      if (active) {
        setIsLoading(false);
      }
    };
    initAuth();
    return () => {
      active = false;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!accessToken) return;
    registerForPushNotificationsAsync(accessToken).catch((err) => {
      console.warn("Push registration failed", err);
    });
  }, [accessToken]);

  const login = useCallback(
    async (data: AuthResponse, redirectTo?: string) => {
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
      await AsyncStorage.setItem("refresh_token", data.refresh_token);
      setUser(data.user);
      router.replace(redirectTo || "/groups");
    },
    [router]
  );

  const logout = useCallback(async () => {
    setAccessToken(null);
    setRefreshToken(null);
    await AsyncStorage.removeItem("refresh_token");
    setUser(null);
    router.replace("/");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, refreshToken, isLoading, login, logout, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
