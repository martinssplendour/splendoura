"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const promptDefaults = ["", "", ""];

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function OnboardingPage() {
  const router = useRouter();
  const { accessToken, user, refreshSession } = useAuth();
  const [step, setStep] = useState(0);
  const [bio, setBio] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [interests, setInterests] = useState("");
  const [prompts, setPrompts] = useState<string[]>([...promptDefaults]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
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
    if (user?.profile_image_url || photoFile) count += 1;
    return count;
  }, [bio, interests, locationCity, photoFile, prompts, user?.profile_image_url]);

  const progress = Math.round((completedCount / 5) * 100);

  const handleSkip = useCallback(() => {
    localStorage.setItem("onboarding_skipped", "1");
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
  }, [accessToken, bio, blockNudity, interests, locationCity, locationCountry, prompts, refreshSession, user?.profile_details, user?.profile_media]);

  const handleUploadPhoto = useCallback(async () => {
    if (!accessToken || !photoFile) return;
    setUploading(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", photoFile);
      const res = await apiFetch("/users/me/photo", {
        method: "POST",
        token: accessToken,
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Photo upload failed.");
      }
      setPhotoFile(null);
      await refreshSession();
      setStatus("Photo uploaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Photo upload failed.";
      setStatus(message);
    } finally {
      setUploading(false);
    }
  }, [accessToken, photoFile, refreshSession]);

  const handleNext = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;
    if (step >= 3) {
      localStorage.removeItem("onboarding_skipped");
      router.replace("/groups");
      return;
    }
    setStep((prev) => prev + 1);
  }, [handleSave, router, step]);

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-600">Sign in to continue onboarding.</p>
        <Button asChild className="mt-4 bg-blue-600 text-white hover:bg-blue-700">
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Finish setting up Splendoura</h1>
          <p className="text-xs text-slate-500">Step {step + 1} of 4 - {progress}% complete</p>
        </div>
        <button type="button" className="text-xs font-semibold text-blue-600" onClick={handleSkip}>
          Skip for now
        </button>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
      </div>

      {step === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Tell us about you</h2>
          <label className="text-sm font-semibold text-slate-700">
            Bio
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="Share a quick intro"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              City
              <input
                value={locationCity}
                onChange={(event) => setLocationCity(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Country
              <input
                value={locationCountry}
                onChange={(event) => setLocationCountry(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={blockNudity}
              onChange={(event) => setBlockNudity(event.target.checked)}
            />
            Block nudity in chat
          </label>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Interests</h2>
          <input
            value={interests}
            onChange={(event) => setInterests(event.target.value)}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            placeholder="Travel, brunch, nightlife"
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Prompts</h2>
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
                placeholder="Add a fun prompt"
              />
            </label>
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Add a photo</h2>
          {user?.profile_image_url ? (
            <img
              src={resolveMediaUrl(user.profile_image_url)}
              alt="Profile"
              className="h-48 w-full rounded-2xl object-cover"
            />
          ) : null}
          {photoFile ? (
            <p className="text-xs text-slate-500">Selected: {photoFile.name}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            />
            <Button
              onClick={handleUploadPhoto}
              disabled={!photoFile || uploading}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      ) : null}

      {status ? <p className="text-sm text-slate-600">{status}</p> : null}

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={handleSkip}>
          Skip for now
        </Button>
        <Button onClick={handleNext} disabled={saving}>
          {step >= 3 ? (saving ? "Saving..." : "Finish") : saving ? "Saving..." : "Next"}
        </Button>
      </div>
    </div>
  );
}
