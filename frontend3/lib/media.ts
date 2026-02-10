export type ProfileMedia = {
  photos?: string[] | null;
  photo_thumbs?: Record<string, string> | null;
  profile_image_thumb_url?: string | null;
};

export function getProfilePhotoThumb(
  photoUrl: string | null | undefined,
  profileMedia?: Record<string, unknown> | null,
  preferThumb = false
) {
  if (!photoUrl) return "";
  if (!preferThumb || !profileMedia) return photoUrl;
  const rawThumbs = (profileMedia as ProfileMedia).photo_thumbs;
  if (rawThumbs && typeof rawThumbs === "object") {
    const thumb = (rawThumbs as Record<string, string>)[photoUrl];
    if (thumb) return thumb;
  }
  return photoUrl;
}
