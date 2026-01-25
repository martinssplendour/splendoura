"use client";

import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { API_BASE_URL } from "@/lib/api";

const GENDERS = ["female", "male", "other"] as const;

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<(typeof GENDERS)[number]>("other");
  const [blockNudity, setBlockNudity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          username: username || undefined,
          email,
          password,
          age: Number(age),
          gender,
          profile_details: {
            safety_settings: {
              block_nudity: blockNudity,
            },
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail || "Registration failed.");
      }

      setSuccess("Account created! Sign in, upload a photo, and request verification.");
      setPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to register right now.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Join Splendoura and start building experiences together.
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="your-handle"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                secureTextEntry
                autoComplete="password-new"
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                style={styles.input}
              />
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.fieldFlex}>
                <Text style={styles.label}>Age</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={age}
                  onChangeText={setAge}
                  placeholder="18+"
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldFlex}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.optionRow}>
                  {GENDERS.map((option) => (
                    <Text
                      key={option}
                      onPress={() => setGender(option)}
                      style={[
                        styles.option,
                        gender === option ? styles.optionActive : null,
                      ]}
                    >
                      {option}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Block nudity in chat</Text>
              <Switch value={blockNudity} onValueChange={setBlockNudity} />
            </View>

            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
            {success ? <Text style={styles.successBanner}>{success}</Text> : null}

            <Button onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </View>

          <Text style={styles.footer}>
            Already have an account?{" "}
            <Text style={styles.link} onPress={() => router.push("/auth/login")}>
              Sign in
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    padding: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  form: {
    gap: 14,
    marginTop: 8,
  },
  field: {
    gap: 6,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldFlex: {
    flex: 1,
    gap: 6,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#ffffff",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: "#475569",
    fontSize: 12,
  },
  optionActive: {
    backgroundColor: "#1e293b",
    color: "#ffffff",
    borderColor: "#1e293b",
  },
  errorBanner: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    padding: 10,
    borderRadius: 10,
    fontSize: 13,
  },
  successBanner: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#ecfdf3",
    color: "#15803d",
    padding: 10,
    borderRadius: 10,
    fontSize: 13,
  },
  footer: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
  },
  link: {
    color: "#2563eb",
    fontWeight: "600",
  },
});
