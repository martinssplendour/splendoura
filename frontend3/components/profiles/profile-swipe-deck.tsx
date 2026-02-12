"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SignedImage } from "@/components/signed-media";
import { getProfilePhotoThumb } from "@/lib/media";

const SWIPE_RATIO = 0.3;

type ProfileUser = {
  id: number;
  full_name?: string | null;
  username?: string | null;
  age?: number | null;
  location_city?: string | null;
  location_country?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  profile_image_url?: string | null;
  profile_media?: {
    photos?: string[];
    photo_thumbs?: Record<string, string> | null;
  } | null;
};

export type ProfileMatch = {
  user: ProfileUser;
  match_count: number;
  criteria_count: number;
  score: number;
};

type ProfileSwipeDeckProps = {
  profiles: ProfileMatch[];
  requestId: number | null;
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function ProfileSwipeDeck({ profiles, requestId }: ProfileSwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [sentTo, setSentTo] = useState<Record<number, boolean>>({});
  const cardRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const [cardWidth, setCardWidth] = useState(0);
  const router = useRouter();
  const { accessToken, user } = useAuth();

  const current = profiles[index];
  const upcoming = profiles.slice(index + 1, index + 3);

  const imageUrls = useMemo(() => {
    if (!current) return [];
    const photos = Array.isArray(current.user.profile_media?.photos)
      ? current.user.profile_media?.photos || []
      : [];
    const thumbPhotos = photos.map((photo) =>
      getProfilePhotoThumb(photo, current.user.profile_media, true)
    );
    const fallback = current.user.profile_image_url
      ? [getProfilePhotoThumb(current.user.profile_image_url, current.user.profile_media, true)]
      : [];
    const combined = Array.from(new Set([...thumbPhotos, ...fallback]));
    return combined;
  }, [current]);

  const name = useMemo(() => {
    if (!current) return "";
    return (
      current.user.full_name ||
      current.user.username ||
      `User ${current.user.id}`
    );
  }, [current]);

  const locationLabel = useMemo(() => {
    if (!current) return null;
    if (
      user?.location_lat != null &&
      user?.location_lng != null &&
      current.user.location_lat != null &&
      current.user.location_lng != null
    ) {
      const km = haversineKm(
        user.location_lat,
        user.location_lng,
        current.user.location_lat,
        current.user.location_lng
      );
      const miles = Math.round(km * 0.621371);
      return `${miles} miles away`;
    }
    const parts = [current.user.location_city, current.user.location_country].filter(Boolean);
    return parts.length ? parts.join(", ") : "Location unavailable";
  }, [
    current,
    user?.location_lat,
    user?.location_lng,
  ]);

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

  useEffect(() => {
    setIndex(0);
    setDrag({ x: 0, y: 0 });
    setImageIndex(0);
    setHistory([]);
    setStatus(null);
    setSentTo({});
  }, [profiles]);

  useEffect(() => {
    setImageIndex(0);
  }, [current?.user.id]);

  const resetDrag = useCallback(() => {
    setDrag({ x: 0, y: 0 });
  }, []);

  const animateOut = useCallback(
    (direction: "left" | "right") => {
      const distance = cardWidth || 600;
      setIsAnimating(true);
      setHistory((prev) => [...prev, index]);
      setDrag({ x: direction === "right" ? distance * 1.2 : -distance * 1.2, y: drag.y });
      setTimeout(() => {
        setIsAnimating(false);
        setIndex((prev) => prev + 1);
        resetDrag();
        setStatus(null);
      }, 240);
    },
    [cardWidth, drag.y, index, resetDrag]
  );

  const sendRequest = useCallback(async () => {
    if (!current) return false;
    if (!accessToken) {
      toast.error("Sign in to connect.");
      router.push("/auth/login");
      return false;
    }
    if (!requestId) {
      toast.error("Update your discovery filters to load profile matches.");
      return false;
    }
    if (sentTo[current.user.id]) {
      return true;
    }
    try {
      const res = await apiFetch(`/match/requests/${requestId}/send/${current.user.id}`, {
        method: "POST",
        token: accessToken,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to send request.");
      }
      setSentTo((prev) => ({ ...prev, [current.user.id]: true }));
      toast.success("Request sent.");
      setStatus("Request sent.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send request.";
      toast.error(message);
      setStatus(message);
      return false;
    }
  }, [accessToken, current, requestId, router, sentTo]);

  const recordSwipe = useCallback(
    async (action: "like" | "nope") => {
      if (!current || !accessToken) return;
      try {
        await apiFetch(`/match/swipes/${current.user.id}`, {
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

  const handleApprove = useCallback(async () => {
    if (!current) return;
    const ok = await sendRequest();
    if (ok) {
      await recordSwipe("like");
      animateOut("right");
    }
  }, [animateOut, current, recordSwipe, sendRequest]);

  const handleReject = useCallback(() => {
    if (!current) return;
    setStatus("Not interested.");
    void recordSwipe("nope");
    animateOut("left");
  }, [animateOut, current, recordSwipe]);

  const handleRewind = useCallback(() => {
    if (isAnimating) return;
    if (history.length === 0) {
      setStatus("Nothing to rewind.");
      return;
    }
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setStatus("Rewound.");
    setIndex(previous);
    resetDrag();
  }, [history, isAnimating, resetDrag]);

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
      const ok = await sendRequest();
      if (ok) {
        animateOut("right");
      } else {
        resetDrag();
      }
      return;
    }
    animateOut("left");
  };

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

  const handleOpenProfile = useCallback(() => {
    if (!current) return;
    if (Math.abs(drag.x) > 6 || isDragging) return;
    router.push(`/users/${current.user.id}`);
  }, [current, drag.x, isDragging, router]);

  if (!current) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        No profiles match your current filters.
      </div>
    );
  }

  const rotate = drag.x / 18;
  const transform = `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${rotate}deg)`;
  const activeImage = imageUrls[imageIndex];

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 hidden lg:block">
          {upcoming.map((candidate, stackIndex) => (
            <div
              key={candidate.user.id}
              className="absolute inset-0"
              style={{
                transform: `translateY(${(stackIndex + 1) * 14}px) scale(${1 - (stackIndex + 1) * 0.04})`,
                opacity: 0.5,
              }}
            >
              <div className="h-[var(--ui-profile-card-height)] w-full rounded-[var(--ui-radius-lg)] bg-slate-200" />
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
        >
          <div className="relative h-[var(--ui-profile-card-height)] w-full overflow-hidden rounded-[var(--ui-radius-lg)] bg-slate-900">
            {activeImage ? (
              <SignedImage
                src={activeImage}
                alt={name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-sm text-white/70">
                No photo yet
              </div>
            )}
            {imageUrls.length > 1 ? (
              <>
                <div className="absolute inset-x-4 top-4 flex gap-1">
                  {imageUrls.map((_, idx) => (
                    <button
                      key={`bar-${idx}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setImageIndex(idx);
                      }}
                      className={`h-1 flex-1 rounded-full ${
                        idx === imageIndex ? "bg-white" : "bg-white/40"
                      }`}
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex">
                  <button
                    type="button"
                    className="h-full w-1/2"
                    onClick={(event) => {
                      event.stopPropagation();
                      handlePrevImage();
                    }}
                    aria-label="Previous image"
                  />
                  <button
                    type="button"
                    className="h-full w-1/2"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleNextImage();
                    }}
                    aria-label="Next image"
                  />
                </div>
              </>
            ) : null}
            <div
              className="absolute inset-x-0 bottom-0 cursor-pointer bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent px-6 pb-6 pt-16"
              onClick={(event) => {
                event.stopPropagation();
                handleOpenProfile();
              }}
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-white">
                    {name}
                    {current.user.age ? ` ${current.user.age}` : ""}
                  </p>
                  <p className="text-sm text-white/75">{locationLabel}</p>
                </div>
                <button
                  type="button"
                  className="h-10 w-10 rounded-full bg-white/20 text-white"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenProfile();
                  }}
                >
                  ↑
                </button>
              </div>
            </div>
            {overlayLabel ? (
              <div
                className={`absolute left-6 top-8 rounded-lg border-2 px-3 py-1 text-sm font-semibold ${
                  overlayLabel.variant === "like"
                    ? "border-emerald-400 text-emerald-400"
                    : "border-rose-400 text-rose-400"
                }`}
                style={{ opacity: overlayLabel.opacity }}
              >
                {overlayLabel.text}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={handleRewind}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 shadow-sm"
        >
          ↺
        </button>
        <button
          type="button"
          onClick={handleReject}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-xl text-rose-500 shadow-sm"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => void handleApprove()}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xl text-emerald-500 shadow-sm"
        >
          ♥
        </button>
      </div>

      {status ? <p className="text-center text-xs text-slate-500">{status}</p> : null}
    </div>
  );
}
