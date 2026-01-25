"use client";

import { useMemo } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";

export default function ChatCallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; mode?: string; url?: string }>();
  const mode = params.mode === "voice" ? "voice" : "video";

  const callUrl = useMemo(() => {
    if (params.url) {
      try {
        return decodeURIComponent(String(params.url));
      } catch {
        return String(params.url);
      }
    }
    const room = `splendoura-group-${params.id}`;
    return `https://meet.jit.si/${room}?config.startWithVideoMuted=${
      mode === "voice" ? "true" : "false"
    }&config.startAudioOnly=${mode === "voice" ? "true" : "false"}`;
  }, [mode, params.id, params.url]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{mode === "voice" ? "Voice call" : "Video call"}</Text>
        <Button size="sm" variant="outline" onPress={() => router.back()}>
          End call
        </Button>
      </View>
      <WebView source={{ uri: callUrl }} style={styles.webview} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#0f172a",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
  },
  webview: {
    flex: 1,
  },
});
