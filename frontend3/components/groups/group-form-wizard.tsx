"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form"; // Removed Resolver import as it's not needed directly
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod"; 
import { groupSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cropImageToAspect } from "@/lib/image-processing";

// 1. Generate the type (Keep this for use in onSubmit)
type GroupFormData = z.infer<typeof groupSchema>;

export default function GroupFormWizard() {
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [pendingMedia, setPendingMedia] = useState<File[]>([]);
  const [pendingMediaIndex, setPendingMediaIndex] = useState(0);
  const [pendingMediaPreview, setPendingMediaPreview] = useState<string | null>(null);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const { accessToken, user } = useAuth();
  const router = useRouter();
  
  // 2. FIX: Remove <GroupFormData> generic here. 
  // Let the resolver strictly infer the types for you.
  const { register, handleSubmit, trigger, formState: { errors } } = useForm({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      category: "friendship",
      min_participants: 1,
      offerings: "",
      expectations: "",
      requirements: [
        {
          applies_to: "all",
          min_age: 18,
          max_age: 99,
          consent_flags: {},
        },
      ],
    }
  });

  const inputClass = (hasError: boolean) =>
    `w-full rounded-2xl border p-3 text-sm outline-none focus:ring-2 ${
      hasError ? "border-rose-400 focus:ring-rose-200" : "border-slate-200 focus:ring-emerald-200"
    }`;

  useEffect(() => {
    if (pendingMedia.length === 0) {
      setPendingMediaPreview(null);
      return;
    }
    const file = pendingMedia[pendingMediaIndex];
    if (!file) {
      setPendingMediaPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPendingMediaPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingMedia, pendingMediaIndex]);

  useEffect(() => {
    if (mediaFiles.length === 0) {
      setMediaPreviews([]);
      return;
    }
    const urls = mediaFiles.map((file) => URL.createObjectURL(file));
    setMediaPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaFiles]);

  const pendingFile = pendingMedia[pendingMediaIndex];
  const pendingIsImage = Boolean(pendingFile?.type.startsWith("image/"));

  const handleSelectMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) return;
    setPendingMedia(selected);
    setPendingMediaIndex(0);
    event.target.value = "";
  };

  const advancePendingMedia = () => {
    setPendingMediaIndex((prev) => {
      const next = prev + 1;
      if (next >= pendingMedia.length) {
        setPendingMedia([]);
        return 0;
      }
      return next;
    });
  };

  const handleAddMedia = async (mode: "original" | "crop") => {
    if (!pendingFile) return;
    try {
      const fileToAdd =
        mode === "crop" && pendingIsImage ? await cropImageToAspect(pendingFile) : pendingFile;
      setMediaFiles((prev) => [...prev, fileToAdd]);
      advancePendingMedia();
    } catch {
      setSubmitError("Unable to crop this media. Try another file.");
    }
  };

  const handleRemoveMediaFile = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSkipMedia = () => {
    if (!pendingFile) return;
    advancePendingMedia();
  };

  const handleCancelPendingMedia = () => {
    setPendingMedia([]);
    setPendingMediaIndex(0);
    setPendingMediaPreview(null);
  };

  // 3. Update onSubmit. 
  // Since we removed the generic above, we just type the data argument directly.
  const onSubmit = async (data: GroupFormData) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!accessToken) {
      setSubmitError("Please sign in before publishing a group.");
      return;
    }
    if (!user?.profile_image_url) {
      setSubmitError("Upload a profile photo before publishing a group.");
      return;
    }
    setIsSubmitting(true);
    try {
      const coverIndex = mediaFiles.findIndex((file) => file.type.startsWith("image/"));
      if (coverIndex < 0) {
        setSubmitError("Upload at least one photo before publishing a group.");
        setIsSubmitting(false);
        return;
      }
      const coverFile = mediaFiles[coverIndex];

      const normalizedTags =
        typeof data.tags === "string"
          ? data.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
          : data.tags;
      const normalizedOfferings =
        typeof data.offerings === "string"
          ? data.offerings.split(",").map((item) => item.trim()).filter(Boolean)
          : data.offerings;
      if (!normalizedOfferings || normalizedOfferings.length < 2) {
        setSubmitError("List at least two offers before publishing.");
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          ...data,
          offerings: normalizedOfferings,
          expectations: data.expectations?.trim() || undefined,
          tags: normalizedTags,
          creator_intro_video_url: data.creator_intro_video_url || undefined,
        })
      );
      formData.append("cover", coverFile);

      const res = await apiFetch("/groups/", {
        method: "POST",
        body: formData,
        token: accessToken || undefined,
      });
      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
          ? await res.json().catch(() => null)
          : null;
        const text = payload ? "" : await res.text().catch(() => "");
        const detail =
          payload?.detail ||
          payload?.message ||
          text ||
          `Unable to publish group (status ${res.status}).`;
        throw new Error(detail);
      }
      const createdGroup = await res.json();
      const remainingMedia = mediaFiles.filter((_, index) => index !== coverIndex);
      if (remainingMedia.length > 0) {
        for (const file of remainingMedia) {
          const formData = new FormData();
          formData.append("file", file);
          const uploadRes = await apiFetch(`/groups/${createdGroup.id}/media`, {
            method: "POST",
            body: formData,
            token: accessToken,
          });
          if (!uploadRes.ok) {
            const message = await uploadRes.text().catch(() => "");
            throw new Error(message || "Media upload failed.");
          }
        }
      }
      setSubmitSuccess("Group published successfully.");
      router.push("/groups");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unable to publish group.";
      const friendly =
        raw.toLowerCase().includes("failed to fetch") || raw.toLowerCase().includes("load failed")
          ? "Network error: unable to reach the server. Check your connection or API URL."
          : raw;
      setSubmitError(friendly);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = () => {
    setSubmitError("Please complete all required fields before publishing.");
  };

  const handleNext = async () => {
    setSubmitError(null);
    const fieldsByStep: Record<number, string[]> = {
      1: ["title", "description", "category"],
      2: ["activity_type", "location"],
      3: ["cost_type", "max_participants"],
      4: ["requirements.0.applies_to", "requirements.0.min_age", "requirements.0.max_age"],
    };
    const fields = fieldsByStep[step] || [];
    const ok = await trigger(fields as any);
    if (!ok) {
      setSubmitError("Please complete all required fields before continuing.");
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      className="mx-auto max-w-2xl rounded-none border-0 bg-white p-6 shadow-none sm:rounded-[32px] sm:border sm:border-white/70 sm:bg-white/90 sm:p-8 sm:shadow-2xl sm:shadow-slate-900/10"
    >
      <div className="mb-8 flex justify-between">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`mx-1 h-2 flex-1 rounded-full ${
              step >= i ? "bg-emerald-500" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">The basics</h2>
          <input 
            {...register("title")} 
            placeholder="Trip Title" 
            className={inputClass(Boolean(errors.title))}
            aria-invalid={Boolean(errors.title)}
          />
          {/* TypeScript works perfectly here now */}
          {errors.title && (
            <p className="text-red-500 text-sm">
              {errors.title.message as string} 
            </p>
          )}
          
          <textarea 
            {...register("description")} 
            placeholder="Describe the activity..." 
            className={`h-32 ${inputClass(Boolean(errors.description))}`}
            aria-invalid={Boolean(errors.description)}
          />
          {errors.description && (
             <p className="text-red-500 text-sm">
               {errors.description.message as string}
             </p>
          )}
          <div>
            <select
              {...register("category")}
              className={inputClass(Boolean(errors.category))}
              aria-invalid={Boolean(errors.category)}
            >
              <option value="mutual_benefits">Mutual benefits</option>
              <option value="friendship">Friendship</option>
              <option value="dating">Dating (2 people)</option>
            </select>
            {errors.category && (
              <p className="text-red-500 text-sm">{errors.category.message as string}</p>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Details</h2>
          <input
            {...register("activity_type")}
            placeholder="Activity type (dinner, club, trip)"
            className={inputClass(Boolean(errors.activity_type))}
            aria-invalid={Boolean(errors.activity_type)}
          />
          {errors.activity_type && (
            <p className="text-red-500 text-sm">{errors.activity_type.message as string}</p>
          )}
          <input
            {...register("location")}
            placeholder="Location"
            className={inputClass(Boolean(errors.location))}
            aria-invalid={Boolean(errors.location)}
          />
          {errors.location && (
            <p className="text-red-500 text-sm">{errors.location.message as string}</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="number"
              step="any"
              {...register("location_lat")}
              placeholder="Location latitude (optional)"
              className={inputClass(Boolean(errors.location_lat))}
            />
            <input
              type="number"
              step="any"
              {...register("location_lng")}
              placeholder="Location longitude (optional)"
              className={inputClass(Boolean(errors.location_lng))}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Cost & capacity</h2>
          <select
            {...register("cost_type")}
            className={inputClass(Boolean(errors.cost_type))}
            aria-invalid={Boolean(errors.cost_type)}
            defaultValue="free"
          >
            <option value="free">Free</option>
            <option value="shared">Shared Cost</option>
            <option value="fully_paid">Fully paid by creator</option>
            <option value="custom">Custom</option>
          </select>
          {errors.cost_type && (
            <p className="text-red-500 text-sm">{errors.cost_type.message as string}</p>
          )}
          <input
            type="number"
            {...register("max_participants")}
            placeholder="Max participants"
            className={inputClass(Boolean(errors.max_participants))}
            aria-invalid={Boolean(errors.max_participants)}
          />
          {errors.max_participants && (
            <p className="text-red-500 text-sm">{errors.max_participants.message as string}</p>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Requirements</h2>
          <select
            {...register("requirements.0.applies_to")}
            className={inputClass(Boolean((errors as any).requirements?.[0]?.applies_to))}
          >
            <option value="all">All</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="number"
              {...register("requirements.0.min_age")}
              placeholder="Minimum age"
              className={inputClass(Boolean((errors as any).requirements?.[0]?.min_age))}
            />
            <input
              type="number"
              {...register("requirements.0.max_age")}
              placeholder="Maximum age"
              className={inputClass(Boolean((errors as any).requirements?.[0]?.max_age))}
            />
          </div>
          {(errors as any).requirements?.[0]?.min_age ? (
            <p className="text-red-500 text-sm">
              {(errors as any).requirements?.[0]?.min_age?.message as string}
            </p>
          ) : null}
          {(errors as any).requirements?.[0]?.max_age ? (
            <p className="text-red-500 text-sm">
              {(errors as any).requirements?.[0]?.max_age?.message as string}
            </p>
          ) : null}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Story & media</h2>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Offers: list at least two things you provide. Expectations: optional guidelines for the
            group.
          </div>
          <input
            {...register("offerings")}
            placeholder="Offers (comma separated) - at least 2"
            className={inputClass(Boolean(errors.offerings))}
            aria-invalid={Boolean(errors.offerings)}
          />
          {errors.offerings && (
            <p className="text-red-500 text-sm">{errors.offerings.message as string}</p>
          )}
          <textarea
            {...register("expectations")}
            placeholder="Expectations (optional)"
            className={`h-24 ${inputClass(Boolean(errors.expectations))}`}
          />
          <input
            {...register("tags")}
            placeholder="Tags (comma separated)"
            className={inputClass(Boolean(errors.tags))}
          />
          <textarea
            {...register("creator_intro")}
            placeholder="Short intro from the creator"
            className={`h-24 ${inputClass(Boolean(errors.creator_intro))}`}
          />
          <input
            {...register("creator_intro_video_url")}
            placeholder="Creator intro video URL (optional)"
            className={inputClass(Boolean(errors.creator_intro_video_url))}
          />
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              Group cover photo (required) and media
            </label>
            <p className="text-xs text-slate-500">
              Add at least one photo. The first photo will be used as the cover.
            </p>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleSelectMedia}
              ref={mediaInputRef}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => mediaInputRef.current?.click()}
            >
              Choose media
            </Button>
            {mediaFiles.length ? (
              <div className="space-y-2 text-xs text-slate-500">
                <p>{mediaFiles.length} files selected</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {mediaFiles.map((file, index) => {
                    const preview = mediaPreviews[index];
                    const isImage = file.type.startsWith("image/");
                    return (
                      <div
                        key={`${file.name}-${index}`}
                        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white"
                      >
                        {isImage && preview ? (
                          <img
                            src={preview}
                            alt={file.name || `Media ${index + 1}`}
                            className="h-32 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-32 w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
                            Video selected
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveMediaFile(index)}
                          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
                          aria-label="Remove media"
                        >
                          x
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {pendingMediaPreview ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">
                  Preview {pendingMediaIndex + 1} of {pendingMedia.length}
                </p>
                {pendingIsImage ? (
                  <img
                    src={pendingMediaPreview}
                    alt="Pending media"
                    className="mt-3 h-52 w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="mt-3 flex h-40 w-full items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-500">
                    Video selected
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => handleAddMedia("original")}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Add to group
                  </Button>
                  {pendingIsImage ? (
                    <Button type="button" variant="outline" onClick={() => handleAddMedia("crop")}>
                      Crop & add
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSkipMedia}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelPendingMedia}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Cancel all
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

        <div className="mt-8 flex flex-wrap justify-between gap-3">
        {step > 1 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </Button>
        )}
        
        {step < 5 ? (
          <Button 
            type="button" 
            className="ml-auto rounded-full bg-slate-900 text-white hover:bg-slate-800" 
            onClick={handleNext}
          >
            Next
          </Button>
        ) : (
          <Button 
            type="submit" 
            className="ml-auto rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Publishing..." : "Publish Group"}
          </Button>
        )}
      </div>
      {submitError ? (
        <p className="mt-4 text-sm text-red-600">
          {submitError}
          {submitError.includes("profile photo") ? (
            <>
              {" "}
              <a className="text-blue-600 underline" href="/profile">
                Upload now
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {submitSuccess ? (
        <p className="mt-4 text-sm text-emerald-600">{submitSuccess}</p>
      ) : null}
    </form>
  );
}
