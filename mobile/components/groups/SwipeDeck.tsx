"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";

import GroupCard from "@/components/groups/GroupCard";
import type { SwipeGroup } from "@/components/groups/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const SWIPE_RATIO = 0.3;

interface SwipeDeckProps {
  groups: SwipeGroup[];
}

type GroupMedia = {
  id: number;
  url: string;
  media_type: "image" | "video";
  is_cover?: boolean | null;
};

export default function SwipeDeck({ groups }: SwipeDeckProps) {
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [creatorName, setCreatorName] = useState<string>("");
  const [creatorAvatar, setCreatorAvatar] = useState<string | null>(null);
  const swipe = useRef(new Animated.ValueXY()).current;

  const deckWidth = Math.round(width * 1.08);
  const deckHeight = Math.max(Math.round(612 * 0.9), Math.round(height * 0.595 * 0.9));

  const current = groups[index];
  const upcoming = groups.slice(index + 1, index + 3);

  useEffect(() => {
    setIndex(0);
    setDragX(0);
    setImageIndex(0);
    setHistory([]);
    swipe.setValue({ x: 0, y: 0 });
  }, [groups, swipe]);

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
          .map((item) => item.url);
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

  const userLocation = useMemo(() => {
    const parts = [user?.location_city, user?.location_country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Location unavailable";
  }, [user?.location_city, user?.location_country]);

  const resetCard = useCallback(() => {
    Animated.spring(swipe, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
    setDragX(0);
  }, [swipe]);

  const swipeOut = useCallback(
    (direction: "left" | "right") => {
      setIsAnimating(true);
      Animated.timing(swipe, {
        toValue: { x: direction === "right" ? width * 1.2 : -width * 1.2, y: 0 },
        duration: 220,
        useNativeDriver: false,
      }).start(() => {
        swipe.setValue({ x: 0, y: 0 });
        setDragX(0);
        setIsAnimating(false);
        setHistory((prev) => [...prev, index]);
        setIndex((prev) => prev + 1);
      });
    },
    [index, swipe, width]
  );

  const attemptJoin = useCallback(async (requestTier: "like" | "superlike" = "like") => {
    if (!current) return false;
    if (!user?.profile_image_url) {
      setStatus("Upload a profile photo before joining a group.");
      router.push("/profile");
      return false;
    }
    if (!accessToken) {
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
      setStatus(requestTier === "superlike" ? "Superlike sent." : "Join request sent.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to join this group.";
      setStatus(message);
      return false;
    } finally {
      setIsJoining(false);
    }
  }, [accessToken, current, router, user]);

  const handleApprove = useCallback(async () => {
    const ok = await attemptJoin("like");
    if (ok) {
      swipeOut("right");
    } else {
      resetCard();
    }
  }, [attemptJoin, resetCard, swipeOut]);

  const handleSuperlike = useCallback(async () => {
    const ok = await attemptJoin("superlike");
    if (ok) {
      swipeOut("right");
    } else {
      resetCard();
    }
  }, [attemptJoin, resetCard, swipeOut]);

  const handleReject = useCallback(() => {
    setStatus("Not interested.");
    swipeOut("left");
  }, [swipeOut]);

  const handleRewind = useCallback(() => {
    if (isAnimating || isJoining) return;
    if (history.length === 0) {
      setStatus("Nothing to rewind.");
      return;
    }
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setStatus("Rewound.");
    setIndex(previous);
  }, [history, isAnimating, isJoining]);

  const handleRelease = useCallback(
    async (dx: number) => {
      const threshold = width * SWIPE_RATIO;
      if (Math.abs(dx) < threshold) {
        resetCard();
        return;
      }
      if (dx > 0) {
        await handleApprove();
        return;
      }
      handleReject();
    },
    [handleApprove, handleReject, resetCard, width]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (isAnimating || isJoining) return false;
          return Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 6;
        },
        onPanResponderMove: Animated.event([null, { dx: swipe.x, dy: swipe.y }], {
          useNativeDriver: false,
          listener: (_, gesture) => {
            setDragX(gesture.dx);
          },
        }),
        onPanResponderRelease: (_, gesture) => {
          void handleRelease(gesture.dx);
        },
      }),
    [handleRelease, isAnimating, isJoining, swipe.x, swipe.y]
  );

  const rotate = swipe.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ["-10deg", "0deg", "10deg"],
  });

  const overlayOpacity = Math.min(Math.abs(dragX) / (width * SWIPE_RATIO), 1);
  const overlayLabel =
    Math.abs(dragX) > 20
      ? {
          text: dragX > 0 ? "LIKE" : "NOPE",
          variant: dragX > 0 ? ("like" as const) : ("nope" as const),
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

  if (!current) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No groups to show.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { width: deckWidth }]}>
      <View style={[styles.deck, { height: deckHeight }]}>
        {upcoming.map((group, stackIndex) => (
          <View
            key={group.id}
            style={[
              styles.stackCard,
              {
                transform: [
                  { translateY: (stackIndex + 1) * 12 },
                  { scale: 1 - (stackIndex + 1) * 0.04 },
                ],
                opacity: 0.5,
              },
            ]}
          >
            <GroupCard group={group} containerStyle={{ height: deckHeight }} />
          </View>
        ))}

        <Animated.View
          style={[
            styles.activeCard,
            { transform: [{ translateX: swipe.x }, { translateY: swipe.y }, { rotate }] },
          ]}
          {...panResponder.panHandlers}
        >
          <GroupCard
            group={current}
            overlayLabel={overlayLabel}
            containerStyle={{ height: deckHeight }}
            imageUrls={imageUrls}
            activeImageIndex={imageIndex}
            onTapLeft={handlePrevImage}
            onTapRight={handleNextImage}
            onInfoPress={() => router.push(`/groups/${current.id}`)}
            creatorAvatarUrl={creatorAvatar}
            onCreatorPress={() => router.push(`/users/${current.creator_id}`)}
            topLeftMeta={[
              creatorName || `User ${current.creator_id}`,
              userLocation,
            ]}
          />
        </Animated.View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={handleRewind}
          disabled={isJoining}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionRewind,
            pressed && !isJoining ? styles.pressed : null,
            isJoining ? styles.disabled : null,
          ]}
        >
          <Text style={[styles.actionIcon, styles.actionIconRewind]}>↺</Text>
          <Text style={styles.actionLabel}>Undo</Text>
        </Pressable>
        <Pressable
          onPress={handleReject}
          disabled={isJoining}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionReject,
            pressed && !isJoining ? styles.pressed : null,
            isJoining ? styles.disabled : null,
          ]}
        >
          <Text style={[styles.actionIcon, styles.actionIconReject]}>X</Text>
          <Text style={styles.actionLabel}>Nope</Text>
        </Pressable>
        <Pressable
          onPress={() => void handleSuperlike()}
          disabled={isJoining}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionSuper,
            pressed && !isJoining ? styles.pressed : null,
            isJoining ? styles.disabled : null,
          ]}
        >
          <Text style={[styles.actionIcon, styles.actionIconSuper]}>★</Text>
          <Text style={styles.actionLabel}>Super</Text>
        </Pressable>
        <Pressable
          onPress={() => void handleApprove()}
          disabled={isJoining}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionApprove,
            pressed && !isJoining ? styles.pressed : null,
            isJoining ? styles.disabled : null,
          ]}
        >
          <Text style={[styles.actionIcon, styles.actionIconApprove]}>✓</Text>
          <Text style={styles.actionLabel}>Like</Text>
        </Pressable>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
    alignSelf: "center",
    alignItems: "center",
    marginTop: 0,
  },
  deck: {
    justifyContent: "center",
    width: "100%",
  },
  stackCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  activeCard: {
    zIndex: 2,
    width: "100%",
  },
  actionRow: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "center",
    width: "100%",
    marginTop: 0,
    transform: [{ translateY: -6 }],
  },
  actionButton: {
    width: 52,
    height: 57,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    gap: 2,
  },
  actionRewind: {
    borderColor: "#cbd5f5",
    backgroundColor: "#eef2ff",
  },
  actionReject: {
    borderColor: "#fca5a5",
    backgroundColor: "#fee2e2",
  },
  actionSuper: {
    borderColor: "#fcd34d",
    backgroundColor: "#fef9c3",
  },
  actionApprove: {
    borderColor: "#6ee7b7",
    backgroundColor: "#d1fae5",
  },
  actionIcon: {
    fontSize: 23,
    fontWeight: "700",
  },
  actionLabel: {
    fontSize: 7,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
  },
  actionIconRewind: {
    color: "#4f46e5",
  },
  actionIconReject: {
    color: "#ef4444",
  },
  actionIconSuper: {
    color: "#d97706",
  },
  actionIconApprove: {
    color: "#10b981",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  status: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
  },
  empty: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
  },
});
