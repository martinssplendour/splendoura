"use client";

import { Image, type ImageProps } from "react-native";
import { Video, type VideoProps } from "expo-av";

import { useSignedMediaUrl } from "@/lib/signed-media";

type SignedImageProps = Omit<ImageProps, "source"> & {
  uri?: string | null;
  fallbackSource?: ImageProps["source"];
};

export function SignedImage({ uri, fallbackSource, ...props }: SignedImageProps) {
  const signedUri = useSignedMediaUrl(uri);
  if (!signedUri) {
    return fallbackSource ? <Image {...props} source={fallbackSource} /> : null;
  }
  return <Image {...props} source={{ uri: signedUri }} />;
}

type SignedVideoProps = Omit<VideoProps, "source"> & {
  uri?: string | null;
};

export function SignedVideo({ uri, ...props }: SignedVideoProps) {
  const signedUri = useSignedMediaUrl(uri);
  if (!signedUri) return null;
  return <Video {...props} source={{ uri: signedUri }} />;
}
