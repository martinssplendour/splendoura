"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const tokenFromQuery = searchParams.get("token") || "";
  const [token, setToken] = useState(tokenFromQuery);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "Unable to reset password.");
      }
      setMessage("Password updated. You can sign in now.");
      setNewPassword("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to reset password.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Reset password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Paste your reset token and choose a new password.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="token">
              Reset token
            </label>
            <input
              id="token"
              type="text"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Paste your reset token"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="password">
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Create a new password"
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
          </div>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating password..." : "Reset password"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Back to{" "}
          <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
