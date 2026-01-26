"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugToken, setDebugToken] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setDebugToken(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "Unable to request a reset link.");
      }

      setMessage("If an account exists, a reset link has been sent.");
      if (data?.reset_token) {
        setDebugToken(data.reset_token);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to request a reset link.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Forgot password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your email and we will send a reset link.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="you@example.com"
            />
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

          {debugToken ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Reset token (debug): {debugToken}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending link..." : "Send reset link"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Remembered it?{" "}
          <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
