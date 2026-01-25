"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

interface ChatGroup {
  id: number;
  title: string;
  activity_type: string;
  location?: string | null;
  approved_members?: number | null;
  max_participants?: number | null;
  cover_image_url?: string | null;
}

interface GroupMessage {
  id: number;
  sender_id: number;
  content?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  message_type?: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
}

interface MemberProfile {
  id: number;
  username?: string | null;
  full_name?: string | null;
}

const API_HOST =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api/v1", "") || "http://127.0.0.1:8000";

export default function ChatThreadPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [messageFile, setMessageFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [memberNames, setMemberNames] = useState<Record<number, string>>({});

  const groupId = useMemo(() => {
    const id = Number(params.id);
    return Number.isNaN(id) ? null : id;
  }, [params.id]);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    const res = await apiFetch(`/groups/${groupId}`, accessToken ? { token: accessToken } : undefined);
    if (res.ok) {
      setGroup(await res.json());
    }
  }, [accessToken, groupId]);

  const loadMessages = useCallback(async () => {
    if (!accessToken || !groupId) return;
    setIsLoadingMessages(true);
    const res = await apiFetch(`/groups/${groupId}/messages`, { token: accessToken });
    if (res.ok) {
      const data: GroupMessage[] = await res.json();
      setMessages(data);
    } else {
      setStatus("Unable to load messages for this group.");
    }
    setIsLoadingMessages(false);
  }, [accessToken, groupId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const loadMemberNames = useCallback(async () => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/approved-members`, { token: accessToken });
    if (!res.ok) return;
    const data: MemberProfile[] = await res.json();
    const next: Record<number, string> = {};
    data.forEach((member) => {
      const label = member.username || member.full_name || `User ${member.id}`;
      next[member.id] = label;
    });
    if (user?.id && !next[user.id]) {
      next[user.id] = user.username || user.full_name || "You";
    }
    setMemberNames(next);
  }, [accessToken, groupId, user?.full_name, user?.id, user?.username]);

  useEffect(() => {
    loadMemberNames();
  }, [loadMemberNames]);

  const handleSendMessage = async () => {
    if (!accessToken || !groupId) return;
    if (!messageText && !messageFile) {
      setStatus("Write a message or attach a file.");
      return;
    }
    setIsSending(true);
    setStatus(null);

    const formData = new FormData();
    if (messageText) formData.append("content", messageText);
    if (messageFile) formData.append("file", messageFile);

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
      const data: GroupMessage = await res.json();
      setMessages((prev) => [...prev, data]);
      setMessageText("");
      setMessageFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send message.";
      setStatus(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/chat")}>
            Back
          </Button>
          <div>
            <p className="text-xs uppercase text-slate-400">Group chat</p>
            {group ? (
              <Link href={`/groups/${group.id}`} className="inline-flex">
                <h3 className="text-lg font-semibold text-slate-900 underline underline-offset-4">
                  {group.title}
                </h3>
              </Link>
            ) : (
              <h3 className="text-lg font-semibold text-slate-900">Loading...</h3>
            )}
            <p className="text-xs text-slate-500">
              {group?.approved_members ?? 0}/{group?.max_participants ?? "--"} members
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {group ? (
            <Link href={`/groups/${group.id}`}>
              <Button size="sm">View group</Button>
            </Link>
          ) : null}
          <Button size="sm" onClick={loadMessages}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-5">
        {isLoadingMessages ? (
          <div className="space-y-3">
            <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-12 w-1/2 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-slate-500">No messages yet. Say hi!</div>
        ) : (
          messages.map((message) => {
            const isMine = message.sender_id === user?.id;
            const linkClass = isMine ? "text-emerald-100" : "text-emerald-600";
            const senderLabel =
              memberNames[message.sender_id] ||
              (isMine ? user?.username || user?.full_name || "You" : `User ${message.sender_id}`);
            return (
              <div
                key={message.id}
                className={`mb-4 flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    isMine ? "bg-emerald-500 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  <Link
                    href={`/users/${message.sender_id}`}
                    className={`text-[11px] font-semibold underline underline-offset-2 ${
                      isMine ? "text-emerald-100" : "text-slate-500"
                    }`}
                  >
                    {senderLabel}
                  </Link>
                  {message.content ? <p>{message.content}</p> : null}
                  {message.attachment_url ? (
                    message.attachment_type?.startsWith("image/") ? (
                      <img
                        src={`${API_HOST}${message.attachment_url}`}
                        alt="attachment"
                        className="mt-2 max-h-48 rounded-xl object-cover"
                      />
                    ) : (
                      <a
                        className={`mt-2 inline-flex text-xs font-semibold underline ${linkClass}`}
                        href={`${API_HOST}${message.attachment_url}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View attachment
                      </a>
                    )
                  ) : null}
                  <p className={`mt-1 text-[11px] ${isMine ? "text-emerald-100" : "text-slate-400"}`}>
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-3">
            <label
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-slate-700"
              title="Upload file"
            >
              <input
                type="file"
                onChange={(event) => setMessageFile(event.target.files?.[0] || null)}
                className="hidden"
              />
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </label>
            <textarea
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Type a message"
              className="min-h-[56px] w-full flex-1 rounded-2xl border border-slate-200 p-3 text-sm"
            />
            <Button onClick={handleSendMessage} disabled={isSending || !groupId}>
              {isSending ? "Sending..." : "Send"}
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{messageFile ? `Attached: ${messageFile.name}` : "Add a photo or document."}</span>
            {status ? <span>{status}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
