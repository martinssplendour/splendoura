"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { BottomNav, BOTTOM_NAV_HEIGHT } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

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
          <View style={styles.header}>
            <Text style={styles.title}>Your Groups</Text>
            <Button variant="outline" onPress={loadGroups}>
              Refresh
            </Button>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color="#2563eb" />
          ) : groups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.status}>Join a group to start chatting.</Text>
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.id} style={styles.card}>
                {group.cover_image_url ? (
                  <Image
                    source={{ uri: resolveMediaUrl(group.cover_image_url) }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder} />
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{group.title}</Text>
                  <Text style={styles.cardMeta}>
                    {group.activity_type} - {group.location || "Flexible"}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {group.approved_members ?? 0}/{group.max_participants ?? "--"} members
                  </Text>
                </View>
                <Button size="sm" onPress={() => router.push(`/chat/${group.id}`)}>
                  Open
                </Button>
              </View>
            ))
          )}
          {status ? <Text style={styles.status}>{status}</Text> : null}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
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
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardMeta: {
    fontSize: 12,
    color: "#64748b",
  },
  empty: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  status: {
    fontSize: 13,
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
