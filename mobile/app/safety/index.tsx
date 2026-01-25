"use client";

import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";

export default function SafetyCenterScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Safety Center</Text>
          <Text style={styles.subtitle}>
            Simple steps to help you stay safe while meeting new people.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Before you meet</Text>
          <Text style={styles.bodyText}>• Meet in public places and share your plan.</Text>
          <Text style={styles.bodyText}>• Use in-app chat until you feel comfortable.</Text>
          <Text style={styles.bodyText}>• Verify profiles and trust your instincts.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>During the date</Text>
          <Text style={styles.bodyText}>• Keep control of your transport.</Text>
          <Text style={styles.bodyText}>• Don’t leave drinks unattended.</Text>
          <Text style={styles.bodyText}>• Leave if anything feels off.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Emergency help</Text>
          <Text style={styles.bodyText}>
            If you’re in immediate danger, call your local emergency number.
          </Text>
          <Button
            variant="outline"
            onPress={() => {
              Linking.openURL("tel:911");
            }}
          >
            Call emergency services
          </Button>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Need support?</Text>
          <Text style={styles.bodyText}>Contact our safety team for help or reports.</Text>
          <Button
            variant="outline"
            onPress={() => {
              Linking.openURL("mailto:safety@splendoura.com");
            }}
          >
            Email safety@splendoura.com
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
    gap: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  bodyText: {
    fontSize: 13,
    color: "#475569",
  },
});
