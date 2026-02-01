"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useSignedMediaUrl } from "@/lib/signed-media";

type ImageProps = ComponentPropsWithoutRef<"img"> & {
  src?: string | null;
};

type AudioProps = ComponentPropsWithoutRef<"audio"> & {
  src?: string | null;
};

type VideoProps = ComponentPropsWithoutRef<"video"> & {
  src?: string | null;
};

type LinkProps = ComponentPropsWithoutRef<"a"> & {
  src?: string | null;
};

export function SignedImage({ src, ...props }: ImageProps) {
  const signedUrl = useSignedMediaUrl(src);
  const fallbackClassName = [props.className, "bg-slate-200"].filter(Boolean).join(" ");
  const resolvedSrc =
    signedUrl ||
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  return <img {...props} className={fallbackClassName} src={resolvedSrc} />;
}

export function SignedAudio({ src, ...props }: AudioProps) {
  const signedUrl = useSignedMediaUrl(src);
  if (!signedUrl) return null;
  return <audio {...props} src={signedUrl} />;
}

export function SignedVideo({ src, ...props }: VideoProps) {
  const signedUrl = useSignedMediaUrl(src);
  if (!signedUrl) return null;
  return <video {...props} src={signedUrl} />;
}

export function SignedLink({ src, children, ...props }: LinkProps) {
  const signedUrl = useSignedMediaUrl(src);
  if (!signedUrl) return null;
  return (
    <a {...props} href={signedUrl}>
      {children}
    </a>
  );
}
