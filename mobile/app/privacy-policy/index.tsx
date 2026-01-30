"use client";

import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.meta}>Effective date: January 30, 2026</Text>
        <Text style={styles.meta}>Privacy policy URL: https://splendoure.com/privacy-policy</Text>

        <Text style={styles.paragraph}>
          This Privacy Policy explains how Splendoure collects, uses, and shares information when
          you use our website and mobile app. We keep this policy clear and simple so you can
          understand how your data is handled.
        </Text>

        <Text style={styles.sectionTitle}>Who we are</Text>
        <Text style={styles.paragraph}>
          Splendoure is operated by the developer. If you have questions about this policy or your
          data, contact us at support@splendoure.com.
        </Text>

        <Text style={styles.sectionTitle}>Information we collect</Text>
        <Text style={styles.paragraph}>
          • Account details: name, username, email, password (stored in encrypted form), and
          account settings.
        </Text>
        <Text style={styles.paragraph}>
          • Profile details: photos, bio, preferences, and other information you choose to add. We
          don’t require sensitive information; if you add it, you choose to share it.
        </Text>
        <Text style={styles.paragraph}>
          • Group and chat content: group posts, messages, and files you share.
        </Text>
        <Text style={styles.paragraph}>
          • Location (optional): if you allow it, we use your location to show nearby groups and
          profiles.
        </Text>
        <Text style={styles.paragraph}>
          • Device and usage data: basic device info and how you use the app (for example, pages
          visited and actions taken).
        </Text>

        <Text style={styles.sectionTitle}>How we use information</Text>
        <Text style={styles.paragraph}>• Provide and improve the Splendoure experience.</Text>
        <Text style={styles.paragraph}>
          • Match you with groups or profiles based on your preferences.
        </Text>
        <Text style={styles.paragraph}>• Enable chat, group features, and notifications.</Text>
        <Text style={styles.paragraph}>
          • Protect the community, prevent abuse, and enforce our terms.
        </Text>

        <Text style={styles.sectionTitle}>How we share information</Text>
        <Text style={styles.paragraph}>
          • With other users: your profile and content are visible to others based on how you use
          the app.
        </Text>
        <Text style={styles.paragraph}>
          • With service providers: trusted partners who help us run the app (hosting, analytics,
          email).
        </Text>
        <Text style={styles.paragraph}>
          • For legal reasons: if required by law or to protect users and the platform.
        </Text>

        <Text style={styles.sectionTitle}>Ads</Text>
        <Text style={styles.paragraph}>
          Splendoure does not show ads at this time. If we add ads in the future, we will update
          this policy and any required disclosures.
        </Text>

        <Text style={styles.sectionTitle}>App access</Text>
        <Text style={styles.paragraph}>
          Some features require signing in. If reviewers need access to a restricted area, we will
          provide instructions in the Play Console App access section.
        </Text>

        <Text style={styles.sectionTitle}>Permissions we use</Text>
        <Text style={styles.paragraph}>• Photos/media: to upload profile and group images.</Text>
        <Text style={styles.paragraph}>• Camera: to capture photos or videos you choose to share.</Text>
        <Text style={styles.paragraph}>• Microphone: for voice notes or calls where available.</Text>
        <Text style={styles.paragraph}>• Location (optional): to show nearby groups and profiles.</Text>

        <Text style={styles.sectionTitle}>Your rights</Text>
        <Text style={styles.paragraph}>
          Depending on where you live, you may have the right to access, correct, delete, or
          restrict the use of your data. You can request these by emailing support@splendoure.com.
        </Text>

        <Text style={styles.sectionTitle}>Your choices</Text>
        <Text style={styles.paragraph}>• Update or delete your profile information in settings.</Text>
        <Text style={styles.paragraph}>• Control location access in your device settings.</Text>
        <Text style={styles.paragraph}>• Manage notifications in the app settings.</Text>
        <Text style={styles.paragraph}>• Delete your account in settings or contact support@splendoure.com.</Text>

        <Text style={styles.sectionTitle}>Data retention</Text>
        <Text style={styles.paragraph}>
          We keep your information only as long as needed to provide the service, keep the
          community safe, or comply with legal requirements. You can request deletion at any time.
        </Text>

        <Text style={styles.sectionTitle}>Security</Text>
        <Text style={styles.paragraph}>
          We use reasonable security measures to protect your information, but no system is
          completely secure.
        </Text>
        <Text style={styles.paragraph}>
          We use HTTPS/TLS to protect data in transit. Data is stored by our hosting and storage
          providers with encryption at rest. Photos are stored in private storage and accessed
          using time‑limited signed URLs.
        </Text>

        <Text style={styles.sectionTitle}>Children’s privacy</Text>
        <Text style={styles.paragraph}>
          Splendoure is intended for adults. We do not knowingly collect data from anyone under 18.
        </Text>

        <Text style={styles.sectionTitle}>Changes to this policy</Text>
        <Text style={styles.paragraph}>
          We may update this policy from time to time. If we make material changes, we will post the
          update here.
        </Text>

        <Text style={styles.sectionTitle}>Contact us</Text>
        <Text style={styles.paragraph}>support@splendoure.com</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a",
  },
  meta: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 12,
  },
  sectionTitle: {
    marginTop: 18,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  paragraph: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
  },
});
