"use client";

import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { buildFormFile, type UploadAsset } from "@/lib/uploads";

const CATEGORIES = ["mutual_benefits", "friendship", "dating"] as const;
const COST_TYPES = ["free", "shared", "fully_paid", "custom"] as const;
const APPLIES_TO = ["all", "female", "male", "other"] as const;
const MIN_TITLE_LENGTH = 5;
const MIN_DESCRIPTION_LENGTH = 20;
const MIN_OFFERINGS = 2;

export default function CreateGroupScreen() {
  const router = useRouter();
  const { accessToken, user, isLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("friendship");
  const [location, setLocation] = useState("");
  const [costType, setCostType] = useState<(typeof COST_TYPES)[number]>("free");
  const [minParticipants, setMinParticipants] = useState("1");
  const [maxParticipants, setMaxParticipants] = useState("4");
  const [offerings, setOfferings] = useState("");
  const [expectations, setExpectations] = useState("");
  const [tags, setTags] = useState("");
  const [creatorIntro, setCreatorIntro] = useState("");
  const [creatorIntroVideoUrl, setCreatorIntroVideoUrl] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<UploadAsset[]>([]);
  const [pendingMedia, setPendingMedia] = useState<UploadAsset | null>(null);
  const [appliesTo, setAppliesTo] = useState<(typeof APPLIES_TO)[number]>("all");
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("99");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickMedia = async () => {
    setStatus(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPendingMedia({
      uri: asset.uri,
      name: asset.fileName,
      mimeType: asset.mimeType,
    });
  };

  const handleConfirmMedia = () => {
    if (!pendingMedia) return;
    setSelectedMedia((prev) => [...prev, pendingMedia]);
    setPendingMedia(null);
  };

  const handleRemoveSelectedMedia = (index: number) => {
    setSelectedMedia((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    setStatus(null);
    if (!accessToken) {
      setStatus("Please sign in before publishing a group.");
      return;
    }
    if (!user?.profile_image_url) {
      setStatus("Upload a profile photo before publishing a group.");
      return;
    }
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const normalizedOfferings = offerings
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (trimmedTitle.length < MIN_TITLE_LENGTH) {
      setStatus(`Title must be at least ${MIN_TITLE_LENGTH} characters.`);
      return;
    }
    if (trimmedDescription.length < MIN_DESCRIPTION_LENGTH) {
      setStatus(`Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`);
      return;
    }
    if (normalizedOfferings.length < MIN_OFFERINGS) {
      setStatus("List at least two offerings (comma separated).");
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedTags = tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const payload = {
        title: trimmedTitle,
        description: trimmedDescription,
        activity_type: activityType.trim(),
        category,
        location: location.trim(),
        cost_type: costType,
        min_participants: Number(minParticipants),
        max_participants: Number(maxParticipants),
        offerings: normalizedOfferings,
        expectations: expectations || undefined,
        tags: normalizedTags.length > 0 ? normalizedTags : undefined,
        creator_intro: creatorIntro || undefined,
        creator_intro_video_url: creatorIntroVideoUrl || undefined,
        requirements: [
          {
            applies_to: appliesTo,
            min_age: Number(minAge),
            max_age: Number(maxAge),
            consent_flags: {},
          },
        ],
      };

      const res = await apiFetch("/groups", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Unable to publish group.");
      }
      const createdGroup = await res.json();
      let uploadFailures = 0;
      if (selectedMedia.length > 0) {
        for (const media of selectedMedia) {
          const formData = new FormData();
          formData.append("file", buildFormFile(media) as unknown as Blob);
          const uploadRes = await apiFetch(`/groups/${createdGroup.id}/media`, {
            method: "POST",
            token: accessToken,
            body: formData,
          });
          if (!uploadRes.ok) {
            uploadFailures += 1;
          }
        }
      }
      if (uploadFailures > 0) {
        setStatus(`Group created, but ${uploadFailures} media upload(s) failed.`);
      } else {
        setStatus("Group published successfully.");
      }
      router.replace("/groups");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to publish group.";
      setStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.status}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!accessToken) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.status}>Sign in to create a group.</Text>
          <Button onPress={() => router.push("/auth/login")}>Go to sign in</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Publish a group in minutes</Text>
        <Text style={styles.subtitle}>
          Share the basics, set requirements, and go live with a swipe-ready card.
        </Text>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.multiline]}
              multiline
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Activity type</Text>
            <TextInput value={activityType} onChangeText={setActivityType} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.optionRow}>
              {CATEGORIES.map((option) => (
                <Text
                  key={option}
                  onPress={() => setCategory(option)}
                  style={[styles.option, category === option ? styles.optionActive : null]}
                >
                  {option.replace("_", " ")}
                </Text>
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <TextInput value={location} onChangeText={setLocation} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Cost type</Text>
            <View style={styles.optionRow}>
              {COST_TYPES.map((option) => (
                <Text
                  key={option}
                  onPress={() => setCostType(option)}
                  style={[styles.option, costType === option ? styles.optionActive : null]}
                >
                  {option.replace("_", " ")}
                </Text>
              ))}
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.fieldFlex}>
              <Text style={styles.label}>Min participants</Text>
              <TextInput
                keyboardType="number-pad"
                value={minParticipants}
                onChangeText={setMinParticipants}
                style={styles.input}
              />
            </View>
            <View style={styles.fieldFlex}>
              <Text style={styles.label}>Max participants</Text>
              <TextInput
                keyboardType="number-pad"
                value={maxParticipants}
                onChangeText={setMaxParticipants}
                style={styles.input}
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Offerings (comma separated, 2+)</Text>
            <TextInput value={offerings} onChangeText={setOfferings} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Expectations</Text>
            <TextInput value={expectations} onChangeText={setExpectations} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Tags</Text>
            <TextInput value={tags} onChangeText={setTags} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Creator intro</Text>
            <TextInput value={creatorIntro} onChangeText={setCreatorIntro} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Intro video URL</Text>
            <TextInput
              value={creatorIntroVideoUrl}
              onChangeText={setCreatorIntroVideoUrl}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Group media (images or videos)</Text>
            <Text style={styles.helper}>
              {selectedMedia.length > 0
                ? `${selectedMedia.length} file(s) selected`
                : "Add photos or short clips to showcase the group."}
            </Text>
            <View style={styles.mediaActions}>
              <Button variant="outline" size="sm" onPress={handlePickMedia}>
                Pick media
              </Button>
              {selectedMedia.length > 0 ? (
                <Button variant="ghost" size="sm" onPress={() => setSelectedMedia([])}>
                  Clear
                </Button>
              ) : null}
            </View>
            {selectedMedia.length > 0 ? (
              <View style={styles.selectedMediaList}>
                {selectedMedia.map((media, index) => (
                  <View key={`${media.uri}-${index}`} style={styles.selectedMediaItem}>
                    {media.mimeType?.startsWith("image/") ? (
                      <Image source={{ uri: media.uri }} style={styles.selectedMediaThumb} />
                    ) : (
                      <View style={styles.selectedMediaThumb}>
                        <Text style={styles.pendingMediaText}>Video</Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => handleRemoveSelectedMedia(index)}
                      style={styles.selectedMediaRemove}
                    >
                      <Text style={styles.selectedMediaRemoveText}>x</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {pendingMedia ? (
              <View style={styles.pendingMediaCard}>
                {pendingMedia.mimeType?.startsWith("image/") ? (
                  <Image source={{ uri: pendingMedia.uri }} style={styles.pendingMediaImage} />
                ) : (
                  <View style={styles.pendingMediaPlaceholder}>
                    <Text style={styles.pendingMediaText}>Video selected</Text>
                  </View>
                )}
                <View style={styles.mediaActions}>
                  <Button size="sm" variant="outline" onPress={() => setPendingMedia(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onPress={handleConfirmMedia}>
                    Add media
                  </Button>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Requirements</Text>
            <View style={styles.optionRow}>
              {APPLIES_TO.map((option) => (
                <Text
                  key={option}
                  onPress={() => setAppliesTo(option)}
                  style={[styles.option, appliesTo === option ? styles.optionActive : null]}
                >
                  {option}
                </Text>
              ))}
            </View>
            <View style={styles.row}>
              <View style={styles.fieldFlex}>
                <Text style={styles.label}>Min age</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={minAge}
                  onChangeText={setMinAge}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldFlex}>
                <Text style={styles.label}>Max age</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={maxAge}
                  onChangeText={setMaxAge}
                  style={styles.input}
                />
              </View>
            </View>
          </View>

          {status ? <Text style={styles.status}>{status}</Text> : null}

          <Button onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Publishing..." : "Publish group"}
          </Button>
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
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  helper: {
    fontSize: 11,
    color: "#94a3b8",
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
    minHeight: 90,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  fieldFlex: {
    flex: 1,
    gap: 6,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  mediaActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectedMediaList: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  selectedMediaItem: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 8,
    gap: 6,
  },
  selectedMediaThumb: {
    width: "100%",
    height: 90,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedMediaRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedMediaRemoveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 16,
  },
  pendingMediaCard: {
    marginTop: 10,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    backgroundColor: "#ffffff",
  },
  pendingMediaImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
  },
  pendingMediaPlaceholder: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingMediaText: {
    fontSize: 12,
    color: "#64748b",
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
  status: {
    fontSize: 13,
    color: "#64748b",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
});
