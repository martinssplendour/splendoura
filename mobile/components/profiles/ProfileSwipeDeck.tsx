"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  type GestureResponderEvent,
  PanResponder,
  type PanResponderGestureState,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SignedImage } from "@/components/signed-media";

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
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [sentTo, setSentTo] = useState<Record<number, boolean>>({});
  const swipe = useRef(new Animated.ValueXY()).current;

  const DECK_SCALE = 0.9;
  const deckWidth = Math.round(width * 1.08 * DECK_SCALE);
  const deckHeight = Math.round(Math.max(Math.round(height * 0.62), 520) * DECK_SCALE);

  const current = profiles[index];
  const upcoming = profiles.slice(index + 1, index + 3);

  const imageUrls = useMemo(() => {
    if (!current) return [];
    const photos = Array.isArray(current.user.profile_media?.photos)
      ? current.user.profile_media?.photos || []
      : [];
    const fallback = current.user.profile_image_url ? [current.user.profile_image_url] : [];
    return Array.from(new Set([...photos, ...fallback]));
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
    if (!current) return "Location unavailable";
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
  }, [current, user?.location_lat, user?.location_lng]);

  useEffect(() => {
    setIndex(0);
    setDragX(0);
    setImageIndex(0);
    setHistory([]);
    setSentTo({});
    swipe.setValue({ x: 0, y: 0 });
  }, [profiles, swipe]);

  useEffect(() => {
    setImageIndex(0);
  }, [current?.user.id]);

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

  const sendRequest = useCallback(async () => {
    if (!current) return false;
    if (!accessToken) {
      setStatus("Sign in to connect.");
      router.push("/auth/login");
      return false;
    }
    if (!requestId) {
      setStatus("Update your filters to load profiles.");
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
      setStatus("Request sent.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send request.";
      setStatus(message);
      return false;
    }
  }, [accessToken, current, requestId, router, sentTo]);

  const handleApprove = useCallback(async () => {
    const ok = await sendRequest();
    if (ok) {
      swipeOut("right");
    } else {
      resetCard();
    }
  }, [resetCard, sendRequest, swipeOut]);

  const handleReject = useCallback(() => {
    setStatus("Not interested.");
    swipeOut("left");
  }, [swipeOut]);

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
  }, [history, isAnimating]);

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
        onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
          if (isAnimating) return false;
          return Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 6;
        },
        onPanResponderMove: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
          swipe.setValue({ x: gesture.dx, y: gesture.dy });
          setDragX(gesture.dx);
        },
        onPanResponderRelease: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
          void handleRelease(gesture.dx);
        },
      }),
    [handleRelease, isAnimating, swipe.x, swipe.y]
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
        <Text style={styles.emptyText}>No profiles to show.</Text>
      </View>
    );
  }

  const activeImage = imageUrls[imageIndex];

  return (
    <View style={[styles.wrapper, { width: deckWidth }]}>
      <View style={[styles.deck, { height: deckHeight }]}>
        {upcoming.map((candidate, stackIndex) => (
          <View
            key={candidate.user.id}
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
            <View style={[styles.card, { height: deckHeight }]} />
          </View>
        ))}

        <Animated.View
          style={[
            styles.activeCard,
            { transform: [{ translateX: swipe.x }, { translateY: swipe.y }, { rotate }] },
          ]}
          {...panResponder.panHandlers}
        >
          <Pressable
            style={[styles.card, { height: deckHeight }]}
            onPress={() => router.push(`/users/${current.user.id}`)}
          >
            {activeImage ? (
              <SignedImage uri={activeImage} style={styles.image} />
            ) : (
              <View style={styles.imageFallback}>
                <Text style={styles.fallbackText}>No photo yet</Text>
              </View>
            )}

            <View style={styles.progressRow}>
              {imageUrls.map((_, idx) => (
                <Pressable
                  key={`bar-${idx}`}
                  onPress={() => setImageIndex(idx)}
                  style={[
                    styles.progressBar,
                    idx === imageIndex ? styles.progressBarActive : null,
                  ]}
                />
              ))}
            </View>

            <View style={styles.tapRow}>
              <Pressable style={styles.tapZone} onPress={handlePrevImage} />
              <Pressable style={styles.tapZone} onPress={handleNextImage} />
            </View>

            <View style={styles.infoOverlay}>
              <View>
                <Text style={styles.name}>
                  {name}
                  {current.user.age ? ` ${current.user.age}` : ""}
                </Text>
                <Text style={styles.location}>{locationLabel}</Text>
              </View>
              <Pressable
                onPress={() => router.push(`/users/${current.user.id}`)}
                style={styles.infoButton}
              >
                <Text style={styles.infoButtonText}>↑</Text>
              </Pressable>
            </View>

            {overlayLabel ? (
              <View
                style={[
                  styles.overlayBadge,
                  overlayLabel.variant === "like" ? styles.overlayLike : styles.overlayNope,
                  { opacity: overlayLabel.opacity },
                ]}
              >
                <Text
                  style={[
                    styles.overlayText,
                    overlayLabel.variant === "like" ? styles.overlayTextLike : styles.overlayTextNope,
                  ]}
                >
                  {overlayLabel.text}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={handleRewind} style={[styles.actionButton, styles.actionRewind]}>
          <Text style={styles.actionIcon}>↺</Text>
        </Pressable>
        <Pressable onPress={handleReject} style={[styles.actionButton, styles.actionReject]}>
          <Text style={styles.actionIcon}>✕</Text>
        </Pressable>
        <Pressable onPress={() => void handleApprove()} style={[styles.actionButton, styles.actionApprove]}>
          <Text style={styles.actionIcon}>♥</Text>
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
  card: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#0f172a",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  imageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f2937",
  },
  fallbackText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600",
  },
  progressRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 4,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  progressBarActive: {
    backgroundColor: "#ffffff",
  },
  tapRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
  },
  tapZone: {
    flex: 1,
  },
  infoOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingTop: 80,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  location: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  infoButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  overlayBadge: {
    position: "absolute",
    top: 20,
    left: 20,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
  },
  overlayLike: {
    borderColor: "#34d399",
  },
  overlayNope: {
    borderColor: "#f87171",
  },
  overlayText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  overlayTextLike: {
    color: "#34d399",
  },
  overlayTextNope: {
    color: "#f87171",
  },
  actionRow: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    width: "100%",
  },
  actionButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  actionRewind: {
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  actionReject: {
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
  },
  actionApprove: {
    borderColor: "#bbf7d0",
    backgroundColor: "#dcfce7",
  },
  actionIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
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
