export const isImageFile = (file: File) => file.type.startsWith("image/");

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to load image."));
    };
    img.src = url;
  });

export const cropImageToAspect = async (file: File, aspect = 4 / 5) => {
  if (!isImageFile(file)) return file;
  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return file;

  let cropWidth = width;
  let cropHeight = width / aspect;
  if (cropHeight > height) {
    cropHeight = height;
    cropWidth = height * aspect;
  }
  const sx = Math.max((width - cropWidth) / 2, 0);
  const sy = Math.max((height - cropHeight) / 2, 0);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropWidth);
  canvas.height = Math.round(cropHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(
    image,
    sx,
    sy,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Crop failed."))),
      "image/jpeg",
      0.9
    );
  });
  const nextName = file.name.replace(/\.[^/.]+$/, "");
  return new File([blob], `${nextName}-cropped.jpg`, { type: blob.type });
};
