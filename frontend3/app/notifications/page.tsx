"use client";

import { useEffect, useMemo, useState } from "react";
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

type SystemNotice = {
  id: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export default function NotificationsPage() {
  const { accessToken, user } = useAuth();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);

  const systemNotices = useMemo<SystemNotice[]>(() => {
    if (!user) return [];
    const notices: SystemNotice[] = [];
    if (!user.profile_image_url) {
      notices.push({
        id: "add-photo",
        title: "Add a profile photo",
        description: "Profiles with a photo get more matches and can create groups.",
        ctaLabel: "Upload photo",
        ctaHref: "/profile",
      });
    }
    if (!user.bio) {
      notices.push({
        id: "add-bio",
        title: "Introduce yourself",
        description: "A short bio helps people know what you are about.",
        ctaLabel: "Edit bio",
        ctaHref: "/profile",
      });
    }
    if (user.verification_status !== "verified") {
      notices.push({
        id: "verify",
        title: "Verify your profile",
        description: "Verified profiles get more trust and visibility.",
        ctaLabel: "Start verification",
        ctaHref: "/profile",
      });
    }
    if (notices.length === 0) {
      notices.push({
        id: "all-good",
        title: "You are all caught up",
        description: "No new system updates right now.",
      });
    }
    return notices;
  }, [user]);

  useEffect(() => {
    async function loadRequests() {
      setRequestError(null);
      setLoadingRequests(true);
      try {
        if (!accessToken || !user?.id) {
          setLoadingRequests(false);
          return;
        }

        const groupsRes = await apiFetch(`/groups?creator_id=${user.id}`, { token: accessToken });
        if (!groupsRes.ok) {
          const message = await groupsRes.text().catch(() => "");
          setRequestError(message || "Unable to load your groups.");
          setLoadingRequests(false);
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
        setLoadingRequests(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load join requests.";
        setRequestError(message);
        setLoadingRequests(false);
      }
    }

    loadRequests();
  }, [accessToken, user?.id]);

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 rounded-none border border-slate-200 bg-white p-8 text-center sm:rounded-3xl">
        <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-600">Sign in to view updates.</p>
        <Link href="/auth/login" className="text-sm font-semibold text-blue-600">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
        <p className="mt-2 text-sm text-slate-600">
          Updates from your groups plus system reminders.
        </p>
      </div>

      <section className="rounded-none border-0 bg-white p-6 sm:rounded-3xl sm:border sm:border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">System updates</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {systemNotices.map((notice) => (
            <div
              key={notice.id}
              className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-sm font-semibold text-slate-800">{notice.title}</p>
              <p className="text-xs text-slate-600">{notice.description}</p>
              {notice.ctaHref ? (
                <Link
                  href={notice.ctaHref}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  {notice.ctaLabel || "View"}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-none border-0 bg-white p-6 sm:rounded-3xl sm:border sm:border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Join requests</h2>
            <p className="text-sm text-slate-600">People asking to join groups you created.</p>
          </div>
          <Link href="/requests" className="text-sm font-semibold text-blue-600">
            Manage requests
          </Link>
        </div>

        {loadingRequests ? (
          <div className="mt-5 h-40 w-full animate-pulse rounded-2xl bg-slate-200" />
        ) : requestError ? (
          <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-700">Unable to load join requests</p>
            <p className="text-xs text-rose-600">{requestError}</p>
          </div>
        ) : requests.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No pending requests right now.</p>
        ) : (
          <div className="mt-5 space-y-4">
            {requests.map((request) => {
              const displayName =
                request.user?.full_name || request.user?.email || `User ${request.user_id}`;
              return (
                <div
                  key={`${request.group_id}-${request.user_id}`}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
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
                        {displayName} wants to join <span className="text-slate-900">{request.group_title}</span>
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
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-none border-0 bg-white p-6 sm:rounded-3xl sm:border sm:border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">General updates</h2>
        <p className="mt-2 text-sm text-slate-600">
          We will surface match invites and group announcements here next.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/groups" className="text-xs font-semibold text-blue-600">
            Browse groups
          </Link>
          <span className="text-xs text-slate-400">•</span>
          <Link href="/profile" className="text-xs font-semibold text-blue-600">
            Update profile
          </Link>
        </div>
      </section>
    </div>
  );
}
