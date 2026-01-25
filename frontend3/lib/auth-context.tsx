// frontend3/lib/auth-context.tsx
"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

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
      const storedRefresh = refreshToken || localStorage.getItem("refresh_token");
      if (!storedRefresh) {
        return false;
      }

      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: storedRefresh }),
      });

      if (res.ok) {
        const data: { access_token: string; refresh_token: string } = await res.json();
        setAccessToken(data.access_token);
        setRefreshToken(data.refresh_token);
        localStorage.setItem("refresh_token", data.refresh_token);

        const userRes = await fetch(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (userRes.ok) {
          const userData: User = await userRes.json();
          setUser(userData);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error("Refresh failed:", err);
      return false;
    }
  }, [refreshToken]);

  useEffect(() => {
    const initAuth = async () => {
      // Only fetch user if we have a token (or after refresh)
      const success = await refreshSession();
      
      // Note: We need the token from the refresh to make the next call. 
      // Since state updates are async, we might not have 'accessToken' available immediately 
      // in this closure unless we return it from refreshSession. 
      // For now, this logic relies on the refresh cookie logic usually.
      
      if (success) {
         // FIX: Use the safe API_URL constant
         // Ideally, you should pass the token explicitly if state hasn't updated yet
         // But if your cookies handle the refresh, this second call might be redundant 
         // if refreshSession already returned the user.
      }
    };
    initAuth();
  }, [refreshSession]);

  const login = (data: AuthResponse, redirectTo?: string) => {
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    setUser(data.user);
    router.push(redirectTo || "/groups");
  };

  const logout = () => {
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem("refresh_token");
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
