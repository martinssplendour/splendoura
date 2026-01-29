"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { BottomNav, BOTTOM_NAV_HEIGHT } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { buildFormFile, type UploadAsset } from "@/lib/uploads";

const GENDER_OPTIONS = ["male", "female", "other", "other_custom"] as const;
const ORIENTATION_OPTIONS = [
  "straight",
  "gay",
  "lesbian",
  "bisexual",
  "asexual",
  "pansexual",
  "queer",
  "questioning",
];
const LOOKING_FOR_OPTIONS = ["relationship", "something casual", "long-term", "unsure"];
const EDUCATION_OPTIONS = ["high school", "college", "bachelors", "masters", "phd", "other"];
const WORKOUT_OPTIONS = ["never", "sometimes", "weekly", "daily"];
const YES_NO_OPTIONS = ["yes", "no", "open", "unsure"];
const RELATIONSHIP_STYLE_OPTIONS = ["monogamy", "non-monogamy", "open", "polyamory"];
const DIET_OPTIONS = ["vegan", "vegetarian", "pescatarian", "omnivore"];
const SLEEP_OPTIONS = ["early bird", "night owl", "flexible"];
const SOCIAL_OPTIONS = ["introvert", "ambivert", "extrovert"];
const POLITICAL_OPTIONS = ["liberal", "moderate", "conservative", "not political"];
const RELIGION_OPTIONS = ["christian", "muslim", "jewish", "hindu", "buddhist", "other", "none"];
const BODY_TYPE_OPTIONS = ["slim", "athletic", "average", "curvy", "plus-size"];
const HAIR_COLOR_OPTIONS = ["black", "brown", "blonde", "red", "gray", "other"];
const EYE_COLOR_OPTIONS = ["brown", "blue", "green", "hazel", "gray", "other"];
const INCOME_BRACKET_OPTIONS = ["<25k", "25-50k", "50-100k", "100k+"];
const TRAVEL_FREQUENCY_OPTIONS = ["rarely", "sometimes", "often"];
const COMMUNICATION_STYLE_OPTIONS = ["text", "call", "in-person", "mixed"];
const MAX_PROFILE_PHOTOS = 9;

interface CreatedGroup {
  id: number;
  title: string;
  description?: string | null;
  cost_type?: "free" | "shared" | "fully_paid" | "custom";
  max_participants?: number;
  approved_members?: number | null;
}

const formatOption = (value: string) => value.replace(/_/g, " ");

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const hasValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return !Number.isNaN(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return false;
};

const calculateAge = (dob: string) => {
  if (!dob) return undefined;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
};

const normalizePrompts = (value: string[]) => {
  const next = [...value];
  while (next.length < 3) next.push("");
  return next.slice(0, 3);
};

