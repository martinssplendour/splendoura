"use client";

import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";

export default function LandingScreen() {
  const { user, accessToken, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (user || accessToken)) {
      router.replace("/groups");
    }
  }, [accessToken, isLoading, router, user]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (user || accessToken) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>
          Go Out. <Text style={styles.highlight}>Together.</Text>
        </Text>
        <Text style={styles.subtitle}>
          The social platform for connecting people through shared experiences. Find travel buddies,
          dinner groups, or club companions safely and transparently.
        </Text>
        <View style={styles.actions}>
          <Button size="lg" onPress={() => router.push("/auth/login")}>
            Sign In
          </Button>
          <Button size="lg" variant="outline" onPress={() => router.push("/auth/register")}>
            Join Now
          </Button>
        </View>
        <View style={styles.featureGrid}>
          {FEATURES.map((item) => (
            <View key={item.title} style={styles.featureCard}>
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureText}>{item.description}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const FEATURES = [
  {
    title: "Create",
    description: "Set your own rules, costs, and requirements.",
  },
  {
    title: "Verify",
    description: "Browse verified profiles and safe communities.",
  },
  {
    title: "Connect",
    description: "Meet in person and share the experience.",
  },
];

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 24,
    gap: 20,
  },
  title: {
    fontSize: 38,
    fontWeight: "800",
    color: "#0f172a",
  },
  highlight: {
    color: "#2563eb",
  },
  subtitle: {
    fontSize: 16,
    color: "#475569",
    lineHeight: 22,
  },
  actions: {
    gap: 12,
  },
  featureGrid: {
    gap: 12,
    marginTop: 10,
  },
  featureCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  featureText: {
    fontSize: 14,
    color: "#64748b",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
