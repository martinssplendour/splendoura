"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setIsSubmitting(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 60000);

    try {
      console.log("Login request start", {
        apiBaseUrl: API_BASE_URL,
        email,
      });
      const body = new URLSearchParams();
      body.set("username", email);
      body.set("password", password);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      });
      console.log("Login response status", response.status);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const detail = (data?.detail || "Login failed.") as string;
        const lower = detail.toLowerCase();
        const mappedErrors: { email?: string; password?: string } = {};

        if (lower.includes("email")) {
          mappedErrors.email = detail;
        }
        if (lower.includes("password")) {
          mappedErrors.password = detail;
        }

        if (Object.keys(mappedErrors).length > 0) {
          setFieldErrors(mappedErrors);
        } else {
          setError(detail);
        }

        setIsSubmitting(false);
        return;
      }

      const tokenData: { access_token: string; refresh_token: string } = await response.json();
      console.log("Login token received");
      const userResponse = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        signal: controller.signal,
      });
      console.log("User profile response status", userResponse.status);

      if (!userResponse.ok) {
        throw new Error("Login succeeded, but user profile could not be loaded.");
      }

      const user = await userResponse.json();
      console.log("User profile loaded", user?.id);
      const skipped = localStorage.getItem("onboarding_skipped");
      const prompts = (user?.profile_media as Record<string, unknown> | null)?.prompts;
      const hasPrompts = Array.isArray(prompts) && prompts.length > 0;
      const needsOnboarding =
        !user?.profile_image_url ||
        !user?.bio ||
        !(user?.interests && user.interests.length > 0) ||
        !hasPrompts;
      const redirectTo =
        needsOnboarding && !skipped
          ? "/onboarding"
          : user?.verification_status === "verified"
            ? "/groups"
            : "/profile";
      login(
        { access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, user },
        redirectTo
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to sign in right now.";
      const isAbort =
        err instanceof DOMException
          ? err.name === "AbortError"
          : message.toLowerCase().includes("aborted");
      setError(
        isAbort
          ? "Sign in timed out after 60 seconds. Please try again."
          : message
      );
      console.error("Login request failed", err);
      setIsSubmitting(false);
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-none border-0 bg-white p-6 shadow-none sm:rounded-2xl sm:border sm:border-slate-200 sm:p-8 sm:shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in to continue discovering groups.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="you@example.com"
            />
            {fieldErrors.email ? (
              <p className="text-sm text-red-600">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password ? (
              <p className="text-sm text-red-600">{fieldErrors.password}</p>
            ) : null}
            <div className="text-right">
              <Link
                href="/auth/forgot"
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          New to Splendoura?{" "}
          <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-700">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
