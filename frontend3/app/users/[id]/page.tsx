"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

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
  } | null;
  profile_details?: Record<string, unknown> | null;
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
        <Link href="/notifications" className="text-sm text-blue-600">
          Back to notifications
        </Link>
      </div>
    );
  }

  const details = profile.profile_details || {};
  const photos = profile.profile_media?.photos || [];
  const photoVerified = Boolean(profile.profile_media?.photo_verified);
  const idVerified = Boolean((profile.profile_details as Record<string, unknown> | null)?.id_verified);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/notifications" className="text-sm text-blue-600">
          &lt;- Back to notifications
        </Link>
        <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
          <Link href={`/groups?creator_id=${profile.id}`}>View user groups</Link>
        </Button>
      </div>

      <div className="rounded-none border-0 bg-white p-6 sm:rounded-3xl sm:border sm:border-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          {profile.profile_image_url ? (
            <img
              src={resolveMediaUrl(profile.profile_image_url)}
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
            {photos.map((photo) => (
              <img
                key={photo}
                src={resolveMediaUrl(photo)}
                alt="Profile"
                onClick={() => setPreviewPhoto(photo)}
                className="h-40 w-full cursor-zoom-in rounded-2xl object-cover"
              />
            ))}
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
            <img
              src={resolveMediaUrl(previewPhoto)}
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

      {Object.keys(details).length > 0 ? (
        <div className="rounded-none border-0 bg-white p-6 sm:rounded-3xl sm:border sm:border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Profile details</h2>
          {Array.isArray((details as Record<string, unknown>).availability_windows) ? (
            <p className="mt-3 text-sm text-slate-600">
              Availability:{" "}
              {((details as Record<string, unknown>).availability_windows as string[]).join(", ")}
            </p>
          ) : null}
          <pre className="mt-3 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
            {JSON.stringify(details, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
