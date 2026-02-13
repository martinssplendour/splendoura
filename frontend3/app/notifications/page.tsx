import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SignedImage } from "@/components/signed-media";

type GroupNotificationType = "join_request" | "join_approved" | "group_invite" | "new_message";

interface NotificationUser {
  id: number;
  full_name?: string;
  username?: string;
  profile_image_url?: string | null;
}

interface NotificationGroup {
  id: number;
  title: string;
  cover_image_url?: string | null;
}

interface GroupNotification {
  id: string;
  type: GroupNotificationType;
  created_at?: string | null;
  group: NotificationGroup;
  actor?: NotificationUser | null;
  message?: string | null;
  request_tier?: string | null;
  unread_count?: number | null;
}

interface MatchNotification {
  id: string;
  matched_at?: string | null;
  user: NotificationUser;
  chat_group_id?: number | null;
}

type SystemNotice = {
  id: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
};

const GROUP_CACHE_PREFIX = "notificationGroupsCache:v1:";
const MATCH_CACHE_PREFIX = "notificationMatchesCache:v1:";

function readCache<T>(key: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; items: T };
    if (!parsed?.items) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, items: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items }));
  } catch {
    // ignore cache write errors
  }
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function displayName(user?: NotificationUser | null) {
  if (!user) return "Someone";
  return user.full_name || user.username || `User ${user.id}`;
}

export default function NotificationsPage() {
  const { accessToken, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"groups" | "matches">("groups");
  const [groupNotifications, setGroupNotifications] = useState<GroupNotification[]>([]);
  const [matchNotifications, setMatchNotifications] = useState<MatchNotification[]>([]);
  const [groupLoading, setGroupLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const groupLoadedRef = useRef(false);
  const matchLoadedRef = useRef(false);

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
    if (!user?.id) return;
    const cachedGroups = readCache<GroupNotification[]>(`${GROUP_CACHE_PREFIX}${user.id}`);
    if (cachedGroups) {
      setGroupNotifications(cachedGroups);
      setGroupLoading(false);
      groupLoadedRef.current = true;
    }
    const cachedMatches = readCache<MatchNotification[]>(`${MATCH_CACHE_PREFIX}${user.id}`);
    if (cachedMatches) {
      setMatchNotifications(cachedMatches);
      matchLoadedRef.current = true;
    }
  }, [user?.id]);

  useEffect(() => {
    async function loadGroupNotifications() {
      if (!accessToken || !user?.id) return;
      setGroupError(null);
      if (!groupLoadedRef.current) {
        setGroupLoading(true);
      }
      try {
        const res = await apiFetch("/users/me/notifications/groups", { token: accessToken });
        if (!res.ok) {
          const message = await res.text().catch(() => "");
          throw new Error(message || "Unable to load group notifications.");
        }
        const data: GroupNotification[] = await res.json();
        setGroupNotifications(data);
        writeCache(`${GROUP_CACHE_PREFIX}${user.id}`, data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load group notifications.";
        setGroupError(message);
      } finally {
        setGroupLoading(false);
        groupLoadedRef.current = true;
      }
    }

    if (activeTab === "groups") {
      loadGroupNotifications();
    }
  }, [accessToken, activeTab, user?.id]);

  useEffect(() => {
    async function loadMatchNotifications() {
      if (!accessToken || !user?.id) return;
      setMatchError(null);
      if (!matchLoadedRef.current) {
        setMatchLoading(true);
      }
      try {
        const res = await apiFetch("/match/notifications", { token: accessToken });
        if (!res.ok) {
          const message = await res.text().catch(() => "");
          throw new Error(message || "Unable to load match notifications.");
        }
        const data: MatchNotification[] = await res.json();
        setMatchNotifications(data);
        writeCache(`${MATCH_CACHE_PREFIX}${user.id}`, data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load match notifications.";
        setMatchError(message);
      } finally {
        setMatchLoading(false);
        matchLoadedRef.current = true;
      }
    }

    if (activeTab === "matches") {
      loadMatchNotifications();
    }
  }, [accessToken, activeTab, user?.id]);

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
        <p className="mt-2 text-sm text-slate-600">Updates from your groups and matches.</p>
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Activity</h2>
            <p className="text-sm text-slate-600">
              Switch between group updates and profile matches.
            </p>
          </div>
          <div className="flex items-center rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("groups")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                activeTab === "groups"
                  ? "bg-white text-slate-900 shadow"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Group notifications
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("matches")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                activeTab === "matches"
                  ? "bg-white text-slate-900 shadow"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Match notifications
            </button>
          </div>
        </div>

        {activeTab === "groups" ? (
          <div className="mt-6 space-y-4">
            {groupLoading ? (
              <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-200" />
            ) : groupError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-700">Unable to load group notifications</p>
                <p className="text-xs text-rose-600">{groupError}</p>
              </div>
            ) : groupNotifications.length === 0 ? (
              <p className="text-sm text-slate-600">No new group updates right now.</p>
            ) : (
              groupNotifications.map((item) => {
                const actorName = displayName(item.actor);
                const title =
                  item.type === "join_request"
                    ? `${actorName} wants to join ${item.group.title}`
                    : item.type === "join_approved"
                    ? `You were approved to join ${item.group.title}`
                    : item.type === "group_invite"
                    ? `You were invited to ${item.group.title}`
                    : `New message in ${item.group.title}`;
                const subtitle =
                  item.type === "join_request"
                    ? item.message || "Tap to review their request."
                    : item.type === "join_approved"
                    ? "You can start chatting with the group."
                    : item.type === "group_invite"
                    ? "Open the group to see the details."
                    : item.message || `${item.unread_count || 0} new messages`;
                const meta = formatTime(item.created_at);
                const avatarUrl = item.actor?.profile_image_url || item.group.cover_image_url;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {avatarUrl ? (
                        <SignedImage
                          src={avatarUrl}
                          alt={actorName}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-slate-200" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{title}</p>
                        {item.request_tier === "superlike" ? (
                          <span className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Superlike
                          </span>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {meta ? <span>{meta}</span> : null}
                          <span className="text-slate-300">•</span>
                          <Link href={`/groups/${item.group.id}`} className="text-blue-600">
                            View group
                          </Link>
                          {item.type === "join_request" ? (
                            <>
                              <span className="text-slate-300">•</span>
                              <Link href="/requests" className="text-blue-600">
                                Manage requests
                              </Link>
                              {item.actor ? (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <Link href={`/users/${item.actor.id}`} className="text-blue-600">
                                    View profile
                                  </Link>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <span className="text-slate-300">•</span>
                              <Link href={`/chat/${item.group.id}`} className="text-blue-600">
                                Open chat
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {matchLoading ? (
              <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-200" />
            ) : matchError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-700">Unable to load match notifications</p>
                <p className="text-xs text-rose-600">{matchError}</p>
              </div>
            ) : matchNotifications.length === 0 ? (
              <p className="text-sm text-slate-600">No new matches yet.</p>
            ) : (
              matchNotifications.map((item) => {
                const name = displayName(item.user);
                const matchedAt = formatTime(item.matched_at);
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {item.user.profile_image_url ? (
                        <SignedImage
                          src={item.user.profile_image_url}
                          alt={name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-slate-200" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-800">You matched with {name}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {matchedAt ? `Matched ${matchedAt}` : "It’s a match!"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.chat_group_id ? (
                        <Link
                          href={`/chat/${item.chat_group_id}`}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                        >
                          Message
                        </Link>
                      ) : (
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-400">
                          Chat pending
                        </span>
                      )}
                      <Link
                        href={`/users/${item.user.id}`}
                        className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        View profile
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
}
