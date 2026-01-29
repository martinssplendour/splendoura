"use client";

import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";

const SECTIONS: {
  title: string;
  body: string;
  bullets?: string[];
}[] = [
  {
    title: "Overview",
    body:
      "This Privacy Policy explains how Splendoure collects, uses, and shares information when you use our website, mobile app, and related services (the \"Services\").",
  },
  {
    title: "Information we collect",
    bullets: [
      "Account details: name, username, email, password (hashed), and verification status.",
      "Profile data you provide: bio, photos, videos, preferences, interests, and discovery settings.",
      "Verification data: profile verification photos and optional ID verification images.",
      "Messages and content: chats, voice notes, and media you send.",
      "Location data: precise location when you enable it, or approximate location based on IP.",
      "Usage and device data: log files, IP address, device identifiers, app version, and crash data.",
      "Cookies and similar technologies on the web for session and analytics purposes.",
    ],
    body:
      "Some information is required to provide the Services. You may choose to limit optional data, but certain features may not work without it.",
  },
  {
    title: "How we use your information",
    bullets: [
      "Provide and improve the Services, including matching and discovery.",
      "Enable profile creation, group participation, and messaging.",
      "Moderate content and support safety features.",
      "Communicate with you about updates, support requests, and security notices.",
      "Comply with legal obligations and enforce our terms.",
    ],
    body:
      "We process data based on your consent, the performance of a contract with you, our legitimate interests, and legal obligations.",
  },
  {
    title: "How we share information",
    bullets: [
      "With other users: your profile information and content you choose to share is visible to others based on your settings.",
      "With service providers: hosting, storage, analytics, communications, and customer support.",
      "With payment processors if you purchase services (if enabled).",
      "With law enforcement or regulators when required by law or to protect safety and rights.",
    ],
    body: "We do not sell your personal information. We only share what is necessary for the Services.",
  },
  {
    title: "Data retention",
    body:
      "We retain your information while your account is active and as needed to provide the Services. You can request deletion at any time. We may keep limited data to comply with legal obligations or resolve disputes.",
  },
  {
    title: "Your choices and rights",
    bullets: [
      "Access, update, or delete your profile information within the app.",
      "Control visibility and discovery settings in your profile and settings.",
      "Opt out of marketing communications where available.",
      "Request a copy of your data or deletion by contacting us.",
    ],
    body:
      "If you are in the EEA, UK, or other regions with data protection laws, you may have additional rights such as portability and objection to processing.",
  },
  {
    title: "Security",
    body:
      "We use administrative, technical, and physical safeguards to protect your data. No method of transmission or storage is 100% secure.",
  },
  {
    title: "International transfers",
    body:
      "Your information may be processed in countries other than where you live. We use safeguards to protect your data when transferred internationally.",
  },
  {
    title: "Children's privacy",
    body:
      "Splendoure is intended for adults. We do not knowingly collect information from anyone under 18.",
  },
  {
    title: "Changes to this policy",
    body:
      "We may update this policy from time to time. If we make material changes, we will notify you through the Services or by other means.",
  },
  {
    title: "Contact",
    body: "For questions or requests, contact us at privacy@splendoure.com.",
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.kicker}>Legal</Text>
          <Text style={styles.title}>Privacy Policy</Text>
          <Text style={styles.subtitle}>Last updated: January 29, 2026</Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
            {section.bullets ? (
              <View style={styles.list}>
                {section.bullets.map((item) => (
                  <Text key={item} style={styles.bullet}>
                    • {item}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>More resources</Text>
          <Text style={styles.body}>See the Safety Center or contact us for support.</Text>
          <Button variant="outline">Email privacy@splendoure.com</Button>
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
    gap: 12,
  },
  headerCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 4,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#94a3b8",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  body: {
    fontSize: 12,
    color: "#475569",
  },
  list: {
    gap: 6,
  },
  bullet: {
    fontSize: 12,
    color: "#475569",
  },
});
