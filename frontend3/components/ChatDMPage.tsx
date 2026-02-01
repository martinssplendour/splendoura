"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Message = {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
};

type FetchOlderResult = {
  messages: Message[];
  hasMore: boolean;
};

const CURRENT_USER_ID = "me";
const PEER_USER_ID = "alex";
const TOP_FETCH_THRESHOLD = 120;
const BOTTOM_SNAP_THRESHOLD = 120;

const seedText = [
  "Hey! How did the event go?",
  "Super smooth. The networking part was great.",
  "Nice. Did you get the files I sent?",
  "Yep, just reviewing now.",
  "Let me know if you want edits before the morning.",
  "Will do. Thanks!",
];

const realtimeText = [
  "Quick update: I pushed the new build.",
  "Can we hop on a call later?",
  "Just saw your notes. Makes sense.",
  "I'll send the recap in 10.",
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildInitialMessages() {
  const now = Date.now();
  const messages: Message[] = [];
  for (let i = 0; i < 18; i += 1) {
    const senderId = i % 3 === 0 ? CURRENT_USER_ID : PEER_USER_ID;
    const createdAt = new Date(now - (18 - i) * 2 * 60_000).toISOString();
    messages.push({
      id: `seed-${i + 1}`,
      text: seedText[i % seedText.length],
      senderId,
      createdAt,
    });
  }
  return messages;
}

export default function ChatDMPage() {
  const initialMessages = useMemo(() => buildInitialMessages(), []);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showNewPill, setShowNewPill] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pendingPrependRef = useRef<{ prevScrollTop: number; prevScrollHeight: number } | null>(null);
  const hasInitialScrollRef = useRef(false);
  const oldestCreatedAtRef = useRef(new Date(initialMessages[0]?.createdAt ?? Date.now()));
  const nextIdRef = useRef(initialMessages.length + 1);
  const pageCountRef = useRef(0);

  const isNearBottom = useCallback((container: HTMLDivElement) => {
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distance < BOTTOM_SNAP_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior, block: "end" });
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    setShowNewPill(false);
    setNewMessageCount(0);
  }, []);

  const mockFetchOlder = useCallback(async (): Promise<FetchOlderResult> => {
    // TODO: Replace with real API call (pass cursor/oldest message id).
    await delay(650);
    if (pageCountRef.current >= 3) {
      return { messages: [], hasMore: false };
    }
    pageCountRef.current += 1;

    const batchSize = 10;
    const base = oldestCreatedAtRef.current;
    const olderMessages: Message[] = [];
    for (let i = batchSize; i >= 1; i -= 1) {
      const createdAt = new Date(base.getTime() - i * 4 * 60_000);
      olderMessages.push({
        id: `old-${nextIdRef.current++}`,
        text: `Earlier message #${pageCountRef.current}.${batchSize - i + 1}`,
        senderId: i % 2 === 0 ? CURRENT_USER_ID : PEER_USER_ID,
        createdAt: createdAt.toISOString(),
      });
    }
    oldestCreatedAtRef.current = new Date(base.getTime() - batchSize * 4 * 60_000);
    return { messages: olderMessages, hasMore: true };
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (isFetchingOlder || !hasMore) return;
    const container = scrollRef.current;
    if (!container) return;
    setIsFetchingOlder(true);

    pendingPrependRef.current = {
      prevScrollTop: container.scrollTop,
      prevScrollHeight: container.scrollHeight,
    };

    const result = await mockFetchOlder();
    if (result.messages.length) {
      setMessages((prev) => [...result.messages, ...prev]);
    } else {
      pendingPrependRef.current = null;
    }
    setHasMore(result.hasMore);
    setIsFetchingOlder(false);
  }, [hasMore, isFetchingOlder, mockFetchOlder]);

  const handleIncomingMessage = useCallback(
    (message: Message) => {
      const container = scrollRef.current;
      const shouldAutoScroll = container ? isNearBottom(container) : true;
      setMessages((prev) => [...prev, message]);
      if (shouldAutoScroll) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
      } else {
        setShowNewPill(true);
        setNewMessageCount((count) => count + 1);
      }
    },
    [isNearBottom, scrollToBottom]
  );

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    // TODO: Replace with real send-message API call.
    const message: Message = {
      id: `local-${nextIdRef.current++}`,
      text: trimmed,
      senderId: CURRENT_USER_ID,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, message]);
    setDraft("");
    requestAnimationFrame(() => scrollToBottom("smooth"));
  }, [draft, scrollToBottom]);

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
        void loadOlderMessages();
      }
      if (isNearBottom(container)) {
        setShowNewPill(false);
        setNewMessageCount(0);
      }
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [isNearBottom, loadOlderMessages]);

  useEffect(() => {
    // TODO: Replace with real websocket subscription.
    const interval = window.setInterval(() => {
      const text = realtimeText[Math.floor(Math.random() * realtimeText.length)];
      handleIncomingMessage({
        id: `realtime-${nextIdRef.current++}`,
        text,
        senderId: PEER_USER_ID,
        createdAt: new Date().toISOString(),
      });
    }, 4200);

    return () => window.clearInterval(interval);
  }, [handleIncomingMessage]);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-5 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-base font-semibold text-emerald-700">
            A
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold text-slate-900">Alex Johnson</p>
            <p className="text-xs text-emerald-600">Online - Responds quickly</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
          >
            View profile
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 py-4">
          {hasMore ? (
            <div className="text-center text-xs text-slate-400">
              {isFetchingOlder ? "Loading earlier messages..." : "Pull up for history"}
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400">Start of conversation</div>
          )}

          {messages.map((message) => {
            const isMine = message.senderId === CURRENT_USER_ID;
            return (
              <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[72%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    isMine
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  <span className={`mt-1 block text-[11px] ${isMine ? "text-emerald-100" : "text-slate-400"}`}>
                    {formatTime(message.createdAt)}
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
              {newMessageCount > 0 ? `${newMessageCount} new message${newMessageCount > 1 ? "s" : ""}` : "New message"}
            </button>
          </div>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-3 px-5 py-4">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-slate-700"
            aria-label="Add attachment"
          >
            +
          </button>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message"
            className="min-h-[52px] flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <button
            type="button"
            onClick={handleSend}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
