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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  const isImageAsset = (asset: UploadAsset) => {
    if (asset.mimeType) return asset.mimeType.startsWith("image/");
    const hint = (asset.name || asset.uri || "").toLowerCase();
    return /\.(jpe?g|png|webp|heic|heif)$/.test(hint);
  };

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
    setFieldErrors({});
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
    const trimmedActivityType = activityType.trim();
    const trimmedLocation = location.trim();
    const normalizedOfferings = offerings
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const errors: Record<string, string> = {};
    if (trimmedTitle.length < MIN_TITLE_LENGTH) {
      errors.title = `Title must be at least ${MIN_TITLE_LENGTH} characters.`;
    }
    if (trimmedDescription.length < MIN_DESCRIPTION_LENGTH) {
      errors.description = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`;
    }
    if (!trimmedActivityType) {
      errors.activityType = "Activity type is required.";
    }
    if (!trimmedLocation) {
      errors.location = "Location is required.";
    }
    const minP = Number(minParticipants);
    const maxP = Number(maxParticipants);
    if (!Number.isFinite(minP) || minP < 1) {
      errors.minParticipants = "Min participants must be at least 1.";
    }
    if (!Number.isFinite(maxP) || maxP < 1) {
      errors.maxParticipants = "Max participants must be at least 1.";
    } else if (Number.isFinite(minP) && maxP < minP) {
      errors.maxParticipants = "Max participants must be >= min participants.";
    }
    if (normalizedOfferings.length < MIN_OFFERINGS) {
      errors.offerings = "List at least two offerings (comma separated).";
    }
    const minAgeNum = Number(minAge);
    const maxAgeNum = Number(maxAge);
    if (!Number.isFinite(minAgeNum) || minAgeNum < 18) {
      errors.minAge = "Min age must be at least 18.";
    }
    if (!Number.isFinite(maxAgeNum) || maxAgeNum < 18) {
      errors.maxAge = "Max age must be at least 18.";
    } else if (Number.isFinite(minAgeNum) && maxAgeNum < minAgeNum) {
      errors.maxAge = "Max age must be >= min age.";
    }
    const coverIndex = selectedMedia.findIndex(isImageAsset);
    if (coverIndex < 0) {
      errors.media = "Add at least one photo (cover image required).";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatus("Please fix the highlighted fields and try again.");
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
        activity_type: trimmedActivityType,
        category,
        location: trimmedLocation,
        cost_type: costType,
        min_participants: minP,
        max_participants: maxP,
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

      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));
      const cover = selectedMedia[coverIndex];
      formData.append("cover", buildFormFile(cover) as unknown as Blob);

      const res = await apiFetch("/groups/", {
        method: "POST",
        token: accessToken,
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Unable to publish group.");
      }
      const createdGroup = await res.json();
      let uploadFailures = 0;
      const remainingMedia = selectedMedia.filter((_, idx) => idx !== coverIndex);
      if (remainingMedia.length > 0) {
        for (const media of remainingMedia) {
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
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={[styles.input, fieldErrors.title ? styles.inputError : null]}
            />
            {fieldErrors.title ? <Text style={styles.errorText}>{fieldErrors.title}</Text> : null}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.multiline, fieldErrors.description ? styles.inputError : null]}
              multiline
            />
            {fieldErrors.description ? (
              <Text style={styles.errorText}>{fieldErrors.description}</Text>
            ) : null}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Activity type</Text>
            <TextInput
              value={activityType}
              onChangeText={setActivityType}
              style={[styles.input, fieldErrors.activityType ? styles.inputError : null]}
            />
            {fieldErrors.activityType ? (
              <Text style={styles.errorText}>{fieldErrors.activityType}</Text>
            ) : null}
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
            <TextInput
              value={location}
              onChangeText={setLocation}
              style={[styles.input, fieldErrors.location ? styles.inputError : null]}
            />
            {fieldErrors.location ? (
              <Text style={styles.errorText}>{fieldErrors.location}</Text>
            ) : null}
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
                style={[styles.input, fieldErrors.minParticipants ? styles.inputError : null]}
              />
              {fieldErrors.minParticipants ? (
                <Text style={styles.errorText}>{fieldErrors.minParticipants}</Text>
              ) : null}
            </View>
            <View style={styles.fieldFlex}>
              <Text style={styles.label}>Max participants</Text>
              <TextInput
                keyboardType="number-pad"
                value={maxParticipants}
                onChangeText={setMaxParticipants}
                style={[styles.input, fieldErrors.maxParticipants ? styles.inputError : null]}
              />
              {fieldErrors.maxParticipants ? (
                <Text style={styles.errorText}>{fieldErrors.maxParticipants}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Offerings (comma separated, 2+)</Text>
            <TextInput
              value={offerings}
              onChangeText={setOfferings}
              style={[styles.input, fieldErrors.offerings ? styles.inputError : null]}
            />
            {fieldErrors.offerings ? (
              <Text style={styles.errorText}>{fieldErrors.offerings}</Text>
            ) : null}
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
            <Text style={styles.label}>Group cover photo (required) and media</Text>
            <Text style={styles.helper}>
              {selectedMedia.length > 0
                ? `${selectedMedia.length} file(s) selected`
                : "Add at least one photo (used as the cover). Videos are optional."}
            </Text>
            {fieldErrors.media ? <Text style={styles.errorText}>{fieldErrors.media}</Text> : null}
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
                  style={[styles.input, fieldErrors.minAge ? styles.inputError : null]}
                />
                {fieldErrors.minAge ? <Text style={styles.errorText}>{fieldErrors.minAge}</Text> : null}
              </View>
              <View style={styles.fieldFlex}>
                <Text style={styles.label}>Max age</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={maxAge}
                  onChangeText={setMaxAge}
                  style={[styles.input, fieldErrors.maxAge ? styles.inputError : null]}
                />
                {fieldErrors.maxAge ? <Text style={styles.errorText}>{fieldErrors.maxAge}</Text> : null}
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
  inputError: {
    borderColor: "#f43f5e",
  },
  errorText: {
    fontSize: 12,
    color: "#f43f5e",
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
