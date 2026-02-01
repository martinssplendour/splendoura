"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/signed-media";

interface PendingUser {
  id: number;
  email: string;
  full_name: string;
  username?: string | null;
  profile_image_url?: string | null;
  verification_status?: string | null;
}

export default function VerificationAdminPage() {
  const { accessToken, user } = useAuth();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadPending() {
      if (!accessToken) return;
      const res = await apiFetch("/admin/users/pending", { token: accessToken });
      if (res.ok) {
        setPending(await res.json());
      }
    }
    loadPending();
  }, [accessToken]);

  const handleAction = async (id: number, action: "verify" | "reject") => {
    if (!accessToken) return;
    const res = await apiFetch(`/admin/users/${id}/${action}`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      setPending((prev) => prev.filter((entry) => entry.id !== id));
      setStatus(`User ${action}d.`);
    } else {
      const data = await res.json().catch(() => null);
      setStatus(data?.detail || "Action failed.");
    }
  };

  if (user?.role !== "admin") {
    return <p className="text-sm text-slate-600">Admin access required.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Verification Requests</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review pending profiles and approve or reject verification.
        </p>
      </div>

      {status ? <p className="text-sm text-slate-600">{status}</p> : null}

      {pending.length === 0 ? (
        <p className="text-sm text-slate-500">No pending users.</p>
      ) : (
        <div className="space-y-4">
          {pending.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-4">
                {entry.profile_image_url ? (
                  <SignedImage
                    src={entry.profile_image_url}
                    alt={entry.full_name}
                    className="h-16 w-16 rounded-2xl object-cover"
                  />
                ) : null}
                <div className="flex-1">
                  <p className="text-lg font-semibold text-slate-900">{entry.full_name}</p>
                  <p className="text-sm text-slate-600">{entry.email}</p>
                  {entry.username ? (
                    <p className="text-xs text-slate-500">@{entry.username}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleAction(entry.id, "verify")}>Approve</Button>
                  <Button variant="outline" onClick={() => handleAction(entry.id, "reject")}>
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
