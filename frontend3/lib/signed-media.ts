"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type CacheEntry = {
  url: string;
  expiresAt: number;
};

const SIGNED_URL_CACHE = new Map<string, CacheEntry>();
const PERSISTED_CACHE_KEY = "signedMediaCache:v1";
const MAX_PERSISTED_ENTRIES = 200;
let persistedLoaded = false;

type PersistedEntry = CacheEntry & { updatedAt: number };
type PersistedCache = Record<string, PersistedEntry>;

const STORAGE_MARKER = "/api/v1/storage/";

function extractStorageKey(rawUrl: string) {
  const index = rawUrl.indexOf(STORAGE_MARKER);
  if (index === -1) return null;
  return rawUrl.slice(index + STORAGE_MARKER.length);
}

function loadPersistedCache() {
  if (persistedLoaded || typeof window === "undefined") return;
  persistedLoaded = true;
  try {
    const raw = localStorage.getItem(PERSISTED_CACHE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as PersistedCache;
    const now = Date.now();
    Object.entries(data).forEach(([key, entry]) => {
      if (entry.expiresAt > now) {
        SIGNED_URL_CACHE.set(key, { url: entry.url, expiresAt: entry.expiresAt });
      }
    });
  } catch {
    // ignore cache parse errors
  }
}

function persistCacheEntry(storageKey: string, entry: CacheEntry) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PERSISTED_CACHE_KEY);
    const data = (raw ? (JSON.parse(raw) as PersistedCache) : {}) as PersistedCache;
    const now = Date.now();
    data[storageKey] = { ...entry, updatedAt: now };

    // prune expired
    Object.keys(data).forEach((key) => {
      if (data[key].expiresAt <= now) {
        delete data[key];
      }
    });

    const keys = Object.keys(data);
    if (keys.length > MAX_PERSISTED_ENTRIES) {
      keys
        .sort((a, b) => data[b].updatedAt - data[a].updatedAt)
        .slice(MAX_PERSISTED_ENTRIES)
        .forEach((key) => delete data[key]);
    }

    localStorage.setItem(PERSISTED_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore cache write errors
  }
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
    loadPersistedCache();
    const commitResolvedUrl = (next: string | null) => {
      Promise.resolve().then(() => setResolvedUrl(next));
    };
    const value = (rawUrl || "").trim();
    if (!value) {
      commitResolvedUrl(null);
      return;
    }

    const storageKey = extractStorageKey(value);
    if (!storageKey) {
      commitResolvedUrl(resolveMediaUrl(value));
      return;
    }

    const cached = readCache(storageKey);
    if (cached) {
      commitResolvedUrl(cached);
      return;
    }

    if (!accessToken) {
      commitResolvedUrl(null);
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
        persistCacheEntry(storageKey, { url: signedUrl, expiresAt });
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
