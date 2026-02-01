"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { BottomNav, BOTTOM_NAV_HEIGHT } from "@/components/navigation/BottomNav";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SignedImage } from "@/components/signed-media";

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

type SystemNotice = {
  id: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { accessToken, user, isLoading } = useAuth();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);

  const systemNotices = useMemo<SystemNotice[]>(() => {
    if (!user) return [];
    const notices: SystemNotice[] = [];
    if (!user.profile_image_url) {
      notices.push({
        id: "add-photo",
        title: "Add a profile photo",
        description: "Profiles with a photo get more matches and can create groups.",
        ctaLabel: "Upload photo",
        ctaHref: "/profile",
      });
    }
    if (!user.bio) {
      notices.push({
        id: "add-bio",
        title: "Introduce yourself",
        description: "A short bio helps people know what you are about.",
        ctaLabel: "Edit bio",
        ctaHref: "/profile",
      });
    }
    if (user.verification_status !== "verified") {
      notices.push({
        id: "verify",
        title: "Verify your profile",
        description: "Verified profiles get more trust and visibility.",
        ctaLabel: "Start verification",
        ctaHref: "/profile",
      });
    }
    if (notices.length === 0) {
      notices.push({
        id: "all-good",
        title: "You are all caught up",
        description: "No new system updates right now.",
      });
    }
    return notices;
  }, [user]);

  useEffect(() => {
    async function loadRequests() {
      setRequestError(null);
      setLoadingRequests(true);
      try {
        if (!accessToken || !user?.id) {
          setLoadingRequests(false);
          return;
        }

        const groupsRes = await apiFetch(`/groups/?creator_id=${user.id}`, { token: accessToken });
        if (!groupsRes.ok) {
          const message = await groupsRes.text().catch(() => "");
          setRequestError(message || "Unable to load your groups.");
          setLoadingRequests(false);
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
        setLoadingRequests(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load join requests.";
        setRequestError(message);
        setLoadingRequests(false);
      }
    }

    loadRequests();
  }, [accessToken, user?.id]);

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
          <View style={styles.authCard}>
            <Text style={styles.pageTitle}>Notifications</Text>
            <Text style={styles.subtitle}>Sign in to view updates.</Text>
            <Text style={styles.link} onPress={() => router.push("/auth/login")}>
              Go to sign in
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <ScrollView contentContainerStyle={[styles.container, styles.containerWithNav]}>
          <View>
            <Text style={styles.pageTitle}>Notifications</Text>
            <Text style={styles.subtitle}>Updates from your groups plus system reminders.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>System updates</Text>
            <View style={styles.noticeList}>
              {systemNotices.map((notice) => (
                <View key={notice.id} style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>{notice.title}</Text>
                  <Text style={styles.noticeBody}>{notice.description}</Text>
                  {notice.ctaHref ? (
                    <Text style={styles.link} onPress={() => router.push(notice.ctaHref!)}>
                      {notice.ctaLabel || "View"}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Join requests</Text>
                <Text style={styles.sectionSubtitle}>
                  People asking to join groups you created.
                </Text>
              </View>
              <Text style={styles.link} onPress={() => router.push("/requests/manage")}>
                Manage requests
              </Text>
            </View>

            {loadingRequests ? (
              <View style={styles.loadingBlock} />
            ) : requestError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Unable to load join requests</Text>
                <Text style={styles.errorBody}>{requestError}</Text>
              </View>
            ) : requests.length === 0 ? (
              <Text style={styles.status}>No pending requests right now.</Text>
            ) : (
              <View style={styles.requestList}>
                {requests.map((request) => {
                  const displayName =
                    request.user?.full_name || request.user?.email || `User ${request.user_id}`;
                  return (
                    <View key={`${request.group_id}-${request.user_id}`} style={styles.requestCard}>
                      <View style={styles.requestRow}>
                        {request.user?.profile_image_url ? (
                          <SignedImage uri={request.user.profile_image_url} style={styles.avatar} />
                        ) : (
                          <View style={styles.avatarPlaceholder} />
                        )}
                        <View style={styles.requestBody}>
                          <Text style={styles.requestTitle}>
                            {displayName} wants to join{" "}
                            <Text style={styles.requestTitleStrong}>{request.group_title}</Text>
                          </Text>
                          {request.request_tier === "superlike" ? (
                            <Text style={styles.superlikeBadge}>Superlike</Text>
                          ) : null}
                          {request.request_message ? (
                            <Text style={styles.requestMessage}>{request.request_message}</Text>
                          ) : null}
                          <View style={styles.linkRow}>
                            <Text
                              style={styles.link}
                              onPress={() => router.push(`/groups/${request.group_id}`)}
                            >
                              View group
                            </Text>
                            <Text style={styles.dot}>|</Text>
                            <Text
                              style={styles.link}
                              onPress={() => router.push(`/users/${request.user_id}`)}
                            >
                              View profile
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>General updates</Text>
            <Text style={styles.sectionSubtitle}>
              We will surface match invites and group announcements here next.
            </Text>
            <View style={styles.linkRow}>
              <Text style={styles.link} onPress={() => router.push("/groups")}>
                Browse groups
              </Text>
              <Text style={styles.dot}>|</Text>
              <Text style={styles.link} onPress={() => router.push("/profile")}>
                Update profile
              </Text>
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
    gap: 16,
  },
  containerWithNav: {
    paddingBottom: BOTTOM_NAV_HEIGHT + 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderText: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  noticeList: {
    gap: 10,
  },
  noticeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 6,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
  },
  noticeBody: {
    fontSize: 12,
    color: "#64748b",
  },
  requestList: {
    gap: 12,
  },
  requestCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 12,
  },
  requestRow: {
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
  requestBody: {
    flex: 1,
    gap: 4,
  },
  requestTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  requestTitleStrong: {
    color: "#0f172a",
    fontWeight: "700",
  },
  requestMessage: {
    fontSize: 12,
    color: "#64748b",
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
  linkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
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
  status: {
    fontSize: 12,
    color: "#64748b",
  },
  loadingBlock: {
    height: 120,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    padding: 12,
    gap: 4,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b91c1c",
  },
  errorBody: {
    fontSize: 11,
    color: "#dc2626",
  },
  authCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 20,
    gap: 6,
    alignItems: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
});
