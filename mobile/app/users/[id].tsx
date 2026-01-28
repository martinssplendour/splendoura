"use client";

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface UserProfile {
  id: number;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  bio?: string | null;
  age?: number | null;
  gender?: string | null;
  sexual_orientation?: string | null;
  location_city?: string | null;
  location_country?: string | null;
  profile_image_url?: string | null;
  profile_video_url?: string | null;
  interests?: string[] | null;
  badges?: string[] | null;
  verification_status?: string | null;
  last_active_at?: string | null;
  profile_media?: {
    photos?: string[];
    photo_verified?: boolean;
  } | null;
  profile_details?: Record<string, unknown> | null;
}

const formatLastActive = (value?: string | null) => {
  if (!value) return "Active recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Active recently";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 10) return "Active now";
  if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  return `Active ${date.toLocaleDateString()}`;
};

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { accessToken, isLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      const res = await apiFetch(`/users/${params.id}`, { token: accessToken });
      if (res.ok) {
        setProfile(await res.json());
      }
      setLoading(false);
    }
    loadProfile();
  }, [accessToken, params.id]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (!accessToken) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.status}>Sign in to view profiles.</Text>
          <Button onPress={() => router.push("/auth/login")}>Go to sign in</Button>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.status}>User not found.</Text>
          <Button variant="outline" onPress={() => router.replace("/requests")}>
            Back to requests
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const photoVerified = Boolean(profile.profile_media?.photo_verified);
  const idVerified = Boolean((profile.profile_details as Record<string, unknown> | null)?.id_verified);

  const details = profile.profile_details || {};
  const photos = profile.profile_media?.photos || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <Button variant="outline" onPress={() => router.replace("/requests")}>
            Back
          </Button>
          <Button onPress={() => router.push(`/groups?creator_id=${profile.id}`)}>
            View user groups
          </Button>
        </View>

        <View style={styles.card}>
          <View style={styles.profileRow}>
            {profile.profile_image_url ? (
              <Image
                source={{ uri: resolveMediaUrl(profile.profile_image_url) }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
            <View>
              <Text style={styles.name}>
                {profile.full_name || profile.username || "User"}
              </Text>
              {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
              <Text style={styles.status}>
                {profile.verification_status === "verified" ? "Verified" : "Not verified"}
              </Text>
              {(photoVerified || idVerified) ? (
                <View style={styles.verificationRow}>
                  {photoVerified ? (
                    <Text style={[styles.badge, styles.verificationBadge]}>
                      Photo verified
                    </Text>
                  ) : null}
                  {idVerified ? (
                    <Text style={[styles.badge, styles.verificationBadge]}>
                      ID verified
                    </Text>
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.status}>{formatLastActive(profile.last_active_at)}</Text>
            </View>
          </View>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          <View style={styles.detailRow}>
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Basics</Text>
              <Text style={styles.detailText}>
                Age: {profile.age ?? "—"} · Gender: {profile.gender ?? "—"}
              </Text>
              <Text style={styles.detailText}>
                Orientation: {profile.sexual_orientation ?? "—"}
              </Text>
            </View>
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailText}>
                {profile.location_city || "City"} {profile.location_country || ""}
              </Text>
            </View>
          </View>
          {profile.interests?.length ? (
            <View style={styles.tagRow}>
              {profile.interests.map((interest) => (
                <Text key={interest} style={styles.tag}>
                  {interest}
                </Text>
              ))}
            </View>
          ) : null}
          {profile.badges?.length ? (
            <View style={styles.tagRow}>
              {profile.badges.map((badge) => (
                <Text key={badge} style={styles.badge}>
                  {badge}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {photos.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <Image
                  key={photo}
                  source={{ uri: resolveMediaUrl(photo) }}
                  style={styles.photo}
                  resizeMode="contain"
                />
              ))}
            </View>
          </View>
        ) : null}

        {Object.keys(details).length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile details</Text>
            {Array.isArray((details as Record<string, unknown>).availability_windows) ? (
              <Text style={styles.detailText}>
                Availability:{" "}
                {((details as Record<string, unknown>).availability_windows as string[]).join(", ")}
              </Text>
            ) : null}
            <Text style={styles.detailJson}>{JSON.stringify(details, null, 2)}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  card: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 10,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  handle: {
    fontSize: 12,
    color: "#64748b",
  },
  bio: {
    fontSize: 14,
    color: "#334155",
  },
  detailRow: {
    flexDirection: "row",
    gap: 12,
  },
  detailCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  detailText: {
    fontSize: 13,
    color: "#475569",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "600",
  },
  verificationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  verificationBadge: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photo: {
    width: "48%",
    height: 140,
    borderRadius: 16,
  },
  detailJson: {
    fontSize: 12,
    color: "#64748b",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  status: {
    fontSize: 13,
    color: "#64748b",
  },
});
