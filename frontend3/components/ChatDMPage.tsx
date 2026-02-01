"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, API_HOST, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Group = {
  id: number;
  title: string;
  activity_type?: string | null;
  location?: string | null;
  approved_members?: number | null;
  max_participants?: number | null;
  cover_image_url?: string | null;
};

type GroupMessage = {
  id: number;
  sender_id: number;
  content?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  message_type?: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
  read_by?: number[];
};

const PAGE_SIZE = 30;
const TOP_FETCH_THRESHOLD = 120;
const BOTTOM_SNAP_THRESHOLD = 120;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function describeMessage(message: GroupMessage) {
  if (message.content?.trim()) return message.content.trim();
  if (message.attachment_type?.startsWith("image/")) return "Photo";
  if (message.attachment_type?.startsWith("audio/")) return "Voice message";
  if (message.attachment_url) return "Attachment";
  if (message.message_type === "system") return "System update";
  return "New message";
}

export default function ChatDMPage() {
  const params = useParams();
  const { accessToken, user } = useAuth();

  const groupId = useMemo(() => {
    const raw = params?.id;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }, [params]);

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showNewPill, setShowNewPill] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [layoutInsets, setLayoutInsets] = useState<{ top: number; bottom: number }>({
    top: 0,
    bottom: 0,
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pendingPrependRef = useRef<{ prevScrollTop: number; prevScrollHeight: number } | null>(null);
  const hasInitialScrollRef = useRef(false);
  const allMessagesRef = useRef<GroupMessage[]>([]);
  const visibleStartIndexRef = useRef(0);
  const pendingReadIdsRef = useRef<Set<number>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);

  const isNearBottom = useCallback((container: HTMLDivElement) => {
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distance < BOTTOM_SNAP_THRESHOLD;
  }, []);

  const markMessagesRead = useCallback(
    async (messageIds: number[]) => {
      if (!accessToken || !groupId || messageIds.length === 0) return;
      await apiFetch(`/groups/${groupId}/messages/read`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ message_ids: messageIds }),
      });
    },
    [accessToken, groupId]
  );

  const flushPendingReads = useCallback(() => {
    const pending = pendingReadIdsRef.current;
    if (pending.size === 0) return;
    const ids = Array.from(pending);
    pending.clear();
    void markMessagesRead(ids);
  }, [markMessagesRead]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior, block: "end" });
      } else if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      setShowNewPill(false);
      setNewMessageCount(0);
      flushPendingReads();
    },
    [flushPendingReads]
  );

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    const res = await apiFetch(`/groups/${groupId}`, accessToken ? { token: accessToken } : undefined);
    if (res.ok) {
      setGroup(await res.json());
    }
  }, [accessToken, groupId]);

  const loadMessages = useCallback(async () => {
    if (!accessToken || !groupId) return;
    setIsLoading(true);
    setStatus(null);
    try {
      const res = await apiFetch(`/groups/${groupId}/messages`, { token: accessToken });
      if (!res.ok) {
        setStatus("Unable to load messages for this chat.");
        setIsLoading(false);
        return;
      }
      const data: GroupMessage[] = await res.json();
      allMessagesRef.current = data;
      const startIndex = Math.max(data.length - PAGE_SIZE, 0);
      visibleStartIndexRef.current = startIndex;
      setMessages(data.slice(startIndex));
      setHasMore(startIndex > 0);
      setShowNewPill(false);
      setNewMessageCount(0);

      if (user?.id) {
        const unreadIds = data
          .filter(
            (message) =>
              message.sender_id !== user.id &&
              !(message.read_by || []).includes(user.id)
          )
          .map((message) => message.id);
        pendingReadIdsRef.current = new Set(unreadIds);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load messages.";
      setStatus(message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, groupId, user?.id]);

  const loadOlderMessages = useCallback(() => {
    if (isFetchingOlder || !hasMore) return;
    const container = scrollRef.current;
    if (!container) return;
    setIsFetchingOlder(true);
    pendingPrependRef.current = {
      prevScrollTop: container.scrollTop,
      prevScrollHeight: container.scrollHeight,
    };

    // TODO: Replace with a paginated backend endpoint for older messages.
    const nextStart = Math.max(visibleStartIndexRef.current - PAGE_SIZE, 0);
    visibleStartIndexRef.current = nextStart;
    setMessages(allMessagesRef.current.slice(nextStart));
    setHasMore(nextStart > 0);
    requestAnimationFrame(() => setIsFetchingOlder(false));
  }, [hasMore, isFetchingOlder]);

  const ingestMessage = useCallback(
    (incoming: GroupMessage, options?: { forceScroll?: boolean }) => {
      const alreadyExists = allMessagesRef.current.some((message) => message.id === incoming.id);
      if (!alreadyExists) {
        allMessagesRef.current = [...allMessagesRef.current, incoming];
      }

      setMessages((prev) => {
        if (prev.some((message) => message.id === incoming.id)) return prev;
        return [...prev, incoming];
      });

      const container = scrollRef.current;
      const isMine = incoming.sender_id === user?.id;
      const shouldAutoScroll =
        options?.forceScroll || isMine || (container ? isNearBottom(container) : true);

      if (shouldAutoScroll) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
        if (!isMine) {
          void markMessagesRead([incoming.id]);
        }
      } else if (!isMine) {
        pendingReadIdsRef.current.add(incoming.id);
        setShowNewPill(true);
        setNewMessageCount((count) => count + 1);
      }
    },
    [isNearBottom, markMessagesRead, scrollToBottom, user?.id]
  );

  const handleSend = useCallback(async () => {
    if (!accessToken || !groupId || isSending) return;
    const trimmed = draft.trim();
    if (!trimmed && !attachment) return;

    setIsSending(true);
    setStatus(null);
    const formData = new FormData();
    if (trimmed) formData.append("content", trimmed);
    if (attachment) formData.append("file", attachment);

    try {
      const res = await apiFetch(`/groups/${groupId}/messages`, {
        method: "POST",
        token: accessToken,
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to send message.");
      }
      const message: GroupMessage = await res.json();
      setDraft("");
      setAttachment(null);
      ingestMessage(message, { forceScroll: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send message.";
      setStatus(message);
    } finally {
      setIsSending(false);
    }
  }, [accessToken, attachment, draft, groupId, ingestMessage, isSending]);

  useEffect(() => {
    setGroup(null);
    setMessages([]);
    setDraft("");
    setAttachment(null);
    setStatus(null);
    setIsFetchingOlder(false);
    setHasMore(false);
    setShowNewPill(false);
    setNewMessageCount(0);
    allMessagesRef.current = [];
    visibleStartIndexRef.current = 0;
    pendingReadIdsRef.current.clear();
    hasInitialScrollRef.current = false;
  }, [groupId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useLayoutEffect(() => {
    const updateInsets = () => {
      const nav = document.querySelector("nav");
      const top = nav ? Math.round(nav.getBoundingClientRect().height) : 0;
      const bottomNav = nav?.querySelector(".fixed.bottom-0") as HTMLElement | null;
      const bottom = bottomNav ? Math.round(bottomNav.getBoundingClientRect().height) : 0;
      setLayoutInsets({ top, bottom });
    };
    updateInsets();
    window.addEventListener("resize", updateInsets);
    return () => window.removeEventListener("resize", updateInsets);
  }, []);

  useLayoutEffect(() => {
    const pending = pendingPrependRef.current;
    const container = scrollRef.current;
    if (!pending || !container) return;
    const nextScrollHeight = container.scrollHeight;
    container.scrollTop = nextScrollHeight - pending.prevScrollHeight + pending.prevScrollTop;
    pendingPrependRef.current = null;
  }, [messages.length]);

  useEffect(() => {
    if (hasInitialScrollRef.current) return;
    if (messages.length === 0) return;
    scrollToBottom("auto");
    hasInitialScrollRef.current = true;
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onScroll = () => {
      if (container.scrollTop <= TOP_FETCH_THRESHOLD) {
        loadOlderMessages();
      }
      if (isNearBottom(container)) {
        setShowNewPill(false);
        setNewMessageCount(0);
        flushPendingReads();
      }
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [flushPendingReads, isNearBottom, loadOlderMessages]);

  useEffect(() => {
    if (!accessToken || !groupId) return;
    const base = API_HOST.replace(/^http/, "ws");
    const socket = new WebSocket(`${base}/api/v1/ws/groups/${groupId}?token=${accessToken}`);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      let payload: { type?: string; message?: GroupMessage };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type === "message:new" && payload.message) {
        ingestMessage(payload.message);
      }
    };

    socket.onclose = () => {
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
    };

    return () => {
      socket.close();
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
    };
  }, [accessToken, groupId, ingestMessage]);

  const headerTitle = group?.title || "Chat";

  const showSend = Boolean(draft.trim()) || Boolean(attachment);

  return (
    <div
      className="flex min-h-0 flex-col bg-slate-50"
      style={{
        height: `calc(100vh - ${layoutInsets.top}px)`,
        paddingBottom: layoutInsets.bottom ? `${layoutInsets.bottom}px` : undefined,
      }}
    >
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-5 py-4">
          {group?.cover_image_url ? (
            <img
              src={resolveMediaUrl(group.cover_image_url)}
              alt={headerTitle}
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-base font-semibold text-emerald-700">
              {headerTitle.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <p className="text-base font-semibold text-slate-900">{headerTitle}</p>
            <p className="text-xs text-slate-500">
              {group ? `${group.approved_members ?? 0} members` : "Loading chat details..."}
            </p>
          </div>
          {groupId ? (
            <Link
              href={`/groups/${groupId}`}
              className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              View group
            </Link>
          ) : null}
        </div>
      </header>

      <div
        className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain"
        ref={scrollRef}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 py-4">
          {messages.length === 0 && !isLoading ? (
            <div className="text-center text-xs text-slate-400">
              No messages yet. Start the conversation.
            </div>
          ) : null}

          {messages.length > 0 ? (
            <div className="text-center text-xs text-slate-400">
              {hasMore
                ? isFetchingOlder
                  ? "Loading earlier messages..."
                  : "Pull up for history"
                : "Start of conversation"}
            </div>
          ) : null}

          {messages.map((message) => {
            const isMine = message.sender_id === user?.id;
            const attachmentUrl = message.attachment_url
              ? resolveMediaUrl(message.attachment_url)
              : null;
            const isImage = message.attachment_type?.startsWith("image/");
            const isAudio = message.attachment_type?.startsWith("audio/");
            const messageText = describeMessage(message);

            return (
              <div
                key={message.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[72%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    isMine
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {message.content?.trim() ? (
                    <p className="whitespace-pre-wrap">{message.content.trim()}</p>
                  ) : (
                    <p className="whitespace-pre-wrap">{messageText}</p>
                  )}
                  {attachmentUrl && isImage ? (
                    <img
                      src={attachmentUrl}
                      alt="Attachment"
                      className="mt-2 max-h-48 rounded-xl object-cover"
                    />
                  ) : null}
                  {attachmentUrl && isAudio ? (
                    <audio className="mt-2 w-full" controls src={attachmentUrl} />
                  ) : null}
                  {attachmentUrl && !isImage && !isAudio ? (
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-2 inline-flex text-xs font-semibold underline ${
                        isMine ? "text-emerald-100" : "text-emerald-600"
                      }`}
                    >
                      View attachment
                    </a>
                  ) : null}
                  <span
                    className={`mt-1 block text-[11px] ${
                      isMine ? "text-emerald-100" : "text-slate-400"
                    }`}
                  >
                    {formatTime(message.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {showNewPill ? (
          <div className="sticky bottom-4 flex justify-center px-5">
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30"
            >
              {newMessageCount > 0
                ? `${newMessageCount} new message${newMessageCount > 1 ? "s" : ""}`
                : "New message"}
            </button>
          </div>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-3 px-5 py-4">
          <label
            className={`flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 ${
              isSending ? "text-slate-300" : "text-slate-500 hover:text-slate-700"
            }`}
            title="Attach file"
          >
            <input
              type="file"
              className="hidden"
              onChange={(event) => setAttachment(event.target.files?.[0] || null)}
              disabled={isSending}
            />
            +
          </label>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder={groupId ? "Type a message" : "Select a chat"}
            className="min-h-[52px] flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
            disabled={!groupId || isSending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!showSend || isSending || !groupId}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
        {attachment ? (
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 pb-4 text-xs text-slate-500">
            <span>Attached: {attachment.name}</span>
            <button
              type="button"
              className="text-rose-500"
              onClick={() => setAttachment(null)}
            >
              Remove
            </button>
          </div>
        ) : null}
        {status ? (
          <div className="mx-auto w-full max-w-3xl px-5 pb-4 text-xs text-rose-500">
            {status}
          </div>
        ) : null}
      </footer>
    </div>
  );
}
