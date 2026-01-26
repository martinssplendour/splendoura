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
import { useRouter } from "expo-router";

import { BottomNav, BOTTOM_NAV_HEIGHT } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface MembershipItem {
  id: number;
  user_id: number;
  group_id: number;
  join_status: "requested" | "approved" | "rejected";
  role: "creator" | "member";
  request_message?: string | null;
  request_tier?: string | null;
}

interface UserSummary {
  id: number;
  full_name?: string;
  email: string;
  profile_image_url?: string;
}

interface RequestItem {
  group_id: number;
  group_title: string;
  user_id: number;
  user?: UserSummary;
  request_message?: string | null;
  request_tier?: string | null;
}

export default function RequestsScreen() {
  const router = useRouter();
  const { accessToken, user, isLoading } = useAuth();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRequests() {
      if (!accessToken || !user?.id) {
        setLoading(false);
        return;
      }

      const groupsRes = await apiFetch(`/groups?creator_id=${user.id}`, { token: accessToken });
      if (!groupsRes.ok) {
        setLoading(false);
        return;
      }
      const groupData: { id: number; title: string }[] = await groupsRes.json();

      const nextUsers: Record<number, UserSummary> = {};
      const nextRequests: RequestItem[] = [];

      for (const group of groupData) {
        const membersRes = await apiFetch(`/groups/${group.id}/members`, { token: accessToken });
        if (!membersRes.ok) {
          continue;
        }
        const members: MembershipItem[] = await membersRes.json();
        const requestedMembers = members.filter((m) => m.join_status === "requested");

        for (const member of requestedMembers) {
          if (nextUsers[member.user_id]) {
            nextRequests.push({
              group_id: group.id,
              group_title: group.title,
              user_id: member.user_id,
              user: nextUsers[member.user_id],
              request_message: member.request_message,
              request_tier: member.request_tier,
            });
            continue;
          }
          const userRes = await apiFetch(`/users/${member.user_id}`, { token: accessToken });
          if (userRes.ok) {
            const userSummary = await userRes.json();
            nextUsers[member.user_id] = userSummary;
            nextRequests.push({
              group_id: group.id,
              group_title: group.title,
              user_id: member.user_id,
              user: userSummary,
              request_message: member.request_message,
              request_tier: member.request_tier,
            });
          } else {
            nextRequests.push({
              group_id: group.id,
              group_title: group.title,
              user_id: member.user_id,
              request_message: member.request_message,
              request_tier: member.request_tier,
            });
          }
        }
      }

      setRequests(nextRequests);
      setLoading(false);
    }

    loadRequests();
  }, [accessToken, user?.id]);

  const handleDecision = async (groupId: number, userId: number, action: "approve" | "reject") => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${groupId}/${action}/${userId}`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      setRequests((prev) =>
        prev.filter((item) => !(item.group_id === groupId && item.user_id === userId))
      );
    }
  };

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
          <Text style={styles.status}>Sign in to manage requests.</Text>
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <ScrollView contentContainerStyle={[styles.container, styles.containerWithNav]}>
          <View>
            <Text style={styles.title}>Join Requests</Text>
            <Text style={styles.subtitle}>Review pending requests for your groups.</Text>
          </View>

          {requests.length === 0 ? (
            <Text style={styles.status}>No pending requests right now.</Text>
          ) : (
            requests.map((request) => {
              const displayName =
                request.user?.full_name || request.user?.email || `User ${request.user_id}`;
              return (
                <View key={`${request.group_id}-${request.user_id}`} style={styles.card}>
                  <View style={styles.cardRow}>
                    {request.user?.profile_image_url ? (
                      <Image
                        source={{ uri: resolveMediaUrl(request.user.profile_image_url) }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder} />
                    )}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>
                      {displayName} wants to join {request.group_title}
                    </Text>
                    {request.request_tier === "superlike" ? (
                      <Text style={styles.superlikeBadge}>Superlike</Text>
                    ) : null}
                    {request.request_message ? (
                      <Text style={styles.note}>{request.request_message}</Text>
                    ) : null}
                    <View style={styles.linkRow}>
                      <Text
                          style={styles.link}
                          onPress={() => router.push(`/groups/${request.group_id}`)}
                        >
                          View group
                        </Text>
                        <Text style={styles.dot}>-</Text>
                        <Text
                          style={styles.link}
                          onPress={() => router.push(`/users/${request.user_id}`)}
                        >
                          View profile
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <Button
                      variant="outline"
                      onPress={() => handleDecision(request.group_id, request.user_id, "reject")}
                    >
                      Decline
                    </Button>
                    <Button
                      onPress={() => handleDecision(request.group_id, request.user_id, "approve")}
                    >
                      Accept
                    </Button>
                  </View>
                </View>
              );
            })
          )}
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
  title: {
    fontSize: 22,
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
    gap: 10,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e2e8f0",
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  linkRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  superlikeBadge: {
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "700",
    color: "#b45309",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  note: {
    fontSize: 12,
    color: "#475569",
  },
  link: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600",
  },
  dot: {
    fontSize: 12,
    color: "#94a3b8",
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
    gap: 12,
  },
});
