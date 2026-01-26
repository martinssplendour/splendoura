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
}

export default function RequestsPage() {
  const { accessToken, user } = useAuth();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRequests() {
      if (!accessToken || !user?.id) {
        setLoading(false);
        return;
      }

      const groupsRes = await apiFetch(`/groups?creator_id=${user.id}`, { token: accessToken });
      if (!groupsRes.ok) {
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
            });
          } else {
            nextRequests.push({
              group_id: group.id,
              group_title: group.title,
              user_id: member.user_id,
            });
          }
        }
      }

      setRequests(nextRequests);
      setLoading(false);
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
    return <div className="mx-auto h-64 w-full max-w-3xl animate-pulse rounded-3xl bg-slate-200" />;
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
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
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
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <Link href={`/groups/${request.group_id}`} className="text-blue-600">
                        View group
                      </Link>
                      <span>•</span>
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
