"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, API_HOST } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/signed-media";
import { writeMessageCache } from "@/lib/chat-cache";

type ThreadType = "group" | "dm";

interface GroupMessage {
  id: number;
  sender_id: number;
  content?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  message_type?: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
  read_by?: number[];
}

interface InboxThreadSummary {
  group_id: number;
  title: string;
  cover_image_url?: string | null;
  last_message?: GroupMessage | null;
  last_message_at?: string | null;
  unread_count?: number;
  updated_at?: string | null;
  created_at?: string | null;
}

interface Thread {
  id: string;
  type: ThreadType;
  title: string;
  avatarUrl?: string | null;
  lastMessageId?: number;
  lastMessageText?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: number;
  lastMessageSenderName?: string;
  unreadCount: number;
  unreadIds: number[];
  lastReadAt?: string;
  createdAt?: string | null;
  groupId?: number;
}

const MAX_BADGE_COUNT = 99;
const THREAD_CACHE_KEY = "chatThreadsCache:v1";
const THREAD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HYDRATE_CONCURRENCY = 6;

function formatInboxTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function describeMessage(message: GroupMessage | null) {
  if (!message) return "No messages yet.";
  const callMeta = (message.meta as Record<string, any> | null)?.call;
  if (callMeta?.mode) {
    return callMeta.mode === "voice" ? "Voice call started" : "Video call started";
  }
  if (message.message_type === "system") {
    return message.content?.trim() || "System update";
  }
  if (message.content?.trim()) return message.content.trim();
  if (message.attachment_type?.startsWith("image/")) return "Photo";
  if (message.attachment_type?.startsWith("audio/")) return "Voice message";
  if (message.attachment_url) return "Attachment";
  return "New message";
}

function buildPreview(
  message: GroupMessage | null,
  threadType: ThreadType,
  currentUserId?: number,
  senderName?: string
) {
  const body = describeMessage(message);
  if (!message || !currentUserId) return body;
  if (message.sender_id === currentUserId) return `You: ${body}`;
  if (threadType === "group") {
    return `${senderName || "Member"}: ${body}`;
  }
  return body;
}

function sortThreads(threads: Thread[]) {
  return [...threads].sort((a, b) => {
    const aTime = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
    if (aTime === bTime) return a.id.localeCompare(b.id);
    return bTime - aTime;
  });
}

function readThreadCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(THREAD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; threads: Thread[] };
    if (!parsed?.savedAt || !Array.isArray(parsed.threads)) return null;
    return parsed.threads;
  } catch {
    return null;
  }
}

function writeThreadCache(threads: Thread[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      THREAD_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), threads })
    );
  } catch {
    // ignore cache write errors
  }
}

