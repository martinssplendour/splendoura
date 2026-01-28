"use client";

import { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, accessToken, refreshSession, logout } = useAuth();
  const [showOrientation, setShowOrientation] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [incognitoMode, setIncognitoMode] = useState(false);
  const [globalMode, setGlobalMode] = useState(false);
  const [blockNudity, setBlockNudity] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicators, setTypingIndicators] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const details = (user?.profile_details as Record<string, unknown>) || {};
    const discovery = (user?.discovery_settings as Record<string, unknown>) || {};
    const safety = (details.safety_settings as Record<string, unknown>) || {};
    const notifications = (details.notification_settings as Record<string, unknown>) || {};
    const chat = (details.chat_settings as Record<string, unknown>) || {};
    setShowOrientation((details.show_orientation as boolean) ?? true);
    setProfileVisibility(discovery.profile_visibility !== false);
    setIncognitoMode(Boolean(discovery.incognito_mode));
    setGlobalMode(Boolean(discovery.global_mode));
    setBlockNudity(Boolean(safety.block_nudity));
    setPushNotifs((notifications.push_enabled as boolean) ?? true);
    setEmailNotifs((notifications.email_enabled as boolean) ?? false);
    setReadReceipts((chat.read_receipts as boolean) ?? true);
    setTypingIndicators((chat.typing_indicators as boolean) ?? true);
  }, [user]);

  const handleSave = async () => {
    if (!accessToken) {
      setStatus("Sign in to update settings.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const details = (user?.profile_details as Record<string, unknown>) || {};
      const safety = (details.safety_settings as Record<string, unknown>) || {};
      const discovery = (user?.discovery_settings as Record<string, unknown>) || {};
      const notifications = (details.notification_settings as Record<string, unknown>) || {};
      const chat = (details.chat_settings as Record<string, unknown>) || {};
      const profile_details = {
        ...details,
        show_orientation: showOrientation,
        safety_settings: {
          ...safety,
          block_nudity: blockNudity,
        },
        notification_settings: {
          ...notifications,
          push_enabled: pushNotifs,
          email_enabled: emailNotifs,
        },
        chat_settings: {
          ...chat,
          read_receipts: readReceipts,
          typing_indicators: typingIndicators,
        },
      };
      const discovery_settings = {
        ...discovery,
        profile_visibility: profileVisibility,
        incognito_mode: incognitoMode,
        global_mode: globalMode,
      };
      const res = await apiFetch("/users/me", {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({ profile_details, discovery_settings }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to update settings.");
      }
      await refreshSession();
      setStatus("Settings saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update settings.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account</Text>
            <Button size="sm" variant="outline" onPress={() => router.push("/profile")}>
              Edit profile
            </Button>
          </View>
          <Text style={styles.helperText}>Email, password, and profile basics.</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Verification status</Text>
            <Text style={styles.valueText}>{user?.verification_status || "unverified"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & visibility</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Profile visible</Text>
            <Switch value={profileVisibility} onValueChange={setProfileVisibility} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Incognito mode</Text>
            <Switch value={incognitoMode} onValueChange={setIncognitoMode} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Show orientation</Text>
            <Switch value={showOrientation} onValueChange={setShowOrientation} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discovery & matching</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Global mode</Text>
            <Switch value={globalMode} onValueChange={setGlobalMode} />
          </View>
          <Text style={styles.helperText}>Age range, distance, and filters are in Profile.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Block nudity in chat</Text>
            <Switch value={blockNudity} onValueChange={setBlockNudity} />
          </View>
          <Button size="sm" variant="outline" onPress={() => router.push("/safety")}>
            Open Safety Center
          </Button>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Push notifications</Text>
            <Switch value={pushNotifs} onValueChange={setPushNotifs} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Email notifications</Text>
            <Switch value={emailNotifs} onValueChange={setEmailNotifs} />
          </View>
          <Text style={styles.helperText}>More notification settings coming soon.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chat & social</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Read receipts</Text>
            <Switch value={readReceipts} onValueChange={setReadReceipts} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Typing indicators</Text>
            <Switch value={typingIndicators} onValueChange={setTypingIndicators} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments & subscriptions</Text>
          <Text style={styles.helperText}>Billing and subscriptions coming soon.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal & support</Text>
          <Text style={styles.helperText}>Terms, privacy policy, and support resources.</Text>
        </View>

        {status ? <Text style={styles.status}>{status}</Text> : null}

        <View style={styles.actions}>
          <Button onPress={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </Button>
          <Button variant="outline" onPress={logout}>
            Log out
          </Button>
        </View>
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
    gap: 14,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  valueText: {
    fontSize: 12,
    color: "#64748b",
  },
  helperText: {
    fontSize: 12,
    color: "#64748b",
  },
  status: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
});
