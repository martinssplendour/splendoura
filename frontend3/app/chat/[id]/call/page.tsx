"use client";

import { useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ChatCallPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") || "video") as "voice" | "video";
  const groupId = useMemo(() => {
    const id = Number(params.id);
    return Number.isNaN(id) ? null : id;
  }, [params.id]);

  const callUrl = useMemo(() => {
    if (!groupId) return "";
    return `https://meet.jit.si/splendoure-group-${groupId}?config.startWithVideoMuted=${
      mode === "voice" ? "true" : "false"
    }&config.startAudioOnly=${mode === "voice" ? "true" : "false"}`;
  }, [groupId, mode]);

  if (!groupId) {
    return (
      <div className="mx-auto max-w-3xl rounded-none border-0 bg-white p-6 sm:rounded-2xl sm:border sm:border-slate-200">
        <p className="text-sm text-slate-600">Call not available.</p>
        <Button className="mt-4" onClick={() => router.push("/chat")}>
          Back to chats
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-slate-400">Group call</p>
          <h1 className="text-xl font-semibold text-slate-900">
            {mode === "voice" ? "Voice call" : "Video call"}
          </h1>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
      </div>
      <div className="overflow-hidden rounded-none border-0 bg-white shadow-none sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-sm">
        <iframe
          src={callUrl}
          className="h-[70vh] w-full"
          allow="camera; microphone; fullscreen; speaker; display-capture"
        />
      </div>
      <div className="text-sm text-slate-500">
        If the embed does not load,{" "}
        <a className="text-blue-600 underline" href={callUrl} target="_blank" rel="noreferrer">
          open the call in a new tab
        </a>
        .
      </div>
    </div>
  );
}
