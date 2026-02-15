"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/signed-media";
import { getProfilePhotoThumb } from "@/lib/media";

interface UserProfile {
  id: number;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  bio?: string | null;
  age?: number | null;
  gender?: string | null;
  sexual_orientation?: string | null;
  location_city?: string | null;
  location_country?: string | null;
  profile_image_url?: string | null;
  profile_video_url?: string | null;
  interests?: string[] | null;
  badges?: string[] | null;
  verification_status?: string | null;
  last_active_at?: string | null;
  profile_media?: {
    photos?: string[];
    photo_verified?: boolean;
    photo_thumbs?: Record<string, string> | null;
  } | null;
  profile_details?: Record<string, unknown> | null;
}

interface ProfileDetailItem {
  key: string;
  label: string;
  value: string;
}

const PROFILE_DETAIL_LABELS: Record<string, string> = {
  availability_windows: "Availability",
  show_orientation: "Show orientation",
  looking_for: "Looking for",
  dob: "Date of birth",
  height_cm: "Height (cm)",
  weight_kg: "Weight (kg)",
  income_bracket: "Income bracket",
  job_title: "Job title",
  body_type: "Body type",
  hair_color: "Hair color",
  eye_color: "Eye color",
  education_level: "Education",
  political_views: "Political views",
  zodiac_sign: "Zodiac sign",
  personality_type: "Personality type",
  travel_frequency: "Travel frequency",
  communication_style: "Communication style",
  relationship_preference: "Relationship preference",
  casual_dating: "Open to casual dating",
  kink_friendly: "Kink friendly",
  wants_children: "Wants children",
  has_children: "Has children",
  "safety_settings.block_nudity": "Block nudity",
  safety_contacts: "Trusted contacts",
  demo_profile: "Demo profile",
  demo_label: "Profile label",
};

const OMIT_PROFILE_DETAIL_KEYS = new Set(["id_verified", "id_verification_status"]);

function startCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function primitiveToText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return null;
}

function getObjectSummary(value: Record<string, unknown>) {
  const name = primitiveToText(value.name);
  const contact = primitiveToText(value.contact);
  if (name && contact) return `${name} (${contact})`;
  if (name) return name;
  if (contact) return contact;
  return null;
}

function mapProfileDetails(details: Record<string, unknown>): ProfileDetailItem[] {
  const items: ProfileDetailItem[] = [];
  const seen = new Set<string>();

  const pushItem = (path: string, rawValue: unknown) => {
    if (seen.has(path)) return;
    const value = primitiveToText(rawValue);
    if (!value) return;
    const leaf = path.split(".").pop() || path;
    const label = PROFILE_DETAIL_LABELS[path] || PROFILE_DETAIL_LABELS[leaf] || startCase(leaf);
    items.push({ key: path, label, value });
    seen.add(path);
  };

  const visit = (input: Record<string, unknown>, prefix = "") => {
    Object.entries(input).forEach(([key, raw]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (OMIT_PROFILE_DETAIL_KEYS.has(key) || OMIT_PROFILE_DETAIL_KEYS.has(path)) {
        return;
      }
      if (raw == null) return;

      if (Array.isArray(raw)) {
        if (raw.length === 0) return;
        const primitiveItems = raw
          .map((entry) => primitiveToText(entry))
          .filter((entry): entry is string => Boolean(entry));
        if (primitiveItems.length === raw.length) {
          pushItem(path, primitiveItems.join(", "));
          return;
        }
        const objectItems = raw
          .map((entry) =>
            typeof entry === "object" && entry !== null
              ? getObjectSummary(entry as Record<string, unknown>)
              : null
          )
          .filter((entry): entry is string => Boolean(entry));
        if (objectItems.length > 0) {
          pushItem(path, objectItems.join(", "));
        }
        return;
      }

      const primitive = primitiveToText(raw);
      if (primitive) {
        pushItem(path, primitive);
        return;
      }

      if (typeof raw === "object") {
        visit(raw as Record<string, unknown>, path);
      }
    });
  };

  visit(details);
  return items;
}

