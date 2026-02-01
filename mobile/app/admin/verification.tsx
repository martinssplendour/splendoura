"use client";

import { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SignedImage } from "@/components/signed-media";

interface PendingUser {
  id: number;
  email: string;
  full_name: string;
  username?: string | null;
  profile_image_url?: string | null;
  verification_status?: string | null;
  profile_media?: {
    photo_verification_url?: string | null;
    photo_verified?: boolean;
  } | null;
  profile_details?: Record<string, unknown> | null;
}

export default function VerificationAdminScreen() {
  const { accessToken, user, isLoading } = useAuth();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [pendingId, setPendingId] = useState<PendingUser[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadPending() {
      if (!accessToken) return;
      const res = await apiFetch("/admin/users/pending", { token: accessToken });
      if (res.ok) {
        setPending(await res.json());
      }
      const idRes = await apiFetch("/admin/users/id-pending", { token: accessToken });
      if (idRes.ok) {
        setPendingId(await idRes.json());
      }
    }
    loadPending();
  }, [accessToken]);

  const handleAction = async (id: number, action: "verify" | "reject") => {
    if (!accessToken) return;
    const res = await apiFetch(`/admin/users/${id}/${action}`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      setPending((prev) => prev.filter((entry) => entry.id !== id));
      setStatus(`User ${action}d.`);
    } else {
      const data = await res.json().catch(() => null);
      setStatus(data?.detail || "Action failed.");
    }
  };

  const handlePhotoAction = async (id: number) => {
    if (!accessToken) return;
    const res = await apiFetch(`/admin/users/${id}/photo-verify`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      setPending((prev) => prev.filter((entry) => entry.id !== id));
      setStatus("Photo verified.");
    }
  };

  const handleIdAction = async (id: number, action: "id-verify" | "id-reject") => {
    if (!accessToken) return;
    const res = await apiFetch(`/admin/users/${id}/${action}`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      setPendingId((prev) => prev.filter((entry) => entry.id !== id));
      setStatus(action === "id-verify" ? "ID verified." : "ID rejected.");
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.status}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (user?.role !== "admin") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.status}>Admin access required.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View>
          <Text style={styles.title}>Verification Requests</Text>
          <Text style={styles.subtitle}>
            Review pending profiles and approve or reject verification.
          </Text>
        </View>

        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Text style={styles.sectionTitle}>Photo verification</Text>
        {pending.length === 0 ? (
          <Text style={styles.status}>No pending photo requests.</Text>
        ) : (
          pending.map((entry) => (
            <View key={entry.id} style={styles.card}>
              <View style={styles.cardRow}>
                {entry.profile_media?.photo_verification_url ? (
                  <SignedImage
                    uri={entry.profile_media.photo_verification_url}
                    style={styles.avatar}
                  />
                ) : entry.profile_image_url ? (
                  <SignedImage uri={entry.profile_image_url} style={styles.avatar} />
                ) : null}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{entry.full_name}</Text>
                  <Text style={styles.cardMeta}>{entry.email}</Text>
                  {entry.username ? <Text style={styles.cardMeta}>@{entry.username}</Text> : null}
                </View>
              </View>
              <View style={styles.actionRow}>
                <Button onPress={() => handlePhotoAction(entry.id)}>Approve</Button>
                <Button variant="outline" onPress={() => handleAction(entry.id, "reject")}>
                  Reject
                </Button>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>ID verification</Text>
        {pendingId.length === 0 ? (
          <Text style={styles.status}>No pending ID requests.</Text>
        ) : (
          pendingId.map((entry) => {
            const idUrl = (entry.profile_details as Record<string, unknown> | null)
              ?.id_verification_url as string | undefined;
            return (
              <View key={`id-${entry.id}`} style={styles.card}>
                <View style={styles.cardRow}>
                  {idUrl ? (
                    <SignedImage uri={idUrl} style={styles.avatar} />
                  ) : null}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{entry.full_name}</Text>
                    <Text style={styles.cardMeta}>{entry.email}</Text>
                    {entry.username ? <Text style={styles.cardMeta}>@{entry.username}</Text> : null}
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <Button onPress={() => handleIdAction(entry.id, "id-verify")}>Approve</Button>
                  <Button variant="outline" onPress={() => handleIdAction(entry.id, "id-reject")}>
                    Reject
                  </Button>
                </View>
              </View>
            );
          })
        )}
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  card: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardMeta: {
    fontSize: 12,
    color: "#64748b",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  status: {
    fontSize: 13,
    color: "#64748b",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
