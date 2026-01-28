"use client";

import { useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAuth } from "@/lib/auth-context";

const heroImage = require("../assets/brand/hero.jpg");
const logoImage = require("../assets/brand/logo.png");
const iconImage = require("../assets/brand/icon.png");

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
      <ScrollView contentContainerStyle={styles.scroll}>
        <ImageBackground source={heroImage} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroOverlaySoft} />
          <View style={styles.heroContent}>
            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <Image source={iconImage} style={styles.icon} resizeMode="contain" />
              </View>
              <View style={styles.headerActions}>
                <Pressable onPress={() => router.push("/auth/login")}>
                  <Text style={styles.headerLink}>Sign In</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/auth/register")}
                  style={styles.headerButton}
                >
                  <Text style={styles.headerButtonText}>Get Started</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.logoCard}>
              <View style={styles.logoInner}>
                <Image source={logoImage} style={styles.logo} resizeMode="contain" />
              </View>
            </View>

            <Text style={styles.title}>Plan Dates. Plan Vacations.</Text>
            <Text style={styles.subtitle}>
              The social platform for connecting people through shared experiences. Find travel
              buddies, dinner groups, or club companions safely and transparently.
            </Text>

            <View style={styles.heroActions}>
              <Pressable
                onPress={() => router.push("/auth/login")}
                style={styles.heroPrimary}
              >
                <Text style={styles.heroPrimaryText}>Sign In</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/auth/register")}
                style={styles.heroSecondary}
              >
                <Text style={styles.heroSecondaryText}>Join Now</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.featuresSection}>
          <View style={styles.featuresGrid}>
            {FEATURES.map((item) => (
              <View key={item.title} style={styles.featureCard}>
                <View style={styles.featureIcon} />
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureText}>{item.description}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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
    backgroundColor: "#0f172a",
  },
  scroll: {
    paddingBottom: 40,
  },
  hero: {
    paddingBottom: 40,
  },
  heroImage: {
    opacity: 0.8,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
  },
  heroOverlaySoft: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.2)",
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 32,
    height: 32,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerLink: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "600",
  },
  headerButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  headerButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  logoCard: {
    alignSelf: "center",
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  logoInner: {
    borderRadius: 20,
    overflow: "hidden",
  },
  logo: {
    width: 180,
    height: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    lineHeight: 22,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginTop: 6,
  },
  heroPrimary: {
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  heroPrimaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  heroSecondary: {
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  heroSecondaryText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  featuresSection: {
    marginTop: -30,
    paddingHorizontal: 20,
  },
  featuresGrid: {
    gap: 14,
  },
  featureCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.08)",
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  featureText: {
    marginTop: 6,
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
