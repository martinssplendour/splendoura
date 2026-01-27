"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, resolveMediaUrl, API_HOST } from "@/lib/api";
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
  read_by?: number[];
}

interface MemberProfile {
  id: number;
  username?: string | null;
  full_name?: string | null;
}

type MessageListItem =
  | { type: "single"; message: GroupMessage }
  | { type: "gallery"; messages: GroupMessage[] };

export default function ChatThreadPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [messageFile, setMessageFile] = useState<File | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [revealedImages, setRevealedImages] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [memberNames, setMemberNames] = useState<Record<number, string>>({});
  const [typingUsers, setTypingUsers] = useState<Record<number, boolean>>({});
  const [showWarning, setShowWarning] = useState(false);
  const [warningText, setWarningText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);

  const groupId = useMemo(() => {
    const id = Number(params.id);
    return Number.isNaN(id) ? null : id;
  }, [params.id]);
  const isVerified = user?.verification_status === "verified";
  const blockNudity = Boolean(
    (user?.profile_details as Record<string, unknown> | null)?.safety_settings &&
      (
        (user?.profile_details as Record<string, unknown>).safety_settings as
          | Record<string, unknown>
          | undefined
      )?.block_nudity
  );
  const showSend = Boolean(messageText.trim()) || Boolean(messageFile);
  const canSend = Boolean(isVerified && groupId && !isSending && showSend);
  const formatTime = useCallback(
    (value: string) =>
      new Date(value).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    []
  );

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    const res = await apiFetch(`/groups/${groupId}`, accessToken ? { token: accessToken } : undefined);
    if (res.ok) {
      setGroup(await res.json());
    }
  }, [accessToken, groupId]);

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

  const loadMessages = useCallback(async () => {
    if (!accessToken || !groupId) return;
    setIsLoadingMessages(true);
    const res = await apiFetch(`/groups/${groupId}/messages`, { token: accessToken });
    if (res.ok) {
      const data: GroupMessage[] = await res.json();
      setMessages(data);
      const unreadIds = data
        .filter((message) => message.sender_id !== user?.id)
        .map((message) => message.id);
      if (unreadIds.length > 0) {
        void markMessagesRead(unreadIds);
      }
    } else {
      setStatus("Unable to load messages for this group.");
    }
    setIsLoadingMessages(false);
  }, [accessToken, groupId, markMessagesRead, user?.id]);

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

  useEffect(() => {
    if (!accessToken || !groupId) return;
    const base = API_HOST.replace(/^http/, "ws");
    const wsUrl = `${base}/api/v1/ws/groups/${groupId}?token=${accessToken}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      let payload: {
        type?: string;
        user_id?: number;
        is_typing?: boolean;
        message?: GroupMessage;
        message_ids?: number[];
      };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type === "message:new" && payload.message) {
        const nextMessage = payload.message;
        setMessages((prev) =>
          prev.some((message) => message.id === nextMessage.id)
            ? prev
            : [...prev, nextMessage]
        );
        if (nextMessage.sender_id !== user?.id) {
          void markMessagesRead([nextMessage.id]);
        }
      }
      if (payload.type === "typing" && payload.user_id) {
        if (payload.user_id === user?.id) return;
        setTypingUsers((prev) => ({
          ...prev,
          [payload.user_id as number]: Boolean(payload.is_typing),
        }));
      }
      if (payload.type === "read" && payload.user_id && payload.message_ids) {
        setMessages((prev) =>
          prev.map((message) => {
            if (!payload.message_ids?.includes(message.id)) return message;
            const existing = message.read_by || [];
            if (existing.includes(payload.user_id as number)) return message;
            return { ...message, read_by: [...existing, payload.user_id as number] };
          })
        );
      }
    };

    socket.onclose = () => {
      setTypingUsers({});
    };

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [accessToken, groupId, markMessagesRead, user?.id]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "typing", is_typing: isTyping }));
  }, []);

  const handleMessageChange = (value: string) => {
    setMessageText(value);
    if (!value.trim()) {
      if (typingActiveRef.current) {
        sendTyping(false);
        typingActiveRef.current = false;
      }
      return;
    }
    if (!typingActiveRef.current) {
      sendTyping(true);
      typingActiveRef.current = true;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
      typingActiveRef.current = false;
    }, 1200);
  };

  const typingLabels = useMemo(() => {
    const activeIds = Object.keys(typingUsers)
      .map((id) => Number(id))
      .filter((id) => typingUsers[id] && id !== user?.id);
    if (activeIds.length === 0) return null;
    const names = activeIds.map((id) => memberNames[id] || `User ${id}`);
    return names.join(", ");
  }, [memberNames, typingUsers, user?.id]);

  const groupedMessages = useMemo<MessageListItem[]>(() => {
    const items: MessageListItem[] = [];
    const isImageOnly = (message: GroupMessage) =>
      Boolean(
        message.attachment_url &&
          message.attachment_type?.startsWith("image/") &&
          !message.content &&
          !(message.meta as Record<string, any> | null)?.call
      );

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      if (isImageOnly(message)) {
        const group: GroupMessage[] = [message];
        let cursor = index + 1;
        while (
          cursor < messages.length &&
          isImageOnly(messages[cursor]) &&
          messages[cursor].sender_id === message.sender_id
        ) {
          group.push(messages[cursor]);
          cursor += 1;
        }
        if (group.length > 1) {
          items.push({ type: "gallery", messages: group });
          index = cursor - 1;
          continue;
        }
      }
      items.push({ type: "single", message });
    }
    return items;
  }, [messages]);

  const getWarningForMessage = (value: string) => {
    const lowered = value.toLowerCase();
    if (/(cashapp|venmo|paypal|bitcoin|crypto|wire|bank)/i.test(lowered)) {
      return "This message mentions payments. Be careful with money requests.";
    }
    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(lowered)) {
      return "You appear to be sharing a phone number. Make sure you trust this person.";
    }
    if (/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(lowered)) {
      return "You appear to be sharing an email. Only share contact info if you feel safe.";
    }
    if (/(meet|address|home|hotel|room number)/i.test(lowered)) {
      return "Consider meeting in a public place and sharing your plan with a trusted contact.";
    }
    return null;
  };

  const handleSendMessage = async (skipWarning = false) => {
    if (!accessToken || !groupId) return;
    if (!isVerified) {
      setStatus("Verify your profile before sending messages.");
      return;
    }
    if (!messageText.trim() && !messageFile) {
      setStatus("Write a message or attach a file.");
      return;
    }
    if (!skipWarning && messageText.trim()) {
      const warning = getWarningForMessage(messageText.trim());
      if (warning) {
        setWarningText(warning);
        setShowWarning(true);
        return;
      }
    }
    setIsSending(true);
    setStatus(null);

    const formData = new FormData();
    if (messageText.trim()) formData.append("content", messageText.trim());
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
      if (typingActiveRef.current) {
        sendTyping(false);
        typingActiveRef.current = false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send message.";
      setStatus(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartRecording = async () => {
    if (isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Microphone access is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: mimeType });
        setMessageFile(file);
        audioChunksRef.current = [];
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start recording.";
      setStatus(message);
    }
  };

  const handleStopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setIsRecording(false);
  };

  const buildCallUrl = (mode: "voice" | "video") =>
    `https://meet.jit.si/splendoura-group-${groupId}?config.startWithVideoMuted=${
      mode === "voice" ? "true" : "false"
    }&config.startAudioOnly=${mode === "voice" ? "true" : "false"}`;

  const handleStartCall = async (mode: "voice" | "video") => {
    if (!accessToken || !groupId) return;
    if (!isVerified) {
      setStatus("Verify your profile before starting calls.");
      return;
    }
    const callUrl = buildCallUrl(mode);
    try {
      const formData = new FormData();
      formData.append(
        "content",
        `${user?.full_name || user?.username || "Someone"} started a ${
          mode === "voice" ? "voice" : "video"
        } call.`
      );
      formData.append("message_type", "system");
      formData.append("metadata", JSON.stringify({ call: { url: callUrl, mode } }));
      await apiFetch(`/groups/${groupId}/messages`, {
        method: "POST",
        token: accessToken,
        body: formData,
      });
    } catch {
      // ignore announcement failure
    }
    router.push(`/chat/${groupId}/call?mode=${mode}`);
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
          <Button size="sm" variant="outline" onClick={() => handleStartCall("voice")}>
            Voice call
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleStartCall("video")}>
            Video call
          </Button>
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
        ) : groupedMessages.length === 0 ? (
          <div className="text-sm text-slate-500">No messages yet. Say hi!</div>
        ) : (
          groupedMessages.map((item, index) => {
            const primaryMessage =
              item.type === "gallery" ? item.messages[item.messages.length - 1] : item.message;
            const isMine = primaryMessage.sender_id === user?.id;
            const senderLabel =
              memberNames[primaryMessage.sender_id] ||
              (isMine ? user?.username || user?.full_name || "You" : `User ${primaryMessage.sender_id}`);
            const readCount = (primaryMessage.read_by || []).filter(
              (id) => id !== primaryMessage.sender_id
            ).length;
            if (item.type === "gallery") {
              return (
                <div
                  key={`gallery-${index}`}
                  className={`mb-4 flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[78%] rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                    <Link
                      href={`/users/${primaryMessage.sender_id}`}
                      className="text-[11px] font-semibold text-slate-500"
                    >
                      {senderLabel}
                    </Link>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {item.messages.map((message, galleryIndex) => {
                        const nudity = (message.meta as Record<string, any> | null)?.nudity;
                        const isSensitive = Boolean(nudity?.contains_nudity);
                        const shouldBlock =
                          blockNudity && isSensitive && !revealedImages[message.id];
                        if (shouldBlock) {
                          return (
                            <button
                              key={message.id}
                              type="button"
                              className="flex aspect-[4/3] items-center justify-center rounded-xl border border-slate-200 bg-slate-900 text-xs font-semibold text-white"
                              onClick={() =>
                                setRevealedImages((prev) => ({ ...prev, [message.id]: true }))
                              }
                            >
                              Sensitive
                            </button>
                          );
                        }
                        return (
                          <button
                            key={message.id}
                            type="button"
                            className="overflow-hidden rounded-xl"
                            onClick={() => setFullScreenImage(resolveMediaUrl(message.attachment_url))}
                          >
                            <img
                              src={resolveMediaUrl(message.attachment_url)}
                              alt="attachment"
                              className="h-28 w-full object-cover"
                            />
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{formatTime(primaryMessage.created_at)}</span>
                      {isMine && readCount > 0 ? <span>Seen</span> : null}
                    </div>
                  </div>
                </div>
              );
            }

            const message = item.message;
            const isImage = message.attachment_type?.startsWith("image/");
            const isAudio = message.attachment_type?.startsWith("audio/");
            const callMeta = (message.meta as Record<string, any> | null)?.call;
            const nudity = (message.meta as Record<string, any> | null)?.nudity;
            const isSensitive = Boolean(nudity?.contains_nudity);
            const shouldBlock = blockNudity && isSensitive && !revealedImages[message.id];

            return (
              <div
                key={message.id}
                className={`mb-4 flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    isMine ? "bg-emerald-500 text-white" : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <Link
                    href={`/users/${message.sender_id}`}
                    className={`text-[11px] font-semibold ${
                      isMine ? "text-emerald-100" : "text-slate-500"
                    }`}
                  >
                    {senderLabel}
                  </Link>
                  {message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null}
                  {callMeta ? (
                    <div className="mt-2 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
                      <p className="font-semibold">Call started</p>
                      <p className="mt-1">Tap to join the {callMeta.mode || "video"} call.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/chat/${groupId}/call?mode=${callMeta.mode || "video"}`)}
                      >
                        Join call
                      </Button>
                    </div>
                  ) : null}
                  {message.attachment_url && isImage ? (
                    shouldBlock ? (
                      <button
                        type="button"
                        className="mt-2 flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-900 px-4 py-6 text-xs font-semibold text-white"
                        onClick={() =>
                          setRevealedImages((prev) => ({ ...prev, [message.id]: true }))
                        }
                      >
                        Sensitive image hidden
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="mt-2 overflow-hidden rounded-xl"
                        onClick={() => setFullScreenImage(resolveMediaUrl(message.attachment_url))}
                      >
                        <img
                          src={resolveMediaUrl(message.attachment_url)}
                          alt="attachment"
                          className="max-h-48 rounded-xl object-cover"
                        />
                      </button>
                    )
                  ) : null}
                  {message.attachment_url && isAudio ? (
                    <audio className="mt-2 w-full" controls src={resolveMediaUrl(message.attachment_url)} />
                  ) : null}
                  {message.attachment_url && !isImage && !isAudio ? (
                    <a
                      className={`mt-2 inline-flex text-xs font-semibold underline ${
                        isMine ? "text-emerald-100" : "text-emerald-600"
                      }`}
                      href={resolveMediaUrl(message.attachment_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View attachment
                    </a>
                  ) : null}
                  <div className={`mt-1 flex items-center gap-2 text-[11px] ${isMine ? "text-emerald-100" : "text-slate-400"}`}>
                    <span>{formatTime(message.created_at)}</span>
                    {isMine && readCount > 0 ? <span>Seen</span> : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!isVerified ? (
        <div className="border-t border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Verify your profile to send messages.</span>
            <Button size="sm" variant="outline" onClick={() => router.push("/profile")}>
              Verify now
            </Button>
          </div>
        </div>
      ) : null}

      <div className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-2">
          {typingLabels ? <p className="text-xs text-slate-500">{typingLabels} is typing...</p> : null}
          {messageFile ? (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Attached: {messageFile.name}</span>
              <button
                type="button"
                className="text-rose-500"
                onClick={() => setMessageFile(null)}
              >
                Remove
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-3">
            <label
              className={`flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 ${
                isVerified ? "text-slate-500 hover:text-slate-700" : "text-slate-300"
              }`}
              title="Upload file"
            >
              <input
                type="file"
                onChange={(event) => setMessageFile(event.target.files?.[0] || null)}
                className="hidden"
                disabled={!isVerified}
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
            <button
              type="button"
              className={`flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold ${
                isVerified ? "text-slate-600 hover:text-slate-800" : "text-slate-300"
              }`}
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={!isVerified}
            >
              {isRecording ? "Stop" : "Mic"}
            </button>
            <textarea
              value={messageText}
              onChange={(event) => handleMessageChange(event.target.value)}
              placeholder={isVerified ? "Type a message" : "Verify to chat"}
              className="min-h-[56px] w-full flex-1 rounded-2xl border border-slate-200 p-3 text-sm"
              disabled={!isVerified}
            />
            {showSend ? (
              <Button onClick={() => handleSendMessage(false)} disabled={!canSend}>
                {isSending ? "Sending..." : "Send"}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{messageFile ? "Ready to send attachment." : "Add a photo, voice note, or document."}</span>
            {status ? <span>{status}</span> : null}
          </div>
        </div>
      </div>
      {fullScreenImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-6"
          onClick={() => setFullScreenImage(null)}
        >
          <img
            src={fullScreenImage}
            alt="Full screen"
            className="max-h-[80vh] w-full max-w-4xl rounded-2xl object-contain"
          />
        </div>
      ) : null}
      {showWarning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Think twice</h3>
            <p className="mt-2 text-sm text-slate-600">{warningText}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowWarning(false)}>
                Edit
              </Button>
              <Button size="sm" onClick={() => { setShowWarning(false); void handleSendMessage(true); }}>
                Send anyway
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
