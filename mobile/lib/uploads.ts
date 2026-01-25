export type UploadAsset = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
};

const guessMimeType = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4a")) return "audio/m4a";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
};

export const buildFormFile = ({ uri, name, mimeType }: UploadAsset) => {
  const fallbackName = uri.split("/").pop() || `upload-${Date.now()}`;
  const safeName = name || fallbackName;
  const type = mimeType || guessMimeType(safeName);
  return {
    uri,
    name: safeName,
    type,
  };
};
