"use client";

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SignedImage } from "@/components/signed-media";

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

interface ProfileDetailItem {
  key: string;
  label: string;
  value: string;
}

const PROFILE_DETAIL_LABELS: Record<string, string> = {
  availability_windows: "Availability",
  show_orientation: "Show orientation",
  looking_for: "Looking for",
  dob: "Date of birth",
  height_cm: "Height (cm)",
  weight_kg: "Weight (kg)",
  income_bracket: "Income bracket",
  job_title: "Job title",
  body_type: "Body type",
  hair_color: "Hair color",
  eye_color: "Eye color",
  education_level: "Education",
  political_views: "Political views",
  zodiac_sign: "Zodiac sign",
  personality_type: "Personality type",
  travel_frequency: "Travel frequency",
  communication_style: "Communication style",
  relationship_preference: "Relationship preference",
  casual_dating: "Open to casual dating",
  kink_friendly: "Kink friendly",
  wants_children: "Wants children",
  has_children: "Has children",
  safety_contacts: "Trusted contacts",
  demo_profile: "Demo profile",
  demo_label: "Profile label",
};

const OMIT_PROFILE_DETAIL_KEYS = new Set([
  "id_verified",
  "id_verification_status",
  "safety_settings.block_nudity",
]);

function startCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function primitiveToText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return null;
}

function getObjectSummary(value: Record<string, unknown>) {
  const name = primitiveToText(value.name);
  const contact = primitiveToText(value.contact);
  if (name && contact) return `${name} (${contact})`;
  if (name) return name;
  if (contact) return contact;
  return null;
}

function mapProfileDetails(details: Record<string, unknown>): ProfileDetailItem[] {
  const items: ProfileDetailItem[] = [];
  const seen = new Set<string>();

  const pushItem = (path: string, rawValue: unknown) => {
    if (seen.has(path)) return;
    const value = primitiveToText(rawValue);
    if (!value) return;
    const leaf = path.split(".").pop() || path;
    const label = PROFILE_DETAIL_LABELS[path] || PROFILE_DETAIL_LABELS[leaf] || startCase(leaf);
    items.push({ key: path, label, value });
    seen.add(path);
  };

  const visit = (input: Record<string, unknown>, prefix = "") => {
    Object.entries(input).forEach(([key, raw]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (OMIT_PROFILE_DETAIL_KEYS.has(key) || OMIT_PROFILE_DETAIL_KEYS.has(path)) {
        return;
      }
      if (raw == null) return;

      if (Array.isArray(raw)) {
        if (raw.length === 0) return;
        const primitiveItems = raw
          .map((entry) => primitiveToText(entry))
          .filter((entry): entry is string => Boolean(entry));
        if (primitiveItems.length === raw.length) {
          pushItem(path, primitiveItems.join(", "));
          return;
        }
        const objectItems = raw
          .map((entry) =>
            typeof entry === "object" && entry !== null
              ? getObjectSummary(entry as Record<string, unknown>)
              : null
          )
          .filter((entry): entry is string => Boolean(entry));
        if (objectItems.length > 0) {
          pushItem(path, objectItems.join(", "));
        }
        return;
      }

      const primitive = primitiveToText(raw);
      if (primitive) {
        pushItem(path, primitive);
        return;
      }

      if (typeof raw === "object") {
        visit(raw as Record<string, unknown>, path);
      }
    });
  };

  visit(details);
  return items;
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
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

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
  const detailItems = mapProfileDetails(details as Record<string, unknown>);

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
              <SignedImage uri={profile.profile_image_url} style={styles.avatar} />
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
                <Pressable key={photo} onPress={() => setPreviewPhoto(photo)}>
                  <SignedImage uri={photo} style={styles.photo} resizeMode="cover" />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {detailItems.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile details</Text>
            <View style={styles.detailList}>
              {detailItems.map((item) => (
                <View key={item.key} style={styles.detailItem}>
                  <Text style={styles.detailItemLabel}>{item.label}</Text>
                  <Text style={styles.detailItemValue}>{item.value}</Text>
                </View>
              ))}
            </View>
            {Boolean((details as Record<string, unknown>).demo_profile) ? (
              <Text style={styles.demoBadge}>Demo profile</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <Modal
        visible={Boolean(previewPhoto)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <Pressable style={styles.lightboxBackdrop} onPress={() => setPreviewPhoto(null)}>
          <Pressable style={styles.lightboxContent} onPress={() => {}}>
            {previewPhoto ? (
              <SignedImage uri={previewPhoto} style={styles.lightboxImage} resizeMode="contain" />
            ) : null}
            <Pressable style={styles.lightboxClose} onPress={() => setPreviewPhoto(null)}>
              <Text style={styles.lightboxCloseText}>x</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  lightboxContent: {
    width: "100%",
    maxHeight: "90%",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  lightboxClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxCloseText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  detailList: {
    gap: 8,
  },
  detailItem: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  detailItemLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#94a3b8",
  },
  detailItemValue: {
    fontSize: 13,
    color: "#334155",
  },
  demoBadge: {
    marginTop: 2,
    alignSelf: "flex-start",
    backgroundColor: "#ffedd5",
    color: "#c2410c",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
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
