"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import EventCard from "@/components/groups/event-card";
import EmptyState from "@/components/groups/empty-state";
import type { SwipeGroup } from "@/components/groups/types";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

interface SwipeDeckProps {
  groups: SwipeGroup[];
  onNearEnd?: () => void;
  nearEndThreshold?: number;
  resetKey?: string;
  onMarkSeen?: (groupId: number) => void;
  onUnmarkSeen?: (groupId: number) => void;
}

const SWIPE_RATIO = 0.3;

type GroupMedia = {
  id: number;
  url: string;
  thumb_url?: string | null;
  media_type: "image" | "video";
  is_cover?: boolean | null;
};

export default function SwipeDeck({
  groups,
  onNearEnd,
  nearEndThreshold = 5,
  resetKey,
  onMarkSeen,
  onUnmarkSeen,
}: SwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [historyIds, setHistoryIds] = useState<number[]>([]);
  const [creatorName, setCreatorName] = useState<string>("");
  const [creatorAvatar, setCreatorAvatar] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const [cardWidth, setCardWidth] = useState(0);
  const router = useRouter();
  const { user, accessToken } = useAuth();

  const current = groups[index];
  const upcoming = groups.slice(index + 1, index + 3);
  const userLocation = useMemo(() => {
    const parts = [user?.location_city, user?.location_country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Location unavailable";
  }, [user?.location_city, user?.location_country]);

  useEffect(() => {
    let active = true;

    const loadMedia = async () => {
      if (!current) {
        if (active) setImageUrls([]);
        return;
      }
      setImageIndex(0);
      const fallback = current.cover_image_url ? [current.cover_image_url] : [];
      try {
        const res = await apiFetch(`/groups/${current.id}/media`);
        if (!res.ok) {
          if (active) setImageUrls(fallback);
          return;
        }
        const data: GroupMedia[] = await res.json();
        const images = data
          .filter((item) => item.media_type === "image")
          .map((item) => item.thumb_url || item.url);
        const combined = Array.from(new Set([...images, ...fallback]));
        if (active) setImageUrls(combined.length > 0 ? combined : fallback);
      } catch {
        if (active) setImageUrls(fallback);
      }
    };

    void loadMedia();

    return () => {
      active = false;
    };
  }, [current?.cover_image_url, current?.id]);

  useEffect(() => {
    let active = true;
    const loadCreator = async () => {
      if (!current?.creator_id) {
        if (active) {
          setCreatorName("");
          setCreatorAvatar(null);
        }
        return;
      }
      try {
        const res = await apiFetch(
          `/users/${current.creator_id}`,
          accessToken ? { token: accessToken } : undefined
        );
        if (!res.ok) {
          throw new Error("Failed to load creator");
        }
        const data: {
          username?: string | null;
          full_name?: string | null;
          profile_image_url?: string | null;
        } = await res.json();
        const label = data.username || data.full_name || `User ${current.creator_id}`;
        if (active) {
          setCreatorName(label);
          setCreatorAvatar(data.profile_image_url ?? null);
        }
      } catch {
        if (active) {
          setCreatorName(`User ${current.creator_id}`);
          setCreatorAvatar(null);
        }
      }
    };

    void loadCreator();

    return () => {
      active = false;
    };
  }, [accessToken, current?.creator_id]);

  useEffect(() => {
    const updateWidth = () => {
      if (cardRef.current) {
        setCardWidth(cardRef.current.getBoundingClientRect().width);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const resetDrag = useCallback(() => {
    setDrag({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!resetKey) return;
    setIndex(0);
    resetDrag();
    setImageIndex(0);
    setHistory([]);
    setHistoryIds([]);
    setStatus(null);
  }, [resetKey, resetDrag]);

  useEffect(() => {
    if (!groups.length) return;
    if (index >= groups.length) {
      setIndex(0);
      resetDrag();
      setHistory([]);
      setHistoryIds([]);
    }
  }, [groups.length, index, resetDrag]);

  useEffect(() => {
    if (!onNearEnd) return;
    if (!groups.length) return;
    if (groups.length - index <= nearEndThreshold) {
      onNearEnd();
    }
  }, [groups.length, index, nearEndThreshold, onNearEnd]);

  const animateOut = useCallback(
    (direction: "left" | "right", groupId: number) => {
      const distance = cardWidth || 600;
      setIsAnimating(true);
      setHistory((prev) => [...prev, index]);
      setHistoryIds((prev) => [...prev, groupId]);
      setDrag({ x: direction === "right" ? distance * 1.2 : -distance * 1.2, y: drag.y });
      setTimeout(() => {
        setIsAnimating(false);
        setIndex((prev) => prev + 1);
        resetDrag();
        setStatus(null);
      }, 260);
    },
    [cardWidth, drag.y, index, resetDrag]
  );

  const attemptJoin = useCallback(
    async (requestTier: "like" | "superlike" = "like") => {
      if (!current) return false;
      if (!user?.profile_image_url) {
        toast.error("Upload a profile photo before joining a group.");
        setStatus("Upload a profile photo before joining a group.");
        router.push("/profile");
        return false;
      }
      if (!accessToken) {
        toast.error("Sign in to join this group.");
        setStatus("Sign in to join this group.");
        router.push("/auth/login");
        return false;
      }
      setIsJoining(true);
      setStatus(null);
      try {
        const res = await apiFetch(`/groups/${current.id}/join`, {
          method: "POST",
          body: JSON.stringify({ consent_flags: {}, request_tier: requestTier }),
          token: accessToken,
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.detail || "Unable to join this group.");
        }
      return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to join this group.";
        toast.error(message);
        setStatus(message);
        return false;
      } finally {
        setIsJoining(false);
      }
    },
    [accessToken, current, router, user?.profile_image_url]
  );

  const recordSwipe = useCallback(
    async (action: "like" | "nope" | "superlike" | "view") => {
      if (!current || !accessToken) return;
      try {
        await apiFetch(`/groups/${current.id}/swipe`, {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ action }),
        });
      } catch {
        // Best-effort only.
      }
    },
    [accessToken, current]
  );

  const undoSwipe = useCallback(
    async (groupId: number) => {
      if (!accessToken) return;
      try {
        await apiFetch(`/groups/${groupId}/swipe`, {
          method: "DELETE",
          token: accessToken,
        });
      } catch {
        // Best-effort only.
      }
    },
    [accessToken]
  );

  const handleApprove = useCallback(async () => {
    const ok = await attemptJoin("like");
    if (ok) {
      await recordSwipe("like");
      onMarkSeen?.(current.id);
      animateOut("right", current.id);
    }
  }, [animateOut, attemptJoin, current?.id, onMarkSeen, recordSwipe]);

  const handleSuperlike = useCallback(async () => {
    const ok = await attemptJoin("superlike");
    if (ok) {
      await recordSwipe("superlike");
      onMarkSeen?.(current.id);
      animateOut("right", current.id);
    }
  }, [animateOut, attemptJoin, current?.id, onMarkSeen, recordSwipe]);

  const handleReject = useCallback(() => {
    setStatus(null);
    void recordSwipe("nope");
    if (current?.id) {
      onMarkSeen?.(current.id);
      animateOut("left", current.id);
    }
  }, [animateOut, current?.id, onMarkSeen, recordSwipe]);

  const handleRewind = useCallback(() => {
    if (isAnimating || isJoining) return;
    if (history.length === 0) {
      setStatus("Nothing to rewind.");
      return;
    }
    const previous = history[history.length - 1];
    const lastId = historyIds[historyIds.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setHistoryIds((prev) => prev.slice(0, -1));
    setStatus("Rewound.");
    setIndex(previous);
    resetDrag();
    if (lastId != null) {
      void undoSwipe(lastId);
      onUnmarkSeen?.(lastId);
    }
  }, [
    history,
    historyIds,
    isAnimating,
    isJoining,
    onUnmarkSeen,
    resetDrag,
    undoSwipe,
  ]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isAnimating) return;
    setIsDragging(true);
    startRef.current = { x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isAnimating) return;
    const deltaX = event.clientX - startRef.current.x;
    const deltaY = event.clientY - startRef.current.y;
    setDrag({ x: deltaX, y: deltaY });
  };

  const handlePointerUp = async () => {
    if (!isDragging) return;
    setIsDragging(false);
    const threshold = (cardWidth || 600) * SWIPE_RATIO;
    if (Math.abs(drag.x) < threshold) {
      resetDrag();
      return;
    }
    if (drag.x > 0) {
      const ok = await attemptJoin("like");
      if (ok) {
        if (current?.id) {
          animateOut("right", current.id);
        }
      } else {
        resetDrag();
      }
      return;
    }
    if (current?.id) {
      animateOut("left", current.id);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!current || isAnimating) return;
      if (event.key === "ArrowLeft") {
        handleReject();
      }
      if (event.key === "ArrowRight") {
        void handleApprove();
      }
      if (event.key === "ArrowUp") {
        void handleSuperlike();
      }
      if (event.key === "Backspace") {
        handleRewind();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, handleApprove, handleReject, handleRewind, handleSuperlike, isAnimating]);

  const overlayOpacity = Math.min(Math.abs(drag.x) / ((cardWidth || 600) * SWIPE_RATIO), 1);
  const overlayLabel =
    Math.abs(drag.x) > 20
      ? {
          text: drag.x > 0 ? "LIKE" : "NOPE",
          variant: drag.x > 0 ? ("like" as const) : ("nope" as const),
          opacity: overlayOpacity,
        }
      : null;

  const handleNextImage = useCallback(() => {
    if (imageUrls.length <= 1) return;
    setImageIndex((prev) => (prev + 1) % imageUrls.length);
  }, [imageUrls.length]);

  const handlePrevImage = useCallback(() => {
    if (imageUrls.length <= 1) return;
    setImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  }, [imageUrls.length]);

  const handleOpenDetails = useCallback(() => {
    if (!current) return;
    if (Math.abs(drag.x) > 6 || isDragging) return;
    void recordSwipe("view");
    onMarkSeen?.(current.id);
    setHistory((prev) => [...prev, index]);
    setHistoryIds((prev) => [...prev, current.id]);
    router.push(`/groups/${current.id}`);
  }, [current, drag.x, index, isDragging, onMarkSeen, recordSwipe, router]);

  if (!current) {
    return <EmptyState />;
  }

  const rotate = drag.x / 18;
  const transform = `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${rotate}deg)`;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="relative w-full max-w-3xl">
        <div className="absolute inset-0 hidden lg:block">
          {upcoming.map((group, stackIndex) => (
            <div
              key={group.id}
              className="absolute inset-0"
              style={{
                transform: `translateY(${(stackIndex + 1) * 14}px) scale(${1 - (stackIndex + 1) * 0.04})`,
                opacity: 0.5,
              }}
            >
              <EventCard group={group} className="pointer-events-none" />
            </div>
          ))}
        </div>

        <div
          ref={cardRef}
          className={`relative z-10 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{
            transform,
            transition: isDragging || isAnimating ? "none" : "transform 0.25s ease",
            touchAction: "pan-x",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <EventCard
            group={current}
            overlayLabel={overlayLabel}
            imageUrls={imageUrls}
            activeImageIndex={imageIndex}
            onPrevImage={handlePrevImage}
            onNextImage={handleNextImage}
            creatorName={creatorName}
            creatorAvatarUrl={creatorAvatar}
            locationLabel={userLocation}
            onInfoClick={handleOpenDetails}
            footer={
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRewind();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-indigo-200 bg-indigo-50 px-2 py-2 text-[10px] font-semibold uppercase text-indigo-700"
                  >
                    <span className="text-sm">&lt;</span>
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleReject();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    className="col-span-2 flex flex-col items-center justify-center gap-1 rounded-2xl border border-rose-200 bg-rose-50 px-2 py-2 text-[10px] font-semibold uppercase text-rose-600"
                  >
                    <span className="text-sm">X</span>
                    Nope
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleSuperlike();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    disabled={isJoining}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] font-semibold uppercase text-amber-700 disabled:opacity-70"
                  >
                    <span className="text-sm">*</span>
                    Super
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleApprove();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    disabled={isJoining}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-[10px] font-semibold uppercase text-emerald-700 disabled:opacity-70"
                  >
                    <span className="text-sm">+</span>
                    Like
                  </button>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  onClick={handleOpenDetails}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  View details
                </button>
                {status ? <p className="text-center text-xs text-slate-500">{status}</p> : null}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
