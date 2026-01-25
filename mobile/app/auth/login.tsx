"use client";

import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { API_BASE_URL } from "@/lib/api";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const body = new URLSearchParams();
      body.set("username", email);
      body.set("password", password);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const detail = (data?.detail || "Login failed.") as string;
        const lower = detail.toLowerCase();
        const mappedErrors: { email?: string; password?: string } = {};

        if (lower.includes("email")) {
          mappedErrors.email = detail;
        }
        if (lower.includes("password")) {
          mappedErrors.password = detail;
        }

        if (Object.keys(mappedErrors).length > 0) {
          setFieldErrors(mappedErrors);
        } else {
          setError(detail);
        }
        setIsSubmitting(false);
        return;
      }

      const tokenData: { access_token: string; refresh_token: string } = await response.json();
      const userResponse = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userResponse.ok) {
        throw new Error("Login succeeded, but user profile could not be loaded.");
      }

      const user = await userResponse.json();
      const skipped = await AsyncStorage.getItem("onboarding_skipped");
      const needsOnboarding =
        !user?.profile_image_url ||
        !user?.bio ||
        !(user?.interests && user.interests.length > 0) ||
        !(user?.profile_media?.prompts && user.profile_media.prompts.length > 0);
      const redirectTo =
        needsOnboarding && !skipped
          ? "/onboarding"
          : user?.verification_status === "verified"
            ? "/groups"
            : "/profile";
      await login(
        { access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, user },
        redirectTo
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in right now.";
      setError(message);
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue discovering groups.</Text>

          <View style={styles.form}>
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
              {fieldErrors.email ? <Text style={styles.errorText}>{fieldErrors.email}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                secureTextEntry
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                placeholder="password"
                style={styles.input}
              />
              {fieldErrors.password ? (
                <Text style={styles.errorText}>{fieldErrors.password}</Text>
              ) : null}
            </View>

            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <Button onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </View>

          <Text style={styles.footer}>
            New to Splendoura?{" "}
            <Text style={styles.link} onPress={() => router.push("/auth/register")}>
              Create an account
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
  errorText: {
    color: "#dc2626",
    fontSize: 12,
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
