"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import EventCard from "@/components/groups/event-card";
import ActionButtons from "@/components/groups/action-buttons";
import EmptyState from "@/components/groups/empty-state";
import type { SwipeGroup } from "@/components/groups/types";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

interface SwipeDeckProps {
  groups: SwipeGroup[];
}

const SWIPE_RATIO = 0.3;

export default function SwipeDeck({ groups }: SwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const [cardWidth, setCardWidth] = useState(0);
  const router = useRouter();
  const { user, accessToken } = useAuth();

  const current = groups[index];
  const upcoming = groups.slice(index + 1, index + 3);

  const progress = useMemo(() => {
    if (groups.length === 0) return 0;
    return Math.min(100, Math.round(((index + 1) / groups.length) * 100));
  }, [groups.length, index]);

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
    setIndex(0);
    resetDrag();
  }, [groups, resetDrag]);

  const animateOut = useCallback(
    (direction: "left" | "right") => {
      const distance = cardWidth || 600;
      setIsAnimating(true);
      setDrag({ x: direction === "right" ? distance * 1.2 : -distance * 1.2, y: drag.y });
      setTimeout(() => {
        setIsAnimating(false);
        setIndex((prev) => prev + 1);
        resetDrag();
      }, 260);
    },
    [cardWidth, drag.y, resetDrag]
  );

  const attemptJoin = useCallback(async () => {
    if (!current) return false;
    if (!user?.profile_image_url) {
      toast.error("Upload a profile photo before joining a group.");
      router.push("/profile");
      return false;
    }
    if (!accessToken) {
      toast.error("Sign in to join this group.");
      router.push("/auth/login");
      return false;
    }
    setIsJoining(true);
    try {
      const res = await apiFetch(`/groups/${current.id}/join`, {
        method: "POST",
        body: JSON.stringify({ consent_flags: {} }),
        token: accessToken,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to join this group.");
      }
      toast.success("Join request sent.");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to join this group.");
      return false;
    } finally {
      setIsJoining(false);
    }
  }, [accessToken, current, router, user]);

  const handleApprove = useCallback(async () => {
    const ok = await attemptJoin();
    if (ok) {
      animateOut("right");
    }
  }, [animateOut, attemptJoin]);

  const handleReject = useCallback(() => {
    toast.info("Not interested.");
    animateOut("left");
  }, [animateOut]);

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
      const ok = await attemptJoin();
      if (ok) {
        animateOut("right");
      } else {
        resetDrag();
      }
      return;
    }
    animateOut("left");
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
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, handleApprove, handleReject, isAnimating]);

  const overlayOpacity = Math.min(Math.abs(drag.x) / ((cardWidth || 600) * SWIPE_RATIO), 1);
  const overlayLabel =
    Math.abs(drag.x) > 20
      ? {
          text: drag.x > 0 ? "LIKE" : "NOPE",
          variant: drag.x > 0 ? ("like" as const) : ("nope" as const),
          opacity: overlayOpacity,
        }
      : null;

  if (!current) {
    return <EmptyState />;
  }

  const rotate = drag.x / 18;
  const transform = `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${rotate}deg)`;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="w-full max-w-3xl">
        <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span>Swipe deck</span>
          <span>
            {index + 1} / {groups.length}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/70">
          <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

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
            touchAction: "pan-y",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={() => {
            if (Math.abs(drag.x) > 6 || isDragging) return;
            router.push(`/groups/${current.id}`);
          }}
        >
          <EventCard
            group={current}
            overlayLabel={overlayLabel}
            footer={
              <div className="flex flex-col gap-3">
                <ActionButtons onReject={handleReject} onApprove={handleApprove} isBusy={isJoining} />
                <button
                  type="button"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  onClick={() => router.push(`/groups/${current.id}`)}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  View details
                </button>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