const formatLastActive = (value?: string | null) => {
  if (!value) return "Active recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Active recently";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 10) return "Active now";
  if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  return `Active ${date.toLocaleDateString()}`;
};

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      const res = await apiFetch(`/users/${params.id}`, { token: accessToken });
      if (res.ok) {
        setProfile(await res.json());
      }
      setLoading(false);
    }
    loadProfile();
  }, [accessToken, params.id]);

  if (!accessToken) {
    return (
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-700">Sign in to view profiles.</p>
        <Link href="/auth/login" className="text-sm text-blue-600">
          Go to sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto h-64 w-full max-w-3xl animate-pulse rounded-none bg-slate-200 sm:rounded-3xl" />
    );
  }

  if (!profile) {
    return (
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-700">User not found.</p>
        <Button variant="outline" className="mt-2" onClick={() => router.back()}>
          Back
        </Button>
      </div>
    );
  }

  const details = profile.profile_details || {};
  const photos = profile.profile_media?.photos || [];
  const photoVerified = Boolean(profile.profile_media?.photo_verified);
  const idVerified = Boolean((profile.profile_details as Record<string, unknown> | null)?.id_verified);
  const detailItems = mapProfileDetails(details as Record<string, unknown>);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
        <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
          <Link href={`/groups?creator_id=${profile.id}`}>View user groups</Link>
        </Button>
      </div>

      <div className="rounded-none border-0 bg-white p-6 sm:rounded-3xl sm:border sm:border-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          {profile.profile_image_url ? (
            <SignedImage
              src={profile.profile_image_url}
              alt={profile.full_name || "User profile"}
              className="h-20 w-20 rounded-2xl object-cover"
            />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-slate-100" />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {profile.full_name || profile.username || "User"}
            </h1>
            {profile.username ? (
              <p className="text-sm text-slate-500">@{profile.username}</p>
            ) : null}
            <p className="text-xs text-slate-500">
              {profile.verification_status === "verified" ? "Verified" : "Not verified"}
            </p>
            {photoVerified || idVerified ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {photoVerified ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Photo verified
                  </span>
                ) : null}
                {idVerified ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    ID verified
                  </span>
                ) : null}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">{formatLastActive(profile.last_active_at)}</p>
          </div>
        </div>
        {profile.bio ? <p className="mt-4 text-sm text-slate-600">{profile.bio}</p> : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="text-xs uppercase text-slate-400">Basics</p>
            <p className="mt-2 text-sm text-slate-700">
              Age: {profile.age ?? "n/a"} | Gender: {profile.gender ?? "n/a"}
            </p>
            <p className="text-sm text-slate-700">
              Orientation: {profile.sexual_orientation ?? "n/a"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="text-xs uppercase text-slate-400">Location</p>
            <p className="mt-2 text-sm text-slate-700">
              {profile.location_city || "City"} {profile.location_country || ""}
            </p>
          </div>
        </div>
        {profile.interests && profile.interests.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.interests.map((interest) => (
              <span
                key={interest}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
              >
                {interest}
              </span>
            ))}
          </div>
        ) : null}
        {profile.badges && profile.badges.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {photos.length > 0 ? (
        <div className="rounded-none border-0 bg-white p-6 sm:rounded-3xl sm:border sm:border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Photos</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {photos.map((photo) => {
              const thumbUrl = getProfilePhotoThumb(photo, profile.profile_media, true);
              return (
                <SignedImage
                  key={photo}
                  src={thumbUrl || photo}
                  alt="Profile"
                  onClick={() => setPreviewPhoto(photo)}
                  className="h-40 w-full cursor-zoom-in rounded-2xl object-cover"
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {previewPhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(event) => event.stopPropagation()}
          >
            <SignedImage
              src={previewPhoto}
              alt="Full size profile"
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
            />
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-lg font-semibold text-white hover:bg-rose-700"
              aria-label="Close"
            >
              x
            </button>
          </div>
        </div>
      ) : null}

      {detailItems.length > 0 ? (
        <div className="rounded-none border-0 bg-white p-6 sm:rounded-3xl sm:border sm:border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Profile details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {detailItems.map((item) => (
              <div key={item.key} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm text-slate-700 break-words">{item.value}</p>
              </div>
            ))}
          </div>
          {Boolean((details as Record<string, unknown>).demo_profile) ? (
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-600">
              Demo profile
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
