"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const API_HOST =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api/v1", "") || "http://127.0.0.1:8000";

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

const GENDER_OPTIONS = ["male", "female", "other", "other_custom"];

interface CreatedGroup {
  id: number;
  title: string;
  description?: string | null;
  cost_type?: "free" | "shared" | "fully_paid" | "custom";
  max_participants?: number;
  approved_members?: number | null;
  category?: "mutual_benefits" | "friendship" | "dating" | null;
}

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

export default function ProfilePage() {
  const { accessToken, user, refreshSession } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<string>("other");
  const [sexualOrientation, setSexualOrientation] = useState("");
  const [showOrientation, setShowOrientation] = useState(true);
  const [lookingFor, setLookingFor] = useState("");
  const [dob, setDob] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("");

  const [heightCm, setHeightCm] = useState("");
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
  const [casualDating, setCasualDating] = useState<boolean | null>(null);
  const [kinkFriendly, setKinkFriendly] = useState<boolean | null>(null);

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

  const [photos, setPhotos] = useState<string[]>([]);
  const [photoVerified, setPhotoVerified] = useState(false);
  const [createdGroups, setCreatedGroups] = useState<CreatedGroup[]>([]);
  const [createdLoading, setCreatedLoading] = useState(false);
  const [createdError, setCreatedError] = useState<string | null>(null);

  useEffect(() => {
    const details = (user?.profile_details as Record<string, unknown>) || {};
    const discovery = (user?.discovery_settings as Record<string, unknown>) || {};
    const media = (user?.profile_media as Record<string, unknown>) || {};

    setUsername(user?.username || "");
    setBio(user?.bio || "");
    setGender(user?.gender || "other");
    setSexualOrientation(user?.sexual_orientation || "");
    setShowOrientation((details.show_orientation as boolean) ?? true);
    setLookingFor((details.looking_for as string) || "");
    setDob((details.dob as string) || "");
    setLocationCity(user?.location_city || "");
    setLocationCountry(user?.location_country || "");

    setHeightCm(String(details.height_cm ?? ""));
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

    setHasChildren((details.has_children as string) || "");
    setWantsChildren((details.wants_children as string) || "");

    setRelationshipPreference((details.relationship_preference as string) || "");
    setCasualDating((details.casual_dating as boolean) ?? null);
    setKinkFriendly((details.kink_friendly as boolean) ?? null);

    setPrefAgeMin(String(discovery.age_min ?? ""));
    setPrefAgeMax(String(discovery.age_max ?? ""));
    setPrefDistance(String(discovery.distance_km ?? ""));
    setPrefGenders(((discovery.genders as string[]) || []).join(", "));
    setGlobalMode(Boolean(discovery.global_mode));
    setProfileVisibility(discovery.profile_visibility !== false);
    setIncognitoMode(Boolean(discovery.incognito_mode));

    setInterests((user?.interests || []).join(", "));
    setVideoUrl(user?.profile_video_url || "");
    setVideoLoops(((media.video_loops as string[]) || []).join(", "));
    setAnthem((media.anthem as string) || "");
    setPrompts((media.prompts as string[]) || ["", "", ""]);
    setPhotos((media.photos as string[]) || []);
    setPhotoVerified(Boolean(media.photo_verified));
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    const loadCreatedGroups = async () => {
      setCreatedLoading(true);
      setCreatedError(null);
      const res = await apiFetch(`/groups?creator_id=${user.id}`, {
        token: accessToken,
      });
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
    return Math.round((filled / total) * 100);
  }, [
    anthem,
    bio,
    casualDating,
    company,
    dob,
    drinking,
    educationLevel,
    ethnicity,
    gender,
    globalMode,
    hasChildren,
    heightCm,
    incognitoMode,
    interests,
    jobTitle,
    kinkFriendly,
    languages,
    locationCity,
    locationCountry,
    lookingFor,
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
    sexualOrientation,
    sleepHabits,
    smoking,
    socialEnergy,
    user?.profile_image_url,
    videoLoops,
    videoUrl,
    wantsChildren,
    workoutHabits,
    zodiacSign,
  ]);

  const handleUpload = async () => {
    if (!accessToken) {
      setStatus("Please sign in to upload photos.");
      return;
    }
    if (files.length === 0) {
      setStatus("Select at least one image.");
      return;
    }
    if (photos.length + files.length > 9) {
      setStatus("You can upload up to 9 photos.");
      return;
    }
    setIsUploading(true);
    setStatus(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await apiFetch("/users/me/photo", {
          method: "POST",
          body: formData,
          token: accessToken,
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.detail || "Upload failed.");
        }
      }
      await refreshSession();
      setStatus("Photos uploaded successfully.");
      setFiles([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setStatus(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!accessToken) {
      setCreatedError("Please sign in to delete a group.");
      return;
    }
    setCreatedError(null);
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

  const handleProfileUpdate = async () => {
    if (!accessToken) {
      setProfileStatus("Please sign in to update your profile.");
      return;
    }
    setProfileStatus(null);

    const computedAge = calculateAge(dob);
    const profileDetails = {
      dob: dob || undefined,
      show_orientation: showOrientation,
      looking_for: lookingFor || undefined,
      height_cm: heightCm ? Number(heightCm) : undefined,
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
      has_children: hasChildren || undefined,
      wants_children: wantsChildren || undefined,
      relationship_preference: relationshipPreference || undefined,
      casual_dating: casualDating,
      kink_friendly: kinkFriendly,
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
      gender: gender || undefined,
      sexual_orientation: sexualOrientation || undefined,
      location_city: locationCity || undefined,
      location_country: locationCountry || undefined,
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
      setProfileStatus("Profile updated.");
    } else {
      const data = await res.json().catch(() => null);
      setProfileStatus(data?.detail || "Profile update failed.");
    }
  };

  const handleVerificationRequest = async () => {
    if (!accessToken) {
      setProfileStatus("Please sign in to request verification.");
      return;
    }
    const res = await apiFetch("/users/me/request-verification", {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      await refreshSession();
      setProfileStatus("Verification request submitted.");
    } else {
      const data = await res.json().catch(() => null);
      setProfileStatus(data?.detail || "Unable to request verification.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase text-slate-400">Profile completion</p>
        <div className="mt-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Your profile is {completionPercent}% complete</h1>
          <span className="text-sm font-semibold text-emerald-600">{completionPercent}%</span>
        </div>
        <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          The more you share, the better your matches and group relevance.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Profile photos</h2>
          <p className="text-sm text-slate-600">Upload up to 9 photos. The first image is your primary photo.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {photos.length === 0 ? (
            <div className="h-24 w-24 rounded-2xl bg-slate-100" />
          ) : (
            photos.map((photo) => (
              <img
                key={photo}
                src={`${API_HOST}${photo}`}
                alt="Profile"
                className="h-24 w-24 rounded-2xl object-cover"
              />
            ))
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
          />
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isUploading ? "Uploading..." : "Upload photos"}
          </Button>
          {photoVerified ? (
            <span className="text-sm font-semibold text-emerald-600">Photo verified</span>
          ) : (
            <span className="text-sm text-slate-500">Verification pending</span>
          )}
        </div>
        {status ? <p className="text-sm text-slate-600">{status}</p> : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Identity & basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Date of birth
            <input
              type="date"
              value={dob}
              onChange={(event) => setDob(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Gender identity
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Sexual orientation
            <select
              value={sexualOrientation}
              onChange={(event) => setSexualOrientation(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {ORIENTATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:pt-7">
            <input
              type="checkbox"
              checked={showOrientation}
              onChange={(event) => setShowOrientation(event.target.checked)}
            />
            Show orientation on profile
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Looking for
            <select
              value={lookingFor}
              onChange={(event) => setLookingFor(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {LOOKING_FOR_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Location city
            <input
              value={locationCity}
              onChange={(event) => setLocationCity(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="City"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Location country
            <input
              value={locationCountry}
              onChange={(event) => setLocationCountry(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="Country"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Profile bio
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="Short intro about you"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Appearance & lifestyle</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Height (cm)
            <input
              value={heightCm}
              onChange={(event) => setHeightCm(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Workout habits
            <select
              value={workoutHabits}
              onChange={(event) => setWorkoutHabits(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {WORKOUT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Smoking
            <input
              value={smoking}
              onChange={(event) => setSmoking(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="Never / sometimes"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Drinking
            <input
              value={drinking}
              onChange={(event) => setDrinking(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="Never / socially"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Education level
            <select
              value={educationLevel}
              onChange={(event) => setEducationLevel(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {EDUCATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Job title
            <input
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Company
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            School
            <input
              value={school}
              onChange={(event) => setSchool(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Personal attributes & beliefs</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Religion
            <select
              value={religion}
              onChange={(event) => setReligion(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {RELIGION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Political views
            <select
              value={politicalViews}
              onChange={(event) => setPoliticalViews(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {POLITICAL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Zodiac sign
            <input
              value={zodiacSign}
              onChange={(event) => setZodiacSign(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Personality type
            <input
              value={personalityType}
              onChange={(event) => setPersonalityType(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="INFJ"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Languages spoken
            <input
              value={languages}
              onChange={(event) => setLanguages(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="English, Spanish"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Ethnicity (optional)
            <input
              value={ethnicity}
              onChange={(event) => setEthnicity(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Lifestyle & social preferences</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Pets
            <input
              value={pets}
              onChange={(event) => setPets(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="Dog, Cat, None"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Diet
            <select
              value={diet}
              onChange={(event) => setDiet(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {DIET_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Sleeping habits
            <select
              value={sleepHabits}
              onChange={(event) => setSleepHabits(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {SLEEP_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Social energy
            <select
              value={socialEnergy}
              onChange={(event) => setSocialEnergy(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {SOCIAL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Children & family preferences</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Has children
            <select
              value={hasChildren}
              onChange={(event) => setHasChildren(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {YES_NO_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Wants children
            <select
              value={wantsChildren}
              onChange={(event) => setWantsChildren(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {YES_NO_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Relationship preferences</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Relationship style
            <select
              value={relationshipPreference}
              onChange={(event) => setRelationshipPreference(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              {RELATIONSHIP_STYLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Casual dating openness
            <select
              value={casualDating === null ? "" : casualDating ? "yes" : "no"}
              onChange={(event) =>
                setCasualDating(event.target.value ? event.target.value === "yes" : null)
              }
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Kink-friendly
            <select
              value={kinkFriendly === null ? "" : kinkFriendly ? "yes" : "no"}
              onChange={(event) =>
                setKinkFriendly(event.target.value ? event.target.value === "yes" : null)
              }
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Discovery & matching settings</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Preferred age min
            <input
              value={prefAgeMin}
              onChange={(event) => setPrefAgeMin(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Preferred age max
            <input
              value={prefAgeMax}
              onChange={(event) => setPrefAgeMax(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Distance range (km)
            <input
              value={prefDistance}
              onChange={(event) => setPrefDistance(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Genders you want to see
            <input
              value={prefGenders}
              onChange={(event) => setPrefGenders(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="male, female, other"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={globalMode}
              onChange={(event) => setGlobalMode(event.target.checked)}
            />
            Global mode
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={profileVisibility}
              onChange={(event) => setProfileVisibility(event.target.checked)}
            />
            Profile visible
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={incognitoMode}
              onChange={(event) => setIncognitoMode(event.target.checked)}
            />
            Incognito mode
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Media & interaction</h2>
        <label className="text-sm font-semibold text-slate-700">
          Interests
          <input
            value={interests}
            onChange={(event) => setInterests(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            placeholder="Travel, Gym, Foodie"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Video loop URLs
          <input
            value={videoLoops}
            onChange={(event) => setVideoLoops(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            placeholder="https://..., https://..."
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Intro video URL
          <input
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            placeholder="https://..."
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Anthem (song or playlist)
          <input
            value={anthem}
            onChange={(event) => setAnthem(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            placeholder="Song title or Spotify link"
          />
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          {prompts.map((prompt, index) => (
            <label key={`prompt-${index}`} className="text-sm font-semibold text-slate-700">
              Prompt {index + 1}
              <input
                value={prompt}
                onChange={(event) => {
                  const next = [...prompts];
                  next[index] = event.target.value;
                  setPrompts(next);
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                placeholder="Tell us something fun..."
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Account verification</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleProfileUpdate}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Save Profile
          </Button>
          {user?.verification_status !== "verified" ? (
            <Button
              onClick={handleVerificationRequest}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Request Verification
            </Button>
          ) : (
            <span className="text-sm font-semibold text-emerald-600">Verified</span>
          )}
        </div>
        {profileStatus ? <p className="text-sm text-slate-600">{profileStatus}</p> : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Your groups</h2>
          <span className="text-sm text-slate-500">{createdGroups.length} total</span>
        </div>
        {createdLoading ? (
          <p className="text-sm text-slate-500">Loading your groups...</p>
        ) : createdGroups.length === 0 ? (
          <p className="text-sm text-slate-500">You have not created any groups yet.</p>
        ) : (
          <div className="grid gap-3">
            {createdGroups.map((group) => (
              <div
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{group.title}</p>
                  {group.description ? (
                    <p className="text-xs text-slate-500 line-clamp-2">{group.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {group.cost_type ? group.cost_type.replace("_", " ") : "Custom"}
                    {group.max_participants
                      ? ` • ${Math.max(
                          group.max_participants - (group.approved_members ?? 0),
                          0
                        )} spots left`
                      : ""}
                  </p>
                </div>
                <Button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
        {createdError ? <p className="text-sm text-red-600">{createdError}</p> : null}
      </div>
    </div>
  );
}
