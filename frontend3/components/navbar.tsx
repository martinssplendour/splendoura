// components/navbar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

const chatBadgeKey = (userId: number) => `navBadge:lastChat:${userId}`;
const notificationBadgeKey = (userId: number) => `navBadge:lastNotif:${userId}`;

export default function Navbar() {
  // Assuming your useAuth hook returns a user object and a logout function
  // If not, you can remove these lines for now
  const { user, logout, accessToken } = useAuth() || {};
  const pathname = usePathname();
  const isGroups = pathname?.startsWith("/groups");
  const isChatDetail = pathname?.startsWith("/chat/") && pathname !== "/chat";
  const [badgeCounts, setBadgeCounts] = useState({
    unread_chats: 0,
    pending_requests: 0,
    match_count: 0,
  });
  const [hasChatBadge, setHasChatBadge] = useState(false);
  const [hasNotificationBadge, setHasNotificationBadge] = useState(false);

  const badgeKeys = useMemo(() => {
    if (!user?.id) return null;
    return {
      chat: chatBadgeKey(user.id),
      notifications: notificationBadgeKey(user.id),
    };
  }, [user?.id]);

  const readBadgeValue = (key: string) => {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(key);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const writeBadgeValue = (key: string, value: number) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, `${value}`);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!accessToken || !user?.id) {
      setBadgeCounts({ unread_chats: 0, pending_requests: 0, match_count: 0 });
      setHasChatBadge(false);
      setHasNotificationBadge(false);
      return;
    }
    let active = true;
    const loadBadges = async () => {
      try {
        const res = await apiFetch("/users/me/badges", { token: accessToken });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setBadgeCounts({
          unread_chats: Number(data?.unread_chats || 0),
          pending_requests: Number(data?.pending_requests || 0),
          match_count: Number(data?.match_count || 0),
        });
      } catch {
        // ignore badge failures
      }
    };
    loadBadges();
    const interval = window.setInterval(loadBadges, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [accessToken, user?.id]);

  useEffect(() => {
    if (!badgeKeys) return;
    const lastChat = readBadgeValue(badgeKeys.chat);
    const lastNotif = readBadgeValue(badgeKeys.notifications);
    const notificationCount = badgeCounts.pending_requests + badgeCounts.match_count;
    setHasChatBadge(badgeCounts.unread_chats > lastChat);
    setHasNotificationBadge(notificationCount > lastNotif);
  }, [badgeCounts, badgeKeys]);

  useEffect(() => {
    if (!badgeKeys) return;
    if (pathname?.startsWith("/chat")) {
      writeBadgeValue(badgeKeys.chat, badgeCounts.unread_chats);
      setHasChatBadge(false);
    }
    if (pathname?.startsWith("/notifications") || pathname?.startsWith("/requests")) {
      const notificationCount = badgeCounts.pending_requests + badgeCounts.match_count;
      writeBadgeValue(badgeKeys.notifications, notificationCount);
      setHasNotificationBadge(false);
    }
  }, [badgeCounts.pending_requests, badgeCounts.unread_chats, badgeCounts.match_count, badgeKeys, pathname]);

  const isActive = (href: string, aliases: string[] = []) =>
    pathname === href ||
    pathname?.startsWith(`${href}/`) ||
    aliases.some((alias) => pathname === alias || pathname?.startsWith(`${alias}/`));

  if (pathname === "/") {
    return null;
  }

  return (
    <nav className="bg-slate-50">
      {!isChatDetail ? (
        <div className="container mx-auto flex items-start justify-between gap-2 px-4 py-2">
          <div className="flex flex-col gap-0.5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 shadow-[0_2px_6px_rgba(99,102,241,0.15)]"
            >
              <Image
                src="/brand/icon.png"
                alt="Splendoure"
                width={18}
                height={18}
                className="h-[18px] w-[18px]"
              />
              <span className="text-[1.125rem] font-extrabold uppercase leading-none tracking-[0.07em] text-indigo-700">
                Splendoure
              </span>
            </Link>
            {pathname?.startsWith("/groups") ? (
              <p className="text-[0.625rem] font-semibold text-slate-600/70">
                Discover plans and swipe to join
              </p>
            ) : null}
          </div>
          {/* Right Side Actions */}
          <div className="mt-0 flex items-start gap-3">
            {isGroups ? (
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <Link
                    href="/groups?filters=open"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.6875rem] font-semibold text-slate-600 shadow-sm sm:px-4 sm:py-2 sm:text-sm"
                  >
                    Filters
                  </Link>
                  <Link
                    href="/groups/create"
                    className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-[0.6875rem] font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 sm:px-4 sm:py-2 sm:text-sm"
                  >
                    Create group
                  </Link>
                </div>
                <Link
                  href="/groups?findType=open"
                  className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[0.6875rem] font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 sm:px-4 sm:py-2 sm:text-sm"
                >
                  Find my type
                </Link>
              </div>
            ) : null}
            <div className={`items-center gap-3 ${user ? "hidden md:flex" : "flex"}`}>
              {user ? (
                <>
                  <span className="text-sm text-slate-600">
                    Hello, {user.full_name || user.name || "User"}
                  </span>
                  <Link href="/profile">
                    <Button variant="ghost">Profile</Button>
                  </Link>
                  <Link href="/chat">
                    <Button variant="ghost" className="relative">
                      Chat
                      {hasChatBadge ? (
                        <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                      ) : null}
                    </Button>
                  </Link>
                  <Link href="/notifications">
                    <Button variant="ghost" className="relative">
                      Notifications
                      {hasNotificationBadge ? (
                        <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                      ) : null}
                    </Button>
                  </Link>
                  {user.role === "admin" ? (
                    <Link href="/admin/verification">
                      <Button variant="ghost">Admin</Button>
                    </Link>
                  ) : null}
                  <Button variant="ghost" onClick={() => logout && logout()}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/auth/login">
                    <Button variant="ghost">Sign In</Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button>Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {user ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="flex min-h-[var(--ui-bottom-nav-height)] items-center justify-around px-3">
            <Link
              href="/groups"
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                isActive("/groups") ? "bg-slate-200 text-slate-900" : "text-slate-500"
              }`}
            >
              Discover
            </Link>
            <Link
              href="/chat"
              className={`relative rounded-full px-3 py-2 text-xs font-semibold ${
                isActive("/chat") ? "bg-slate-200 text-slate-900" : "text-slate-500"
              }`}
            >
              Chats
              {hasChatBadge ? (
                <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
              ) : null}
            </Link>
            <Link
              href="/notifications"
              className={`relative rounded-full px-3 py-2 text-xs font-semibold ${
                isActive("/notifications", ["/requests"])
                  ? "bg-slate-200 text-slate-900"
                  : "text-slate-500"
              }`}
            >
              Notifications
              {hasNotificationBadge ? (
                <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
              ) : null}
            </Link>
            <Link
              href="/profile"
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                isActive("/profile") ? "bg-slate-200 text-slate-900" : "text-slate-500"
              }`}
            >
              Profile
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
