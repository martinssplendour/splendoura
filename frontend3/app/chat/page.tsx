"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

const API_HOST =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api/v1", "") || "http://127.0.0.1:8000";

export default function ChatPage() {
  const { accessToken } = useAuth();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    if (!accessToken) return;
    const res = await apiFetch("/users/me/groups", { token: accessToken });
    if (!res.ok) {
      setStatus("Unable to load your chat groups.");
      return;
    }
    const data: ChatGroup[] = await res.json();
    setGroups(data);
  }, [accessToken]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">Chats</p>
          <h2 className="text-lg font-semibold text-slate-900">Your Groups</h2>
        </div>
        <Button variant="outline" size="sm" onClick={loadGroups}>
          Refresh
        </Button>
      </div>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-4 py-5">
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
            Join a group to start chatting.
          </div>
        ) : (
          groups.map((group) => (
            <Link
              key={group.id}
              href={`/chat/${group.id}`}
              className="mb-3 flex items-center gap-3 rounded-2xl border border-transparent bg-white px-3 py-3 transition hover:border-slate-200"
            >
              {group.cover_image_url ? (
                <img
                  src={`${API_HOST}${group.cover_image_url}`}
                  alt={group.title}
                  className="h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-slate-200" />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">{group.title}</p>
                <p className="text-xs text-slate-500">
                  {group.activity_type} · {group.location || "Flexible"}
                </p>
                <p className="text-xs text-slate-400">
                  {group.approved_members ?? 0}/{group.max_participants ?? "--"} members
                </p>
              </div>
            </Link>
          ))
        )}
        {status ? <p className="mt-3 text-sm text-slate-500">{status}</p> : null}
      </div>
    </div>
  );
}
