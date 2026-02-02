type CachedMessage = {
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

const MESSAGE_CACHE_PREFIX = "chatMessagesCache:v1:";
const MESSAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_MESSAGES = 120;

function normalizeMessages(messages: CachedMessage[]) {
  const map = new Map<number, CachedMessage>();
  messages.forEach((message) => map.set(message.id, message));
  const list = Array.from(map.values());
  list.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return list.length > MAX_CACHED_MESSAGES
    ? list.slice(-MAX_CACHED_MESSAGES)
    : list;
}

export function readMessageCache(groupId: number): CachedMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${MESSAGE_CACHE_PREFIX}${groupId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; messages: CachedMessage[] };
    if (!parsed?.savedAt || !Array.isArray(parsed.messages)) return null;
    if (Date.now() - parsed.savedAt > MESSAGE_CACHE_TTL_MS) return parsed.messages;
    return parsed.messages;
  } catch {
    return null;
  }
}

export function writeMessageCache(groupId: number, messages: CachedMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeMessages(messages);
    localStorage.setItem(
      `${MESSAGE_CACHE_PREFIX}${groupId}`,
      JSON.stringify({ savedAt: Date.now(), messages: normalized })
    );
  } catch {
    // ignore cache write errors
  }
}

