// app/groups/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import SwipeDeck from "@/components/groups/swipe-deck";
import SwipeDeckSkeleton from "@/components/groups/loading-skeleton";
import ProfileSwipeDeck, { ProfileMatch } from "@/components/profiles/profile-swipe-deck";
import FiltersSidebar, { GroupFilters } from "@/components/groups/filters-sidebar";
import FiltersDrawer from "@/components/groups/filters-drawer";
import type { SwipeGroup } from "@/components/groups/types";
import FindMyTypeModal from "@/components/find-my-type-modal";

const DEFAULT_FILTERS: GroupFilters = {
  location: "",
  activity: "",
  minAge: "",
  maxAge: "",
  distance: "",
  cost: "",
  gender: "",
  creatorVerified: false,
};
const INITIAL_PAGE_SIZE = 50;
const PREFETCH_PAGE_SIZE = 200;
const PREFETCH_THRESHOLD = 20;
const TABS = ["mutual_benefits", "friendship", "dating", "profiles"] as const;
type TabKey = (typeof TABS)[number];

export default function BrowseGroups() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const creatorId = searchParams.get("creator_id");
  const filtersParam = searchParams.get("filters");
  const findTypeParam = searchParams.get("findType");
  const tabParam = searchParams.get("tab");
  const [groups, setGroups] = useState<SwipeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filters, setFilters] = useState<GroupFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState("smart");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [findTypeOpen, setFindTypeOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<TabKey>(() => {
    const tab = tabParam && (TABS as readonly string[]).includes(tabParam) ? (tabParam as TabKey) : "friendship";
    return tab;
  });
  const [profileMatches, setProfileMatches] = useState<ProfileMatch[]>([]);
  const [profileRequestId, setProfileRequestId] = useState<number | null>(null);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const { accessToken, user } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 639px)").matches) {
      setSort("recent");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setFilters((prev) => {
      const discovery = (user.discovery_settings as Record<string, unknown>) || {};
      const next = { ...prev };
      if (!prev.gender) {
        const genders = discovery.genders as string[] | undefined;
        const hasMale = genders?.includes("male");
        const hasFemale = genders?.includes("female");
        if (hasMale && hasFemale) {
          next.gender = "both";
        } else if (hasFemale) {
          next.gender = "female";
        } else if (hasMale) {
          next.gender = "male";
        }
      }
      return next;
    });
  }, [user]);

  useEffect(() => {
    if (filtersParam !== "open") return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setDrawerOpen(true);
    }
  }, [filtersParam]);

  useEffect(() => {
    if (findTypeParam !== "open") return;
    setFindTypeOpen(true);
  }, [findTypeParam]);

  useEffect(() => {
    if (!tabParam) return;
    if ((TABS as readonly string[]).includes(tabParam) && tabParam !== activeCategory) {
      setActiveCategory(tabParam as TabKey);
    }
  }, [activeCategory, tabParam]);

  useEffect(() => {
    if (filtersParam === "open") return;
    setDrawerOpen(false);
  }, [filtersParam]);

  useEffect(() => {
    if (findTypeParam === "open") return;
    setFindTypeOpen(false);
  }, [findTypeParam]);

  const clearQueryFlag = useCallback(
    (key: "filters" | "findType") => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(searchParams?.toString());
      params.delete(key);
      const query = params.toString();
      router.replace(query ? `/groups?${query}` : "/groups", { scroll: false });
    },
    [router, searchParams]
  );

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      setActiveCategory(tab);
      const params = new URLSearchParams(searchParams?.toString());
      params.set("tab", tab);
      const query = params.toString();
      router.replace(query ? `/groups?${query}` : "/groups", { scroll: false });
    },
    [router, searchParams]
  );

  const baseQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (creatorId) params.set("creator_id", creatorId);
    if (filters.location.trim()) params.set("location", filters.location.trim());
    if (filters.activity.trim()) params.set("activity_type", filters.activity.trim());
    if (filters.minAge.trim()) params.set("min_age", filters.minAge.trim());
    if (filters.maxAge.trim()) params.set("max_age", filters.maxAge.trim());
    const distanceValue = Number.parseFloat(filters.distance.trim());
    if (!Number.isNaN(distanceValue) && distanceValue > 0) {
      if (user?.location_lat != null && user?.location_lng != null) {
        params.set("lat", String(user.location_lat));
        params.set("lng", String(user.location_lng));
        params.set("radius_km", String(distanceValue));
      }
    }
    if (filters.cost) params.set("cost_type", filters.cost);
    if (filters.creatorVerified) params.set("creator_verified", "true");
    if (sort) params.set("sort", sort);
    return params;
  }, [creatorId, filters, sort, user?.location_lat, user?.location_lng]);

  const groupsCacheKey = useMemo(
    () => `groups:${accessToken ? "auth" : "guest"}:${baseQueryParams.toString()}`,
    [accessToken, baseQueryParams]
  );
  const seenGroupsKey = useMemo(() => `${groupsCacheKey}:seen`, [groupsCacheKey]);

  const deckResetKey = useMemo(
    () => `${accessToken ? "auth" : "guest"}|${baseQueryParams.toString()}|${activeCategory}`,
    [accessToken, activeCategory, baseQueryParams]
  );

  const readSeenGroupIds = useCallback(() => {
    if (typeof window === "undefined") return new Set<number>();
    try {
      const raw = sessionStorage.getItem(seenGroupsKey);
      if (!raw) return new Set<number>();
      const parsed = JSON.parse(raw) as number[];
      if (!Array.isArray(parsed)) return new Set<number>();
      return new Set(parsed.filter((value) => Number.isFinite(value)));
    } catch {
      return new Set<number>();
    }
  }, [seenGroupsKey]);

  const markGroupSeen = useCallback(
    (groupId: number) => {
      if (typeof window === "undefined") return;
      const seen = readSeenGroupIds();
      if (seen.has(groupId)) return;
      seen.add(groupId);
      try {
        sessionStorage.setItem(seenGroupsKey, JSON.stringify(Array.from(seen)));
      } catch {
        // ignore
      }
    },
    [readSeenGroupIds, seenGroupsKey]
  );

  const unmarkGroupSeen = useCallback(
    (groupId: number) => {
      if (typeof window === "undefined") return;
      const seen = readSeenGroupIds();
      if (!seen.has(groupId)) return;
      seen.delete(groupId);
      try {
        sessionStorage.setItem(seenGroupsKey, JSON.stringify(Array.from(seen)));
      } catch {
        // ignore
      }
    },
    [readSeenGroupIds, seenGroupsKey]
  );

  const filterSeenGroups = useCallback(
    (items: SwipeGroup[]) => {
      const seen = readSeenGroupIds();
      if (seen.size === 0) return items;
      return items.filter((group) => !seen.has(group.id));
    },
    [readSeenGroupIds]
  );

  const fetchGroupsPage = useCallback(
    async (cursor: string | null, limit: number) => {
      const params = new URLSearchParams(baseQueryParams.toString());
      params.set("limit", String(limit));
      if (cursor) {
        params.set("cursor", cursor);
      }
      const endpoint = accessToken ? "/groups/discover" : "/groups/";
      const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
      let res = await apiFetch(url, accessToken ? { token: accessToken } : undefined);
      if ((!res.ok || res.status === 401 || res.status === 403) && accessToken) {
        const fallbackUrl = params.toString()
          ? `/groups/?${params.toString()}`
          : "/groups/";
        res = await apiFetch(fallbackUrl);
      }
      if (res.ok) {
        const data: SwipeGroup[] = await res.json();
        const next = res.headers.get("x-next-cursor");
        return { ok: true as const, data, nextCursor: next || null };
      }
      const payload = await res.json().catch(() => null);
      return { ok: false as const, error: payload?.detail || "Unable to load groups right now." };
    },
    [accessToken, baseQueryParams]
  );

  const readGroupsCache = useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(groupsCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        groups: SwipeGroup[];
        hasMore?: boolean;
        nextCursor?: string | null;
      };
      if (!Array.isArray(parsed.groups)) return null;
      return {
        groups: parsed.groups,
        hasMore: parsed.hasMore !== false,
        nextCursor: parsed.nextCursor ?? null,
      };
    } catch {
      return null;
    }
  }, [groupsCacheKey]);

  const writeGroupsCache = useCallback(
    (nextGroups: SwipeGroup[], nextHasMore: boolean, cursor: string | null) => {
      if (typeof window === "undefined") return;
      try {
        sessionStorage.setItem(
          groupsCacheKey,
          JSON.stringify({ groups: nextGroups, hasMore: nextHasMore, nextCursor: cursor })
        );
      } catch {
        // ignore cache write failures
      }
    },
    [groupsCacheKey]
  );

  useEffect(() => {
    let active = true;
    async function loadGroups() {
      setLoading(true);
      setGroupsError(null);
      const cached = readGroupsCache();
      if (cached) {
        const filtered = filterSeenGroups(cached.groups);
        setGroups(filtered);
        setHasMore(cached.hasMore);
        setNextCursor(cached.nextCursor);
        setLoading(false);
        return;
      }
      setHasMore(true);
      const result = await fetchGroupsPage(null, INITIAL_PAGE_SIZE);
      if (!active) return;
      if (result.ok) {
        const filtered = filterSeenGroups(result.data);
        setGroups(filtered);
        setHasMore(Boolean(result.nextCursor));
        setNextCursor(result.nextCursor);
        writeGroupsCache(filtered, Boolean(result.nextCursor), result.nextCursor);
      } else {
        setGroupsError(result.error);
        setGroups([]);
        setHasMore(false);
        setNextCursor(null);
      }
      setLoading(false);
    }
    loadGroups();
    return () => {
      active = false;
    };
  }, [fetchGroupsPage, filterSeenGroups, readGroupsCache, writeGroupsCache]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    const result = await fetchGroupsPage(nextCursor, PREFETCH_PAGE_SIZE);
    if (result.ok) {
      const seen = readSeenGroupIds();
      setGroups((prev) => {
        const seenIds = new Set(prev.map((group) => group.id));
        const next = result.data.filter(
          (group) => !seenIds.has(group.id) && !seen.has(group.id)
        );
        const merged = [...prev, ...next];
        writeGroupsCache(merged, Boolean(result.nextCursor), result.nextCursor);
        return merged;
      });
      setHasMore(Boolean(result.nextCursor));
      setNextCursor(result.nextCursor);
    } else if (!groupsError) {
      setGroupsError(result.error);
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [
    fetchGroupsPage,
    groupsError,
    hasMore,
    loading,
    loadingMore,
    nextCursor,
    readSeenGroupIds,
    writeGroupsCache,
  ]);

  const profileCriteria = useMemo(() => {
    const discovery = (user?.discovery_settings as Record<string, unknown>) || {};
    const criteria: { key: string; value: unknown }[] = [];
    const ageMin = discovery.age_min as number | undefined;
    const ageMax = discovery.age_max as number | undefined;
    if (ageMin != null || ageMax != null) {
      criteria.push({
        key: "age_range",
        value: {
          ...(ageMin != null ? { min: ageMin } : {}),
          ...(ageMax != null ? { max: ageMax } : {}),
        },
      });
    }
    const distance = discovery.distance_km as number | undefined;
    if (distance != null) {
      criteria.push({ key: "distance_km", value: distance });
    }
    const genders = discovery.genders as string[] | undefined;
    const filterPref = filters.gender;
    const resolvedGenders =
      filterPref === "male"
        ? ["male"]
        : filterPref === "female"
          ? ["female"]
          : filterPref === "both"
            ? ["male", "female"]
            : Array.isArray(genders)
              ? genders
              : [];
    if (resolvedGenders.length > 0) {
      criteria.push({ key: "gender", value: resolvedGenders });
    }
    return criteria;
  }, [filters.gender, user?.discovery_settings]);

  const profileCriteriaKey = useMemo(() => JSON.stringify(profileCriteria), [profileCriteria]);

  useEffect(() => {
    let active = true;
    const loadProfiles = async () => {
      if (!accessToken) {
        if (active) {
          setProfileMatches([]);
          setProfileRequestId(null);
          setProfilesError(null);
          setProfilesLoading(false);
        }
        return;
      }
      setProfilesLoading(true);
      setProfilesError(null);
      try {
        const res = await apiFetch("/match/requests", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            intent: "relationship",
            criteria: profileCriteria,
            offers: [],
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.detail || "Unable to load profiles right now.");
        }
        const data: { request?: { id: number }; results?: ProfileMatch[] } = await res.json();
        if (active) {
          setProfileMatches(data.results || []);
          setProfileRequestId(data.request?.id ?? null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load profiles right now.";
        if (active) {
          setProfilesError(message);
          setProfileMatches([]);
          setProfileRequestId(null);
        }
      } finally {
        if (active) {
          setProfilesLoading(false);
        }
      }
    };
    loadProfiles();
    return () => {
      active = false;
    };
  }, [accessToken, profileCriteriaKey]);

  const grouped = useMemo(() => {
    const buckets: Record<string, SwipeGroup[]> = {
      mutual_benefits: [],
      friendship: [],
      dating: [],
    };
    groups.forEach((group) => {
      const key = group.category || "friendship";
      if (buckets[key]) {
        buckets[key].push(group);
      } else {
        buckets.friendship.push(group);
      }
    });
    return buckets;
  }, [groups]);

  const categoryConfig = [
    {
      id: "mutual_benefits" as const,
      label: "Mutual benefits",
      description: "Intimate experiences with mutual financial benefit.",
    },
    {
      id: "friendship" as const,
      label: "Friendship",
      description: "Meet new people and hang out as friends.",
    },
    {
      id: "dating" as const,
      label: "Dating",
      description: "Two-person date planning groups.",
    },
    {
      id: "profiles" as const,
      label: "Profiles",
      description: "Swipe through profile matches based on your discovery filters.",
    },
  ];

  return (
    <div className="relative -mt-4 flex h-full min-h-0 flex-col overflow-hidden bg-white px-4 pb-4 pt-2 sm:mt-0 sm:rounded-[40px] sm:border sm:border-white/70 sm:bg-white/70 sm:p-10 sm:shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#e2f4ff_0%,_#f8fbff_38%,_#fff1ea_100%)] opacity-80" />
      <div className="pointer-events-none absolute inset-x-10 top-10 h-24 rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.7)_0%,_rgba(255,255,255,0)_70%)] blur-2xl" />

      <div className="relative grid min-h-0 flex-1 gap-4 sm:gap-8 lg:grid-cols-[minmax(0,16.25rem)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <FiltersSidebar
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters(DEFAULT_FILTERS)}
            showDistanceHelper={Boolean(
              filters.distance.trim() && (user?.location_lat == null || user?.location_lng == null)
            )}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-8">
          {groupsError && (
            <p className="text-sm text-rose-600">{groupsError}</p>
          )}
          <div className="hidden flex-wrap items-center justify-between gap-4 sm:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Premium Social Discovery
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">
                Swipe into your next plan
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Discover groups like a curated dating feed. Tap a card for full details.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
              >
                <option value="smart">Smart sort</option>
                <option value="recent">Most recent</option>
              </select>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-6">
            <div className="flex flex-nowrap items-center gap-1 overflow-x-auto sm:flex-wrap sm:gap-2 sm:overflow-visible">
              {categoryConfig.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleTabChange(category.id as TabKey)}
                  className={`whitespace-nowrap rounded-md border px-[clamp(0.5rem,2.6vw,0.75rem)] py-[clamp(0.25rem,1.4vw,0.375rem)] text-[clamp(0.5625rem,2.6vw,0.6875rem)] font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                    activeCategory === category.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>

            <div className="hidden rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 sm:block">
              {categoryConfig.find((category) => category.id === activeCategory)?.description}
            </div>

            <div className="flex min-h-0 flex-1">
              {activeCategory === "profiles" ? (
                profilesLoading ? (
                  <SwipeDeckSkeleton />
                ) : accessToken ? (
                  <>
                    <ProfileSwipeDeck
                      profiles={profileMatches}
                      requestId={profileRequestId}
                    />
                    {profilesError ? (
                      <p className="mt-3 text-center text-xs text-rose-500">{profilesError}</p>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                    Sign in to see profile matches.
                  </div>
                )
              ) : loading ? (
                <SwipeDeckSkeleton />
              ) : (
                <>
                  <SwipeDeck
                    groups={grouped[activeCategory]}
                    onNearEnd={handleLoadMore}
                    nearEndThreshold={PREFETCH_THRESHOLD}
                    resetKey={deckResetKey}
                    onMarkSeen={markGroupSeen}
                    onUnmarkSeen={unmarkGroupSeen}
                  />
                  {loadingMore ? (
                    <p className="mt-3 text-center text-xs text-slate-500">Loading more groups…</p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <FiltersDrawer
        open={drawerOpen}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        onClose={() => {
          setDrawerOpen(false);
          clearQueryFlag("filters");
        }}
        showDistanceHelper={Boolean(
          filters.distance.trim() && (user?.location_lat == null || user?.location_lng == null)
        )}
      />

      <FindMyTypeModal
        open={findTypeOpen}
        onClose={() => {
          setFindTypeOpen(false);
          clearQueryFlag("findType");
        }}
      />
    </div>
  );
}