export default function ChatPage() {
  const { accessToken, user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasCachedThreadsRef = useRef(false);
  const socketsRef = useRef<Record<number, WebSocket>>({});
  const loadIdRef = useRef(0);

  useEffect(() => {
    const cached = readThreadCache();
    if (cached && cached.length > 0) {
      const sorted = sortThreads(cached);
      setThreads(sorted);
      writeThreadCache(sorted);
      hasCachedThreadsRef.current = true;
    }
  }, []);

  const loadThreads = useCallback(async () => {
    if (!accessToken || !user?.id) return;
    const loadId = ++loadIdRef.current;
    if (!hasCachedThreadsRef.current) {
      setIsLoading(true);
    }
    setStatus(null);
    try {
      const res = await apiFetch("/users/me/inbox", { token: accessToken });
      if (!res.ok) {
        setStatus("Unable to load your conversations.");
        setIsLoading(false);
        return;
      }
      const inbox: InboxThreadSummary[] = await res.json();

      const baseThreads: Thread[] = inbox.map((item) => ({
        id: `group-${item.group_id}`,
        type: "group",
        title: item.title,
        avatarUrl: item.cover_image_url,
        lastMessageId: item.last_message?.id,
        lastMessageSenderId: item.last_message?.sender_id,
        lastMessageText: buildPreview(item.last_message || null, "group", user.id),
        lastMessageAt:
          item.last_message_at || item.updated_at || item.created_at || undefined,
        unreadCount: item.unread_count ?? 0,
        unreadIds: [],
        createdAt: item.created_at,
        groupId: item.group_id,
      }));

      const sortedThreads = sortThreads(baseThreads);
      setThreads(sortedThreads);
      setIsLoading(false);
      writeThreadCache(sortedThreads);

      const sortedGroups = [...inbox].sort((a, b) => {
        const aTime = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
      const hydrateTargets = sortedGroups;
      let idx = 0;

      const worker = async () => {
        while (idx < hydrateTargets.length) {
          const current = hydrateTargets[idx];
          idx += 1;
          let messages: GroupMessage[] = [];
          try {
            const messageRes = await apiFetch(`/groups/${current.group_id}/messages`, { token: accessToken });
            if (messageRes.ok) {
              messages = await messageRes.json();
            }
          } catch {
            messages = [];
          }
          writeMessageCache(current.group_id, messages);
        }
      };

      await Promise.all(Array.from({ length: HYDRATE_CONCURRENCY }, worker));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load conversations.";
      setStatus(message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, user?.id]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const threadIdsForSockets = useMemo(
    () =>
      threads
        .filter((thread) => thread.type === "group" && thread.groupId)
        .map((thread) => thread.groupId as number),
    [threads]
  );

  useEffect(() => {
    if (!accessToken || !user?.id) return;
    const base = API_HOST.replace(/^http/, "ws");
    const sockets = socketsRef.current;
    const activeIds = new Set(threadIdsForSockets);

    activeIds.forEach((groupId) => {
      if (sockets[groupId]) return;
      const socket = new WebSocket(`${base}/api/v1/ws/groups/${groupId}?token=${accessToken}`);
      sockets[groupId] = socket;

      socket.onmessage = (event) => {
        let payload: { type?: string; message?: GroupMessage };
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload.type !== "message:new" || !payload.message) return;

        const incoming = payload.message;
        setThreads((prev) => {
          const idx = prev.findIndex((thread) => thread.groupId === groupId);
          if (idx === -1) return prev;
          const existing = prev[idx];
          const isMine = incoming.sender_id === user.id;
          const nextUnreadIds = isMine ? existing.unreadIds : [...existing.unreadIds, incoming.id];
          const nextUnreadCount = isMine ? existing.unreadCount : existing.unreadCount + 1;
          const updated: Thread = {
            ...existing,
            lastMessageId: incoming.id,
            lastMessageSenderId: incoming.sender_id,
            lastMessageText: buildPreview(incoming, existing.type, user.id, existing.lastMessageSenderName),
            lastMessageAt: incoming.created_at,
            unreadCount: nextUnreadCount,
            unreadIds: nextUnreadIds,
          };
          const next = [...prev];
          next.splice(idx, 1);
          return sortThreads([updated, ...next]);
        });
      };

      socket.onclose = () => {
        delete sockets[groupId];
      };
    });

    Object.keys(sockets).forEach((groupId) => {
      const id = Number(groupId);
      if (!activeIds.has(id)) {
        sockets[id].close();
        delete sockets[id];
      }
    });
  }, [accessToken, threadIdsForSockets, user?.id]);

  useEffect(() => {
    return () => {
      Object.values(socketsRef.current).forEach((socket) => socket.close());
      socketsRef.current = {};
    };
  }, [accessToken]);

  const handleThreadOpen = useCallback(
    (thread: Thread) => {
      if (!thread.groupId) {
        return;
      }
      if (accessToken && thread.unreadIds.length > 0) {
        void apiFetch(`/groups/${thread.groupId}/messages/read`, {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ message_ids: thread.unreadIds }),
        });
      }
      setThreads((prev) =>
        prev.map((item) =>
          item.id === thread.id
            ? {
                ...item,
                unreadCount: 0,
                unreadIds: [],
                lastReadAt: item.lastMessageAt,
              }
            : item
        )
      );
    },
    [accessToken]
  );

  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-none border-0 bg-white shadow-none sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">Inbox</p>
          <h2 className="text-lg font-semibold text-slate-900">Conversations</h2>
        </div>
        <Button variant="outline" size="sm" onClick={loadThreads} disabled={isLoading}>
          {isLoading ? "Loading..." : "Refresh"}
        </Button>
      </div>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-4 py-5">
        {threads.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
            No conversations yet. Join a group to start chatting.
          </div>
        ) : null}
        <div className="space-y-2">
          {threads.map((thread) => {
            const unreadBadge =
              thread.unreadCount > 0
                ? thread.unreadCount > MAX_BADGE_COUNT
                  ? `${MAX_BADGE_COUNT}+`
                  : `${thread.unreadCount}`
                : null;

            return (
              <Link
                key={thread.id}
                href={thread.type === "group" && thread.groupId ? `/chat/${thread.groupId}` : "/chat"}
                onClick={() => handleThreadOpen(thread)}
                className="flex items-center gap-3 rounded-2xl border border-transparent bg-white px-3 py-3 transition hover:border-slate-200"
              >
                {thread.avatarUrl ? (
                  <SignedImage
                    src={thread.avatarUrl}
                    alt={thread.title}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-sm font-semibold text-slate-600">
                    {thread.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{thread.title}</p>
                    {thread.lastMessageAt ? (
                      <span className="text-xs text-slate-400">
                        {formatInboxTime(thread.lastMessageAt)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p
                      className={`truncate text-xs ${
                        thread.unreadCount > 0 ? "font-semibold text-slate-900" : "text-slate-500"
                      }`}
                    >
                      {thread.lastMessageText || "No messages yet."}
                    </p>
                    {unreadBadge ? (
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {unreadBadge}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        {status ? <p className="mt-3 text-sm text-slate-500">{status}</p> : null}
      </div>
    </div>
  );
}