export default function ProfileScreen() {
  const { accessToken, user, refreshSession, logout, isLoading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<(typeof GENDER_OPTIONS)[number]>("other");
  const [sexualOrientation, setSexualOrientation] = useState("");
  const [showOrientation, setShowOrientation] = useState(true);
  const [lookingFor, setLookingFor] = useState("");
  const [dob, setDob] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");

  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [income, setIncome] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [incomeBracket, setIncomeBracket] = useState("");
  const [travelFrequency, setTravelFrequency] = useState("");
  const [communicationStyle, setCommunicationStyle] = useState("");
  const [loveLanguages, setLoveLanguages] = useState("");
  const [workoutHabits, setWorkoutHabits] = useState("");
  const [smoking, setSmoking] = useState("");
  const [drinking, setDrinking] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [school, setSchool] = useState("");

  const [religion, setReligion] = useState("");
  const [politicalViews, setPoliticalViews] = useState("");
  const [zodiacSign, setZodiacSign] = useState("");
  const [personalityType, setPersonalityType] = useState("");
  const [languages, setLanguages] = useState("");
  const [ethnicity, setEthnicity] = useState("");

  const [pets, setPets] = useState("");
  const [diet, setDiet] = useState("");
  const [sleepHabits, setSleepHabits] = useState("");
  const [socialEnergy, setSocialEnergy] = useState("");

  const [hasChildren, setHasChildren] = useState("");
  const [wantsChildren, setWantsChildren] = useState("");

  const [relationshipPreference, setRelationshipPreference] = useState("");
  const [casualDating, setCasualDating] = useState("");
  const [kinkFriendly, setKinkFriendly] = useState("");

  const [prefAgeMin, setPrefAgeMin] = useState("");
  const [prefAgeMax, setPrefAgeMax] = useState("");
  const [prefDistance, setPrefDistance] = useState("");
  const [prefGenders, setPrefGenders] = useState("");
  const [globalMode, setGlobalMode] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [incognitoMode, setIncognitoMode] = useState(false);

  const [interests, setInterests] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoLoops, setVideoLoops] = useState("");
  const [anthem, setAnthem] = useState("");
  const [prompts, setPrompts] = useState<string[]>(["", "", ""]);
  const [availabilityWindows, setAvailabilityWindows] = useState("");
  const [blockNudity, setBlockNudity] = useState(false);
  const [trustedContacts, setTrustedContacts] = useState<
    { name: string; contact: string }[]
  >([]);
  const [trustedName, setTrustedName] = useState("");
  const [trustedContact, setTrustedContact] = useState("");
  const [idVerificationStatus, setIdVerificationStatus] = useState<string | null>(null);
  const [idVerified, setIdVerified] = useState(false);

  const [photos, setPhotos] = useState<string[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<UploadAsset[]>([]);
  const [photoVerified, setPhotoVerified] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<{
    type: "photo" | "id";
    asset: UploadAsset;
  } | null>(null);
  const [createdGroups, setCreatedGroups] = useState<CreatedGroup[]>([]);
  const [createdLoading, setCreatedLoading] = useState(false);
  const [createdError, setCreatedError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  useEffect(() => {
    const details = (user?.profile_details as Record<string, unknown>) || {};
    const discovery = (user?.discovery_settings as Record<string, unknown>) || {};
    const media = (user?.profile_media as Record<string, unknown>) || {};

    setUsername(user?.username || "");
    setBio(user?.bio || "");
    setGender((user?.gender as (typeof GENDER_OPTIONS)[number]) || "other");
    setSexualOrientation(user?.sexual_orientation || "");
    setShowOrientation((details.show_orientation as boolean) ?? true);
    setLookingFor((details.looking_for as string) || "");
    setDob((details.dob as string) || "");
    setLocationCity(user?.location_city || "");
    setLocationCountry(user?.location_country || "");
    setLocationLat(
      user?.location_lat != null ? String(user.location_lat) : ""
    );
    setLocationLng(
      user?.location_lng != null ? String(user.location_lng) : ""
    );

    setHeightCm(String(details.height_cm ?? ""));
    setWeightKg(String(details.weight_kg ?? ""));
    setIncome(details.income != null ? String(details.income) : "");
    setBodyType((details.body_type as string) || "");
    setHairColor((details.hair_color as string) || "");
    setEyeColor((details.eye_color as string) || "");
    setIncomeBracket((details.income_bracket as string) || "");
    setWorkoutHabits((details.workout_habits as string) || "");
    setSmoking((details.smoking as string) || "");
    setDrinking((details.drinking as string) || "");
    setEducationLevel((details.education_level as string) || "");
    setJobTitle((details.job_title as string) || "");
    setCompany((details.company as string) || "");
    setSchool((details.school as string) || "");

    setReligion((details.religion as string) || "");
    setPoliticalViews((details.political_views as string) || "");
    setZodiacSign((details.zodiac_sign as string) || "");
    setPersonalityType((details.personality_type as string) || "");
    setLanguages(((details.languages as string[]) || []).join(", "));
    setEthnicity((details.ethnicity as string) || "");

    setPets(((details.pets as string[]) || []).join(", "));
    setDiet((details.diet as string) || "");
    setSleepHabits((details.sleep_habits as string) || "");
    setSocialEnergy((details.social_energy as string) || "");
    setTravelFrequency((details.travel_frequency as string) || "");
    setCommunicationStyle((details.communication_style as string) || "");
    setLoveLanguages(((details.love_languages as string[]) || []).join(", "));

    setHasChildren((details.has_children as string) || "");
    setWantsChildren((details.wants_children as string) || "");

    setRelationshipPreference((details.relationship_preference as string) || "");
    setCasualDating(details.casual_dating === true ? "yes" : details.casual_dating === false ? "no" : "");
    setKinkFriendly(details.kink_friendly === true ? "yes" : details.kink_friendly === false ? "no" : "");

    setPrefAgeMin(String((discovery as Record<string, unknown>).age_min ?? ""));
    setPrefAgeMax(String((discovery as Record<string, unknown>).age_max ?? ""));
    setPrefDistance(String((discovery as Record<string, unknown>).distance_km ?? ""));
    setPrefGenders(
      ((discovery as Record<string, unknown>).genders as string[] | undefined)?.join(", ") || ""
    );
    setGlobalMode(Boolean((discovery as Record<string, unknown>).global_mode));
    setProfileVisibility((discovery as Record<string, unknown>).profile_visibility !== false);
    setIncognitoMode(Boolean((discovery as Record<string, unknown>).incognito_mode));

    setInterests((user?.interests || []).join(", "));
    setVideoUrl(user?.profile_video_url || "");
    setVideoLoops(((media.video_loops as string[]) || []).join(", "));
    setAnthem((media.anthem as string) || "");
    setPrompts(normalizePrompts((media.prompts as string[]) || []));
    setAvailabilityWindows(((details.availability_windows as string[]) || []).join(", "));
    setPhotos((media.photos as string[]) || []);
    setPhotoVerified(Boolean(media.photo_verified));
    const safetySettings = (details.safety_settings as Record<string, unknown>) || {};
    setBlockNudity(Boolean(safetySettings.block_nudity));
    setTrustedContacts(
      (details.safety_contacts as { name: string; contact: string }[] | undefined) || []
    );
    setIdVerificationStatus((details.id_verification_status as string) || null);
    setIdVerified(Boolean(details.id_verified));
  }, [user]);

  useEffect(() => {
    if (!accessToken || !user?.id) return;
    let isMounted = true;
    const loadCreatedGroups = async () => {
      setCreatedLoading(true);
      setCreatedError(null);
      const res = await apiFetch(`/groups?creator_id=${user.id}`, { token: accessToken });
      if (!isMounted) return;
      if (res.ok) {
        setCreatedGroups(await res.json());
      } else {
        const data = await res.json().catch(() => null);
        setCreatedError(data?.detail || "Unable to load your groups.");
      }
      setCreatedLoading(false);
    };
    loadCreatedGroups();
    return () => {
      isMounted = false;
    };
  }, [accessToken, user?.id]);

  const completionPercent = useMemo(() => {
    const completionValues = [
      user?.profile_image_url,
      username,
      bio,
      dob,
      gender,
      sexualOrientation,
      lookingFor,
      locationCity || locationCountry,
      heightCm,
      weightKg,
      income,
      bodyType,
      hairColor,
      eyeColor,
      incomeBracket,
      workoutHabits,
      smoking,
      drinking,
      educationLevel,
      jobTitle,
      company,
      school,
      religion,
      politicalViews,
      zodiacSign,
      personalityType,
      languages,
      ethnicity,
      pets,
      diet,
      sleepHabits,
      socialEnergy,
      travelFrequency,
      communicationStyle,
      loveLanguages,
      hasChildren,
      wantsChildren,
      relationshipPreference,
      casualDating,
      kinkFriendly,
      prefAgeMin,
      prefAgeMax,
      prefDistance,
      prefGenders,
      globalMode,
      profileVisibility,
      incognitoMode,
      interests,
      videoUrl,
      videoLoops,
      anthem,
      prompts.filter(Boolean),
      photos,
    ];
    const filled = completionValues.filter(hasValue).length;
    const total = completionValues.length;
    return total ? Math.round((filled / total) * 100) : 0;
  }, [
    anthem,
    bio,
    casualDating,
    company,
    dob,
    drinking,
    communicationStyle,
    educationLevel,
    ethnicity,
    eyeColor,
    hairColor,
    gender,
    globalMode,
    hasChildren,
    heightCm,
    income,
    incomeBracket,
    incognitoMode,
    interests,
    jobTitle,
    kinkFriendly,
    languages,
    locationCity,
    locationCountry,
    loveLanguages,
    lookingFor,
    bodyType,
    pets,
    personalityType,
    photos,
    politicalViews,
    prefAgeMax,
    prefAgeMin,
    prefDistance,
    prefGenders,
    profileVisibility,
    prompts,
    religion,
    relationshipPreference,
    school,
    socialEnergy,
    sexualOrientation,
    sleepHabits,
    smoking,
    user?.profile_image_url,
    travelFrequency,
    videoLoops,
    videoUrl,
    weightKg,
    wantsChildren,
    workoutHabits,
    zodiacSign,
  ]);

  const handleSave = async () => {
    if (!accessToken) {
      setStatus("Please sign in to update your profile.");
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const computedAge = calculateAge(dob);
      const profileDetails = {
        dob: dob || undefined,
        show_orientation: showOrientation,
        looking_for: lookingFor || undefined,
        height_cm: heightCm ? Number(heightCm) : undefined,
        weight_kg: weightKg ? Number(weightKg) : undefined,
        income: income ? Number(income) : undefined,
        body_type: bodyType || undefined,
        hair_color: hairColor || undefined,
        eye_color: eyeColor || undefined,
        income_bracket: incomeBracket || undefined,
        workout_habits: workoutHabits || undefined,
        smoking: smoking || undefined,
        drinking: drinking || undefined,
        education_level: educationLevel || undefined,
        job_title: jobTitle || undefined,
        company: company || undefined,
        school: school || undefined,
        religion: religion || undefined,
        political_views: politicalViews || undefined,
        zodiac_sign: zodiacSign || undefined,
        personality_type: personalityType || undefined,
        languages: parseList(languages),
        ethnicity: ethnicity || undefined,
        pets: parseList(pets),
        diet: diet || undefined,
        sleep_habits: sleepHabits || undefined,
        social_energy: socialEnergy || undefined,
        travel_frequency: travelFrequency || undefined,
        communication_style: communicationStyle || undefined,
        love_languages: parseList(loveLanguages),
        has_children: hasChildren || undefined,
        wants_children: wantsChildren || undefined,
        relationship_preference: relationshipPreference || undefined,
        casual_dating: casualDating === "" ? null : casualDating === "yes",
        kink_friendly: kinkFriendly === "" ? null : kinkFriendly === "yes",
        availability_windows: parseList(availabilityWindows),
        safety_settings: {
          block_nudity: blockNudity,
        },
        safety_contacts: trustedContacts,
      };

      const discoverySettings = {
        age_min: prefAgeMin ? Number(prefAgeMin) : undefined,
        age_max: prefAgeMax ? Number(prefAgeMax) : undefined,
        distance_km: prefDistance ? Number(prefDistance) : undefined,
        genders: parseList(prefGenders),
        global_mode: globalMode,
        profile_visibility: profileVisibility,
        incognito_mode: incognitoMode,
      };

      const profileMedia = {
        photos,
        prompts: prompts.filter(Boolean),
        anthem: anthem || undefined,
        video_loops: parseList(videoLoops),
        photo_verified: photoVerified,
      };

      const payload = {
        username: username.trim() || undefined,
        bio: bio.trim() || undefined,
        gender,
        sexual_orientation: sexualOrientation || undefined,
        location_city: locationCity.trim() || undefined,
        location_country: locationCountry.trim() || undefined,
        location_lat: locationLat ? Number(locationLat) : undefined,
        location_lng: locationLng ? Number(locationLng) : undefined,
        profile_video_url: videoUrl.trim() || undefined,
        interests: parseList(interests),
        age: computedAge ?? user?.age,
        profile_details: profileDetails,
        discovery_settings: discoverySettings,
        profile_media: profileMedia,
      };

      const res = await apiFetch("/users/me", {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await refreshSession();
        setStatus("Profile updated.");
      } else {
        const data = await res.json().catch(() => null);
        setStatus(data?.detail || "Profile update failed.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Profile update failed.";
      setStatus(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerificationRequest = async () => {
    if (!accessToken) {
      setStatus("Please sign in to request verification.");
      return;
    }
    const res = await apiFetch("/users/me/request-verification", {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      await refreshSession();
      setStatus("Verification request submitted.");
    } else {
      const data = await res.json().catch(() => null);
      setStatus(data?.detail || "Unable to request verification.");
    }
  };

  const uploadVerificationAsset = async (
    endpoint: string,
    label: string,
    asset: UploadAsset
  ) => {
    if (!accessToken) {
      setStatus("Please sign in to upload verification.");
      return;
    }
    setIsVerifying(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append(
        "file",
        buildFormFile({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
        }) as unknown as Blob
      );
      const res = await apiFetch(endpoint, {
        method: "POST",
        token: accessToken,
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `${label} upload failed.`);
      }
      await refreshSession();
      setStatus(`${label} submitted for review.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `${label} upload failed.`;
      setStatus(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSelectVerification = async (type: "photo" | "id") => {
    if (!accessToken) {
      setStatus("Please sign in to upload verification.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPendingVerification({
      type,
      asset: { uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType },
    });
  };

  const handleConfirmVerification = async () => {
    if (!pendingVerification) return;
    const endpoint =
      pendingVerification.type === "photo"
        ? "/users/me/photo-verification"
        : "/users/me/id-verification";
    const label =
      pendingVerification.type === "photo" ? "Photo verification" : "ID verification";
    await uploadVerificationAsset(endpoint, label, pendingVerification.asset);
    setPendingVerification(null);
  };

  const handlePickPhotos = async () => {
    if (!accessToken) {
      setStatus("Please sign in to upload photos.");
      return;
    }
    if (photos.length >= MAX_PROFILE_PHOTOS) {
      setStatus(`You can upload up to ${MAX_PROFILE_PHOTOS} photos.`);
      return;
    }
    setStatus(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      aspect: [4, 5],
    });
    if (result.canceled) {
      return;
    }
    const asset = result.assets[0];
    setPendingPhotos([
      {
        uri: asset.uri,
        name: asset.fileName,
        mimeType: asset.mimeType,
      },
    ]);
  };

  const handleUploadPendingPhotos = async () => {
    if (!accessToken) {
      setStatus("Please sign in to upload photos.");
      return;
    }
    if (pendingPhotos.length === 0) {
      setStatus("Select a photo first.");
      return;
    }
    if (photos.length + pendingPhotos.length > MAX_PROFILE_PHOTOS) {
      setStatus(`You can upload up to ${MAX_PROFILE_PHOTOS} photos.`);
      return;
    }
    setIsUploading(true);
    try {
      for (const asset of pendingPhotos) {
        const formData = new FormData();
        const file = buildFormFile({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
        });
        formData.append("file", file as unknown as Blob);
        const res = await apiFetch("/users/me/photo", {
          method: "POST",
          token: accessToken,
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.detail || "Photo upload failed.");
        }
      }
      await refreshSession();
      setStatus("Photos uploaded.");
      setPendingPhotos([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Photo upload failed.";
      setStatus(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    if (!accessToken) {
      setStatus("Please sign in to manage photos.");
      return;
    }
    setIsDeletingPhoto(true);
    setStatus(null);
    try {
      const res = await apiFetch("/users/me/photo", {
        method: "DELETE",
        token: accessToken,
        body: JSON.stringify({ url: photoUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Unable to delete photo.");
      }
      const updated = await res.json();
      const media = (updated.profile_media as Record<string, unknown>) || {};
      setPhotos((media.photos as string[]) || []);
      await refreshSession();
      setStatus("Photo removed.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete photo.";
      setStatus(message);
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${groupId}`, {
      method: "DELETE",
      token: accessToken,
    });
    if (res.ok) {
      setCreatedGroups((prev) => prev.filter((group) => group.id !== groupId));
    } else {
      const data = await res.json().catch(() => null);
      setCreatedError(data?.detail || "Unable to delete group.");
    }
  };

  const handleAddTrustedContact = () => {
    const name = trustedName.trim();
    const contact = trustedContact.trim();
    if (!name || !contact) {
      setStatus("Add a name and contact for trusted contacts.");
      return;
    }
    setTrustedContacts((prev) => [...prev, { name, contact }]);
    setTrustedName("");
    setTrustedContact("");
  };

  const handleRemoveTrustedContact = (index: number) => {
    setTrustedContacts((prev) => prev.filter((_, idx) => idx !== index));
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.status}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!accessToken) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.status}>Sign in to manage your profile.</Text>
          <Button onPress={() => router.push("/auth/login")}>Go to sign in</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.select({ ios: "padding", android: undefined })}
        >
          <ScrollView contentContainerStyle={[styles.container, styles.containerWithNav]}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileHeaderTitle}>Profile</Text>
              <Pressable
                onPress={() => router.push("/settings" as Href)}
                style={({ pressed }) => [
                  styles.settingsButton,
                  pressed ? styles.settingsButtonPressed : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Open settings"
              >
                <Ionicons name="settings-outline" size={20} color="#ffffff" />
              </Pressable>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile completion</Text>
              <View style={styles.completionRow}>
                <Text style={styles.completionText}>
                  Your profile is {completionPercent}% complete
                </Text>
                <Text style={styles.completionPercent}>{completionPercent}%</Text>
              </View>
              <View style={styles.completionBar}>
                <View style={[styles.completionFill, { width: `${completionPercent}%` }]} />
              </View>
              <Text style={styles.helperText}>
                The more you share, the better your matches and group relevance.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.title}>Your profile</Text>
              <Text style={styles.subtitle}>
                Verification status: {user?.verification_status || "unverified"}
              </Text>
              <View style={styles.photoSection}>
                <Text style={styles.sectionTitle}>Profile photos</Text>
                {photos.length === 0 ? (
                  <View style={styles.photoPlaceholder} />
                ) : (
                    <View style={styles.photoGrid}>
                      {photos.map((photo) => (
                        <View key={photo} style={styles.photoItem}>
                          <Pressable onPress={() => setPreviewPhoto(photo)}>
                            <Image
                              source={{ uri: resolveMediaUrl(photo) }}
                              style={styles.photo}
                              resizeMode="cover"
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeletePhoto(photo)}
                            disabled={isDeletingPhoto}
                            style={styles.photoRemove}
                          >
                            <Text style={styles.photoRemoveText}>x</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                )}
                  <Button onPress={handlePickPhotos} disabled={isUploading}>
                    {isUploading ? "Uploading..." : "Upload photos"}
                  </Button>
                  {pendingPhotos.length > 0 ? (
                    <View style={styles.pendingCard}>
                      <Text style={styles.helperText}>Preview</Text>
                      <Image source={{ uri: pendingPhotos[0].uri }} style={styles.pendingImage} />
                      <View style={styles.pendingActions}>
                        <Button size="sm" variant="outline" onPress={() => setPendingPhotos([])}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onPress={handleUploadPendingPhotos}
                          disabled={isUploading}
                        >
                          {isUploading ? "Uploading..." : "Confirm upload"}
                        </Button>
                      </View>
                      <Button size="sm" variant="ghost" onPress={handlePickPhotos}>
                        Choose another
                      </Button>
                    </View>
                  ) : null}
                  <Text style={styles.helperText}>
                    {photos.length}/{MAX_PROFILE_PHOTOS} photos used
                  </Text>
                  <Text style={styles.helperText}>
                    {photoVerified ? "Photo verified" : "Verification pending"}
                  </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Safety & verification</Text>
              <Text style={styles.helperText}>
                Control sensitive content and verify your identity.
              </Text>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.badge,
                    photoVerified ? styles.badgeActive : styles.badgeMuted,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      photoVerified ? styles.badgeTextActive : styles.badgeTextMuted,
                    ]}
                  >
                    {photoVerified ? "Photo verified" : "Photo pending"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    idVerified ? styles.badgeActive : styles.badgeMuted,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      idVerified ? styles.badgeTextActive : styles.badgeTextMuted,
                    ]}
                  >
                    {idVerified
                      ? "ID verified"
                      : idVerificationStatus
                        ? `ID ${idVerificationStatus}`
                        : "ID not verified"}
                  </Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <Button
                  size="sm"
                  onPress={() => handleSelectVerification("photo")}
                  disabled={isVerifying}
                >
                  {isVerifying ? "Submitting..." : "Choose photo verification"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => handleSelectVerification("id")}
                  disabled={isVerifying}
                >
                  {isVerifying ? "Submitting..." : "Choose ID verification"}
                </Button>
              </View>
              {pendingVerification ? (
                <View style={styles.pendingCard}>
                  <Text style={styles.helperText}>
                    {pendingVerification.type === "photo" ? "Photo" : "ID"} verification
                  </Text>
                  <Image
                    source={{ uri: pendingVerification.asset.uri }}
                    style={styles.pendingImage}
                  />
                  <View style={styles.pendingActions}>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => setPendingVerification(null)}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onPress={handleConfirmVerification} disabled={isVerifying}>
                      {isVerifying ? "Submitting..." : "Confirm upload"}
                    </Button>
                  </View>
                </View>
              ) : null}
              <View style={styles.switchRow}>
                <Text style={styles.label}>Block nudity in chat</Text>
                <Switch value={blockNudity} onValueChange={setBlockNudity} />
              </View>
              <Button variant="outline" onPress={() => router.push("/safety")}>
                Open Safety Center
              </Button>
              <View style={styles.field}>
                <Text style={styles.label}>Trusted contacts</Text>
                {trustedContacts.length === 0 ? (
                  <Text style={styles.helperText}>
                    Add someone you trust so you can share group plans quickly.
                  </Text>
                ) : (
                  trustedContacts.map((contact, index) => (
                    <View key={`${contact.name}-${index}`} style={styles.trustedRow}>
                      <View style={styles.trustedInfo}>
                        <Text style={styles.trustedName}>{contact.name}</Text>
                        <Text style={styles.trustedContact}>{contact.contact}</Text>
                      </View>
                      <Pressable onPress={() => handleRemoveTrustedContact(index)}>
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))
                )}
                <View style={styles.row}>
                  <TextInput
                    value={trustedName}
                    onChangeText={setTrustedName}
                    placeholder="Name"
                    style={[styles.input, styles.flex]}
                  />
                  <TextInput
                    value={trustedContact}
                    onChangeText={setTrustedContact}
                    placeholder="Phone or email"
                    style={[styles.input, styles.flex]}
                  />
                </View>
                <Button size="sm" variant="outline" onPress={handleAddTrustedContact}>
                  Add trusted contact
                </Button>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Identity & basics</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Username</Text>
                <TextInput value={username} onChangeText={setUsername} style={styles.input} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Bio</Text>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  style={[styles.input, styles.multiline]}
                  multiline
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Date of birth</Text>
                <TextInput
                  value={dob}
                  onChangeText={setDob}
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Gender identity</Text>
                <View style={styles.chipRow}>
                  {GENDER_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setGender(option)}
                      style={[styles.chip, gender === option ? styles.chipActive : null]}
                    >
                      <Text style={[styles.chipText, gender === option ? styles.chipTextActive : null]}>
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Sexual orientation</Text>
                <View style={styles.chipRow}>
                  {ORIENTATION_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setSexualOrientation(option)}
                      style={[styles.chip, sexualOrientation === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          sexualOrientation === option ? styles.chipTextActive : null,
                        ]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Show orientation on profile</Text>
                <Switch value={showOrientation} onValueChange={setShowOrientation} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Looking for</Text>
                <View style={styles.chipRow}>
                  {LOOKING_FOR_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setLookingFor(option)}
                      style={[styles.chip, lookingFor === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, lookingFor === option ? styles.chipTextActive : null]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.fieldFlex}>
                  <Text style={styles.label}>City</Text>
                  <TextInput
                    value={locationCity}
                    onChangeText={setLocationCity}
                    style={styles.input}
                  />
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
              <View style={styles.row}>
                <View style={styles.fieldFlex}>
                  <Text style={styles.label}>Latitude</Text>
                  <TextInput
                    value={locationLat}
                    onChangeText={setLocationLat}
                    style={styles.input}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.fieldFlex}>
                  <Text style={styles.label}>Longitude</Text>
                  <TextInput
                    value={locationLng}
                    onChangeText={setLocationLng}
                    style={styles.input}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <Text style={styles.helper}>Used for distance-based discovery.</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Lifestyle & work</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Height (cm)</Text>
                <TextInput
                  value={heightCm}
                  onChangeText={setHeightCm}
                  style={styles.input}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Weight (kg)</Text>
                <TextInput
                  value={weightKg}
                  onChangeText={setWeightKg}
                  style={styles.input}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Body type</Text>
                <View style={styles.chipRow}>
                  {BODY_TYPE_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setBodyType(option)}
                      style={[styles.chip, bodyType === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, bodyType === option ? styles.chipTextActive : null]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Hair color</Text>
                <View style={styles.chipRow}>
                  {HAIR_COLOR_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setHairColor(option)}
                      style={[styles.chip, hairColor === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, hairColor === option ? styles.chipTextActive : null]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Eye color</Text>
                <View style={styles.chipRow}>
                  {EYE_COLOR_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setEyeColor(option)}
                      style={[styles.chip, eyeColor === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, eyeColor === option ? styles.chipTextActive : null]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Income (yearly)</Text>
                <TextInput
                  value={income}
                  onChangeText={setIncome}
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="50000"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Income bracket</Text>
                <View style={styles.chipRow}>
                  {INCOME_BRACKET_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setIncomeBracket(option)}
                      style={[styles.chip, incomeBracket === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          incomeBracket === option ? styles.chipTextActive : null,
                        ]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Workout habits</Text>
                <View style={styles.chipRow}>
                  {WORKOUT_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setWorkoutHabits(option)}
                      style={[styles.chip, workoutHabits === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          workoutHabits === option ? styles.chipTextActive : null,
                        ]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Smoking</Text>
                <TextInput
                  value={smoking}
                  onChangeText={setSmoking}
                  style={styles.input}
                  placeholder="Never / sometimes"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Drinking</Text>
                <TextInput
                  value={drinking}
                  onChangeText={setDrinking}
                  style={styles.input}
                  placeholder="Never / socially"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Education level</Text>
                <View style={styles.chipRow}>
                  {EDUCATION_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setEducationLevel(option)}
                      style={[styles.chip, educationLevel === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          educationLevel === option ? styles.chipTextActive : null,
                        ]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Job title</Text>
                <TextInput value={jobTitle} onChangeText={setJobTitle} style={styles.input} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Company</Text>
                <TextInput value={company} onChangeText={setCompany} style={styles.input} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>School</Text>
                <TextInput value={school} onChangeText={setSchool} style={styles.input} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Attributes & beliefs</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Religion</Text>
                <View style={styles.chipRow}>
                  {RELIGION_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setReligion(option)}
                      style={[styles.chip, religion === option ? styles.chipActive : null]}
                    >
                      <Text style={[styles.chipText, religion === option ? styles.chipTextActive : null]}>
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Political views</Text>
                <View style={styles.chipRow}>
                  {POLITICAL_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setPoliticalViews(option)}
                      style={[styles.chip, politicalViews === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, politicalViews === option ? styles.chipTextActive : null]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Zodiac sign</Text>
                <TextInput value={zodiacSign} onChangeText={setZodiacSign} style={styles.input} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Personality type</Text>
                <TextInput
                  value={personalityType}
                  onChangeText={setPersonalityType}
                  style={styles.input}
                  placeholder="INFJ"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Languages spoken</Text>
                <TextInput
                  value={languages}
                  onChangeText={setLanguages}
                  style={styles.input}
                  placeholder="English, Spanish"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Ethnicity (optional)</Text>
                <TextInput value={ethnicity} onChangeText={setEthnicity} style={styles.input} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Lifestyle & social</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Pets</Text>
                <TextInput value={pets} onChangeText={setPets} style={styles.input} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Diet</Text>
                <View style={styles.chipRow}>
                  {DIET_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setDiet(option)}
                      style={[styles.chip, diet === option ? styles.chipActive : null]}
                    >
                      <Text style={[styles.chipText, diet === option ? styles.chipTextActive : null]}>
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Sleeping habits</Text>
                <View style={styles.chipRow}>
                  {SLEEP_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setSleepHabits(option)}
                      style={[styles.chip, sleepHabits === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, sleepHabits === option ? styles.chipTextActive : null]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Social energy</Text>
                <View style={styles.chipRow}>
                  {SOCIAL_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setSocialEnergy(option)}
                      style={[styles.chip, socialEnergy === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, socialEnergy === option ? styles.chipTextActive : null]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Travel frequency</Text>
                <View style={styles.chipRow}>
                  {TRAVEL_FREQUENCY_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setTravelFrequency(option)}
                      style={[styles.chip, travelFrequency === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          travelFrequency === option ? styles.chipTextActive : null,
                        ]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Communication style</Text>
                <View style={styles.chipRow}>
                  {COMMUNICATION_STYLE_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setCommunicationStyle(option)}
                      style={[
                        styles.chip,
                        communicationStyle === option ? styles.chipActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          communicationStyle === option ? styles.chipTextActive : null,
                        ]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Love languages (comma separated)</Text>
                <TextInput
                  value={loveLanguages}
                  onChangeText={setLoveLanguages}
                  style={styles.input}
                  placeholder="Quality time, Acts of service"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Children & family</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Has children</Text>
                <View style={styles.chipRow}>
                  {YES_NO_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setHasChildren(option)}
                      style={[styles.chip, hasChildren === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, hasChildren === option ? styles.chipTextActive : null]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Wants children</Text>
                <View style={styles.chipRow}>
                  {YES_NO_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setWantsChildren(option)}
                      style={[styles.chip, wantsChildren === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, wantsChildren === option ? styles.chipTextActive : null]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Relationship preferences</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Relationship style</Text>
                <View style={styles.chipRow}>
                  {RELATIONSHIP_STYLE_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setRelationshipPreference(option)}
                      style={[styles.chip, relationshipPreference === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          relationshipPreference === option ? styles.chipTextActive : null,
                        ]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Casual dating openness</Text>
                <View style={styles.chipRow}>
                  {["yes", "no"].map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setCasualDating(option)}
                      style={[styles.chip, casualDating === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, casualDating === option ? styles.chipTextActive : null]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Kink-friendly</Text>
                <View style={styles.chipRow}>
                  {["yes", "no"].map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setKinkFriendly(option)}
                      style={[styles.chip, kinkFriendly === option ? styles.chipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, kinkFriendly === option ? styles.chipTextActive : null]}
                      >
                        {formatOption(option)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Discovery & matching</Text>
              <View style={styles.row}>
                <View style={styles.fieldFlex}>
                  <Text style={styles.label}>Preferred age min</Text>
                  <TextInput
                    value={prefAgeMin}
                    onChangeText={setPrefAgeMin}
                    style={styles.input}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.fieldFlex}>
                  <Text style={styles.label}>Preferred age max</Text>
                  <TextInput
                    value={prefAgeMax}
                    onChangeText={setPrefAgeMax}
                    style={styles.input}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Distance range (km)</Text>
                <TextInput
                  value={prefDistance}
                  onChangeText={setPrefDistance}
                  style={styles.input}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Availability windows</Text>
                <TextInput
                  value={availabilityWindows}
                  onChangeText={setAvailabilityWindows}
                  style={styles.input}
                  placeholder="Weeknights, weekends, mornings"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Genders you want to see</Text>
                <TextInput
                  value={prefGenders}
                  onChangeText={setPrefGenders}
                  style={styles.input}
                  placeholder="male, female, other"
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Global mode</Text>
                <Switch value={globalMode} onValueChange={setGlobalMode} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Profile visible</Text>
                <Switch value={profileVisibility} onValueChange={setProfileVisibility} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Incognito mode</Text>
                <Switch value={incognitoMode} onValueChange={setIncognitoMode} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Media & prompts</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Interests (comma separated)</Text>
                <TextInput value={interests} onChangeText={setInterests} style={styles.input} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Video loop URLs</Text>
                <TextInput
                  value={videoLoops}
                  onChangeText={setVideoLoops}
                  style={styles.input}
                  placeholder="https://..., https://..."
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Intro video URL</Text>
                <TextInput
                  value={videoUrl}
                  onChangeText={setVideoUrl}
                  style={styles.input}
                  placeholder="https://..."
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Anthem (song or playlist)</Text>
                <TextInput
                  value={anthem}
                  onChangeText={setAnthem}
                  style={styles.input}
                  placeholder="Song title or Spotify link"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Prompts</Text>
                <View style={styles.promptGrid}>
                  {prompts.map((prompt, index) => (
                    <View key={`prompt-${index}`} style={styles.promptField}>
                      <Text style={styles.promptLabel}>Prompt {index + 1}</Text>
                      <TextInput
                        value={prompt}
                        onChangeText={(value) => {
                          const next = [...prompts];
                          next[index] = value;
                          setPrompts(next);
                        }}
                        style={styles.input}
                        placeholder="Tell us something fun..."
                      />
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your groups</Text>
              </View>
              {createdLoading ? (
                <Text style={styles.status}>Loading your groups...</Text>
              ) : createdGroups.length === 0 ? (
                <Text style={styles.status}>You have not created any groups yet.</Text>
              ) : (
                createdGroups.map((group) => {
                  const spotsLeft =
                    group.max_participants != null
                      ? Math.max(group.max_participants - (group.approved_members ?? 0), 0)
                      : null;
                  return (
                    <View key={group.id} style={styles.groupCard}>
                      <View style={styles.groupInfo}>
                        <Text style={styles.groupTitle}>{group.title}</Text>
                        {group.description ? (
                          <Text style={styles.groupDescription}>{group.description}</Text>
                        ) : null}
                        <Text style={styles.groupMeta}>
                          {group.cost_type ? group.cost_type.replace("_", " ") : "Custom"}
                          {spotsLeft != null ? ` · ${spotsLeft} spots left` : ""}
                        </Text>
                      </View>
                      <Button
                        size="sm"
                        onPress={() => handleDeleteGroup(group.id)}
                        style={styles.deleteButton}
                      >
                        Delete
                      </Button>
                    </View>
                  );
                })
              )}
              {createdError ? <Text style={styles.errorText}>{createdError}</Text> : null}
            </View>

            {status ? <Text style={styles.status}>{status}</Text> : null}

            <View style={styles.actions}>
              <Button onPress={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save profile"}
              </Button>
              <Button variant="outline" onPress={handleVerificationRequest}>
                Request verification
              </Button>
              <Button variant="ghost" onPress={logout}>
                Sign out
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <BottomNav />
      </View>
      <Modal
        visible={Boolean(previewPhoto)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <Pressable style={styles.lightboxBackdrop} onPress={() => setPreviewPhoto(null)}>
          <Pressable style={styles.lightboxContent} onPress={() => {}}>
            {previewPhoto ? (
              <Image
                source={{ uri: resolveMediaUrl(previewPhoto) }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
            ) : null}
            <Pressable style={styles.lightboxClose} onPress={() => setPreviewPhoto(null)}>
              <Text style={styles.lightboxCloseText}>x</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  page: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 14,
  },
  containerWithNav: {
    paddingBottom: BOTTOM_NAV_HEIGHT + 16,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  profileHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsButtonPressed: {
    opacity: 0.85,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  completionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  completionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  completionPercent: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10b981",
  },
  completionBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  completionFill: {
    height: "100%",
    backgroundColor: "#10b981",
  },
  photoSection: {
    gap: 10,
  },
  pendingCard: {
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 12,
  },
  pendingImage: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
  },
  pendingActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoItem: {
    width: "48%",
  },
  photo: {
    width: "100%",
    height: 120,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
  },
  photoRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  lightboxContent: {
    width: "100%",
    maxHeight: "90%",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  lightboxClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxCloseText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  photoPlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
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
  helperText: {
    fontSize: 12,
    color: "#64748b",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
  },
  badgeMuted: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeTextActive: {
    color: "#166534",
  },
  badgeTextMuted: {
    color: "#64748b",
  },
  trustedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  trustedInfo: {
    flex: 1,
    gap: 2,
  },
  trustedName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  trustedContact: {
    fontSize: 12,
    color: "#64748b",
  },
  removeText: {
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "600",
  },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  groupInfo: {
    flex: 1,
    gap: 4,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  groupDescription: {
    fontSize: 12,
    color: "#64748b",
  },
  groupMeta: {
    fontSize: 11,
    color: "#94a3b8",
  },
  deleteButton: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  field: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  fieldFlex: {
    flex: 1,
    gap: 6,
  },
  flex: {
    flex: 1,
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  chipActive: {
    backgroundColor: "#1e293b",
    borderColor: "#1e293b",
  },
  chipText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  promptGrid: {
    gap: 10,
  },
  promptField: {
    gap: 6,
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  status: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    textAlign: "center",
  },
  actions: {
    gap: 10,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
});
