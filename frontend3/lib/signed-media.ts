"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type CacheEntry = {
  url: string;
  expiresAt: number;
};

const SIGNED_URL_CACHE = new Map<string, CacheEntry>();

const STORAGE_MARKER = "/api/v1/storage/";

function extractStorageKey(rawUrl: string) {
  const index = rawUrl.indexOf(STORAGE_MARKER);
  if (index === -1) return null;
  return rawUrl.slice(index + STORAGE_MARKER.length);
}

function readCache(storageKey: string) {
  const entry = SIGNED_URL_CACHE.get(storageKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    SIGNED_URL_CACHE.delete(storageKey);
    return null;
  }
  return entry.url;
}

export function useSignedMediaUrl(rawUrl?: string | null) {
  const { accessToken } = useAuth();
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const value = (rawUrl || "").trim();
    if (!value) {
      setResolvedUrl(null);
      return;
    }

    const storageKey = extractStorageKey(value);
    if (!storageKey) {
      setResolvedUrl(resolveMediaUrl(value));
      return;
    }

    const cached = readCache(storageKey);
    if (cached) {
      setResolvedUrl(cached);
      return;
    }

    if (!accessToken) {
      setResolvedUrl(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    (async () => {
      try {
        const res = await apiFetch(`/storage/signed/${storageKey}`, { token: accessToken });
        if (!res.ok) {
          setResolvedUrl(resolveMediaUrl(value));
          return;
        }
        const data: { signed_url?: string; expires_in?: number } = await res.json();
        const signedUrl = data.signed_url || "";
        if (!signedUrl) {
          setResolvedUrl(resolveMediaUrl(value));
          return;
        }
        const expiresIn = Number(data.expires_in) || 0;
        const expiresAt = Date.now() + Math.max(expiresIn - 60, 30) * 1000;
        SIGNED_URL_CACHE.set(storageKey, { url: signedUrl, expiresAt });
        if (requestIdRef.current === requestId) {
          setResolvedUrl(signedUrl);
        }
      } catch {
        setResolvedUrl(resolveMediaUrl(value));
      }
    })();
  }, [accessToken, rawUrl]);

  return resolvedUrl;
}
