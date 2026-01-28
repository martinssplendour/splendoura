"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

interface MembershipItem {
  id: number;
  user_id: number;
  group_id: number;
  join_status: "requested" | "approved" | "rejected";
  role: "creator" | "member";
  request_message?: string | null;
  request_tier?: string | null;
}

interface UserSummary {
  id: number;
  full_name?: string;
  email: string;
  profile_image_url?: string;
}

interface RequestItem {
  group_id: number;
  group_title: string;
  user_id: number;
  user?: UserSummary;
  request_message?: string | null;
  request_tier?: string | null;
}

export default function RequestsPage() {
  const { accessToken, user } = useAuth();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequests() {
      setError(null);
      setLoading(true);
      try {
        if (!accessToken || !user?.id) {
          setLoading(false);
          return;
        }

        const groupsRes = await apiFetch(`/groups/?creator_id=${user.id}`, { token: accessToken });
        if (!groupsRes.ok) {
          const message = await groupsRes.text().catch(() => "");
          setError(message || "Unable to load your groups.");
          setLoading(false);
          return;
        }
        const groupData: { id: number; title: string }[] = await groupsRes.json();

        const nextUsers: Record<number, UserSummary> = {};
        const nextRequests: RequestItem[] = [];

        for (const group of groupData) {
          const membersRes = await apiFetch(`/groups/${group.id}/members`, { token: accessToken });
          if (!membersRes.ok) {
            continue;
          }
          const members: MembershipItem[] = await membersRes.json();
          const requestedMembers = members.filter((m) => m.join_status === "requested");

          for (const member of requestedMembers) {
            if (nextUsers[member.user_id]) {
              nextRequests.push({
                group_id: group.id,
                group_title: group.title,
                user_id: member.user_id,
                user: nextUsers[member.user_id],
                request_message: member.request_message,
                request_tier: member.request_tier,
              });
              continue;
            }
            const userRes = await apiFetch(`/users/${member.user_id}`, { token: accessToken });
            if (userRes.ok) {
              const userSummary = await userRes.json();
              nextUsers[member.user_id] = userSummary;
              nextRequests.push({
                group_id: group.id,
                group_title: group.title,
                user_id: member.user_id,
                user: userSummary,
                request_message: member.request_message,
                request_tier: member.request_tier,
              });
            } else {
              nextRequests.push({
                group_id: group.id,
                group_title: group.title,
                user_id: member.user_id,
                request_message: member.request_message,
                request_tier: member.request_tier,
              });
            }
          }
        }

        setRequests(nextRequests);
        setLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load join requests.";
        setError(message);
        setLoading(false);
      }
    }

    loadRequests();
  }, [accessToken, user?.id]);

  const handleDecision = async (
    groupId: number,
    userId: number,
    action: "approve" | "reject"
  ) => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${groupId}/${action}/${userId}`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      setRequests((prev) =>
        prev.filter((item) => !(item.group_id === groupId && item.user_id === userId))
      );
    }
  };

  if (!accessToken) {
    return (
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-700">Sign in to manage requests.</p>
        <Link href="/auth/login" className="text-sm text-blue-600">
          Go to sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="mx-auto h-64 w-full max-w-3xl animate-pulse rounded-none bg-slate-200 sm:rounded-3xl" />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 rounded-none border border-rose-100 bg-rose-50 p-6 text-center sm:rounded-3xl">
        <p className="text-sm font-semibold text-rose-700">Unable to load join requests</p>
        <p className="text-xs text-rose-600">{error}</p>
        <Button onClick={() => window.location.reload()} className="bg-blue-600 text-white hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Join Requests</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review pending requests for the groups you created.
        </p>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-slate-600">No pending requests right now.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const displayName =
              request.user?.full_name || request.user?.email || `User ${request.user_id}`;
            return (
              <div
                key={`${request.group_id}-${request.user_id}`}
                className="flex flex-col gap-4 rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  {request.user?.profile_image_url ? (
                    <img
                      src={resolveMediaUrl(request.user.profile_image_url)}
                      alt={displayName}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-slate-200" />
                  )}
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {displayName} wants to join{" "}
                    <span className="text-slate-900">{request.group_title}</span>
                  </p>
                  {request.request_tier === "superlike" ? (
                    <span className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      Superlike
                    </span>
                  ) : null}
                  {request.request_message ? (
                    <p className="mt-2 text-xs text-slate-600">{request.request_message}</p>
                  ) : null}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <Link href={`/groups/${request.group_id}`} className="text-blue-600">
                        View group
                      </Link>
                      <span className="text-slate-400">|</span>
                      <Link href={`/users/${request.user_id}`} className="text-blue-600">
                        View profile
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleDecision(request.group_id, request.user_id, "reject")}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Decline
                  </Button>
                  <Button
                    onClick={() => handleDecision(request.group_id, request.user_id, "approve")}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Accept
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

