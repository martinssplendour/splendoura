"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { buildFormFile, type UploadAsset } from "@/lib/uploads";

const promptDefaults = ["", "", ""];

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function OnboardingScreen() {
  const router = useRouter();
  const { accessToken, user, refreshSession, isLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [bio, setBio] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [interests, setInterests] = useState("");
  const [prompts, setPrompts] = useState<string[]>([...promptDefaults]);
  const [photo, setPhoto] = useState<UploadAsset | null>(null);
  const [blockNudity, setBlockNudity] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setBio(user.bio || "");
    setLocationCity(user.location_city || "");
    setLocationCountry(user.location_country || "");
    setInterests((user.interests || []).join(", "));
    const existingPrompts = (user.profile_media?.prompts || []).slice(0, 3);
    while (existingPrompts.length < 3) existingPrompts.push("");
    setPrompts(existingPrompts);
    const safetySettings =
      ((user.profile_details as Record<string, unknown> | null)?.safety_settings as
        | Record<string, unknown>
        | undefined) || {};
    setBlockNudity(Boolean(safetySettings.block_nudity));
  }, [user]);

  const completedCount = useMemo(() => {
    let count = 0;
    if (bio.trim()) count += 1;
    if (locationCity.trim()) count += 1;
    if (parseList(interests).length > 0) count += 1;
    if (prompts.some((prompt) => prompt.trim())) count += 1;
    if (user?.profile_image_url || photo) count += 1;
    return count;
  }, [bio, interests, locationCity, photo, prompts, user?.profile_image_url]);

  const progress = Math.round((completedCount / 5) * 100);

  const handleSkip = useCallback(async () => {
    await AsyncStorage.setItem("onboarding_skipped", "1");
    router.replace("/groups");
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!accessToken) return false;
    setSaving(true);
    setStatus(null);
    try {
      const profileMedia = {
        ...(user?.profile_media || {}),
        prompts: prompts.filter((prompt) => prompt.trim()),
      };
      const profileDetails = {
        ...(user?.profile_details || {}),
        safety_settings: {
          block_nudity: blockNudity,
        },
      };
      const payload = {
        bio: bio.trim() || undefined,
        location_city: locationCity.trim() || undefined,
        location_country: locationCountry.trim() || undefined,
        interests: parseList(interests),
        profile_media: profileMedia,
        profile_details: profileDetails,
      };
      const res = await apiFetch("/users/me", {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Unable to save profile.");
      }
      await refreshSession();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save profile.";
      setStatus(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [accessToken, bio, interests, locationCity, locationCountry, prompts, refreshSession, user?.profile_media]);

  const handlePickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhoto({
      uri: asset.uri,
      name: asset.fileName,
      mimeType: asset.mimeType,
    });
  }, []);

  const handleUploadPhoto = useCallback(async () => {
    if (!accessToken || !photo) return;
    setUploading(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", buildFormFile(photo) as unknown as Blob);
      const res = await apiFetch("/users/me/photo", {
        method: "POST",
        token: accessToken,
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Photo upload failed.");
      }
      setPhoto(null);
      await refreshSession();
      setStatus("Photo uploaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Photo upload failed.";
      setStatus(message);
    } finally {
      setUploading(false);
    }
  }, [accessToken, photo, refreshSession]);

  const handleNext = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;
    if (step >= 3) {
      await AsyncStorage.removeItem("onboarding_skipped");
      router.replace("/groups");
      return;
    }
    setStep((prev) => prev + 1);
  }, [handleSave, router, step]);

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
          <Text style={styles.status}>Sign in to continue onboarding.</Text>
          <Button onPress={() => router.replace("/auth/login")}>Sign in</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Finish setting up Splendoure</Text>
            <Text style={styles.subtitle}>Step {step + 1} of 4 · {progress}% complete</Text>
          </View>
          <Pressable onPress={handleSkip}>
            <Text style={styles.skip}>Skip for now</Text>
          </Pressable>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        {step === 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tell us about you</Text>
            <Text style={styles.helper}>This helps match you with the right plans.</Text>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Share a quick intro"
              style={[styles.input, styles.multiline]}
              multiline
            />
            <View style={styles.row}>
              <View style={styles.fieldFlex}>
                <Text style={styles.label}>City</Text>
                <TextInput value={locationCity} onChangeText={setLocationCity} style={styles.input} />
              </View>
              <View style={styles.fieldFlex}>
                <Text style={styles.label}>Country</Text>
                <TextInput
                  value={locationCountry}
                  onChangeText={setLocationCountry}
                  style={styles.input}
                />
              </View>
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Block nudity in chat</Text>
              <Switch value={blockNudity} onValueChange={setBlockNudity} />
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <Text style={styles.helper}>Comma separated works great.</Text>
            <TextInput
              value={interests}
              onChangeText={setInterests}
              placeholder="Travel, brunch, nightlife"
              style={styles.input}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Prompts</Text>
            <Text style={styles.helper}>Answer a few prompts to help people connect.</Text>
            {prompts.map((prompt, index) => (
              <View key={`prompt-${index}`} style={styles.field}>
                <Text style={styles.label}>Prompt {index + 1}</Text>
                <TextInput
                  value={prompt}
                  onChangeText={(value) =>
                    setPrompts((prev) => prev.map((item, i) => (i === index ? value : item)))
                  }
                  style={styles.input}
                  placeholder="Add a fun prompt"
                />
              </View>
            ))}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add a photo</Text>
            <Text style={styles.helper}>Profiles with photos get more requests.</Text>
            {user?.profile_image_url ? (
              <Image
                source={{ uri: resolveMediaUrl(user.profile_image_url) }}
                style={styles.photo}
              />
            ) : null}
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photo} />
            ) : null}
            <View style={styles.row}>
              <Button variant="outline" onPress={handlePickPhoto}>
                Choose photo
              </Button>
              <Button onPress={handleUploadPhoto} disabled={!photo || uploading}>
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </View>
          </View>
        ) : null}

        {status ? <Text style={styles.status}>{status}</Text> : null}

        <View style={styles.footerRow}>
          <Button variant="outline" onPress={handleSkip}>
            Skip for now
          </Button>
          <Button onPress={handleNext} disabled={saving}>
            {step >= 3 ? (saving ? "Saving..." : "Finish") : saving ? "Saving..." : "Next"}
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
    padding: 20,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  skip: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "600",
  },
  progressTrack: {
    width: "100%",
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563eb",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  helper: {
    fontSize: 12,
    color: "#64748b",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
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
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  field: {
    gap: 6,
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
  photo: {
    width: "100%",
    height: 220,
    borderRadius: 16,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  status: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
});
