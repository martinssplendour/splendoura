"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { BottomNav, BOTTOM_NAV_HEIGHT } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SignedImage } from "@/components/signed-media";

interface ChatGroup {
  id: number;
  title: string;
  activity_type: string;
  location?: string | null;
  approved_members?: number | null;
  max_participants?: number | null;
  cover_image_url?: string | null;
}

export default function ChatListScreen() {
  const router = useRouter();
  const { accessToken, isLoading } = useAuth();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadGroups = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setStatus(null);
    const res = await apiFetch("/users/me/groups", { token: accessToken });
    if (!res.ok) {
      setStatus("Unable to load your chat groups.");
      setLoading(false);
      return;
    }
    const data: ChatGroup[] = await res.json();
    setGroups(data);
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

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
          <Text style={styles.status}>Sign in to access chats.</Text>
          <Button onPress={() => router.push("/auth/login")}>Go to sign in</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.page}>
          <ScrollView contentContainerStyle={[styles.container, styles.containerWithNav]}>
            <View style={styles.panel}>
              <View style={styles.header}>
                <View>
                  <Text style={styles.kicker}>Chats</Text>
                  <Text style={styles.title}>Conversations</Text>
                </View>
                <Button variant="outline" size="sm" onPress={loadGroups}>
                  Refresh
                </Button>
              </View>
              <View style={styles.list}>
                {loading ? (
                  <ActivityIndicator size="large" color="#2563eb" />
                ) : groups.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>Join a group to start chatting.</Text>
                  </View>
                ) : (
                  groups.map((group) => (
                    <Pressable
                      key={group.id}
                      onPress={() => router.push(`/chat/${group.id}`)}
                      style={({ pressed }) => [
                        styles.card,
                        pressed ? styles.cardPressed : null,
                      ]}
                    >
                      {group.cover_image_url ? (
                        <SignedImage uri={group.cover_image_url} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarPlaceholder} />
                      )}
                      <View style={styles.cardBody}>
                        <Text style={styles.cardTitle}>{group.title}</Text>
                        <Text style={styles.cardMeta}>
                          {group.activity_type} - {group.location || "Flexible"}
                        </Text>
                        <Text style={styles.cardMetaMuted}>
                          {group.approved_members ?? 0}/{group.max_participants ?? "--"} members
                        </Text>
                      </View>
                    </Pressable>
                  ))
                )}
                {status ? <Text style={styles.status}>{status}</Text> : null}
              </View>
            </View>
          </ScrollView>
          <BottomNav />
        </View>
      </SafeAreaView>
    );
  }

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  page: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 12,
  },
  containerWithNav: {
    paddingBottom: BOTTOM_NAV_HEIGHT + 16,
  },
  panel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  kicker: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#94a3b8",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  list: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardPressed: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardMeta: {
    fontSize: 11,
    color: "#64748b",
  },
  cardMetaMuted: {
    fontSize: 10,
    color: "#94a3b8",
  },
  empty: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  status: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
});
