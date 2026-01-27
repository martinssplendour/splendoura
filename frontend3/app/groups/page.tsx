// app/groups/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import SwipeDeck from "@/components/groups/swipe-deck";
import SwipeDeckSkeleton from "@/components/groups/loading-skeleton";
import FiltersSidebar, { GroupFilters } from "@/components/groups/filters-sidebar";
import FiltersDrawer from "@/components/groups/filters-drawer";
import type { SwipeGroup } from "@/components/groups/types";

const DEFAULT_FILTERS: GroupFilters = {
  location: "",
  activity: "",
  minAge: "",
  maxAge: "",
  distance: "",
  cost: "",
  creatorVerified: false,
};

export default function BrowseGroups() {
  const searchParams = useSearchParams();
  const creatorId = searchParams.get("creator_id");
  const [groups, setGroups] = useState<SwipeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GroupFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState("smart");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<
    "mutual_benefits" | "friendship" | "dating"
  >("friendship");
  const { accessToken, user } = useAuth();

  useEffect(() => {
    if (!user) return;
    setFilters((prev) => {
      const discovery = (user.discovery_settings as Record<string, unknown>) || {};
      const next = { ...prev };
      if (!prev.location && user.location_city) {
        next.location = user.location_city;
      }
      if (!prev.distance && discovery.distance_km != null) {
        next.distance = String(discovery.distance_km);
      }
      if (!prev.minAge && discovery.age_min != null) {
        next.minAge = String(discovery.age_min);
      }
      if (!prev.maxAge && discovery.age_max != null) {
        next.maxAge = String(discovery.age_max);
      }
      return next;
    });
  }, [user]);

  const queryParams = useMemo(() => {
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

  useEffect(() => {
    async function loadGroups() {
      setLoading(true);
      const endpoint = accessToken ? "/groups/discover" : "/groups";
      const url = queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint;
      let res = await apiFetch(url, accessToken ? { token: accessToken } : undefined);
      if (res.status === 401 && accessToken) {
        const fallbackUrl = queryParams.toString() ? `/groups?${queryParams.toString()}` : "/groups";
        res = await apiFetch(fallbackUrl);
      }
      if (res.ok) {
        const data: SwipeGroup[] = await res.json();
        setGroups(data);
      }
      setLoading(false);
    }
    loadGroups();
  }, [accessToken, queryParams]);

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
  ];

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-white/70 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:rounded-[40px] sm:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#e2f4ff_0%,_#f8fbff_38%,_#fff1ea_100%)] opacity-80" />
      <div className="pointer-events-none absolute inset-x-10 top-10 h-24 rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.7)_0%,_rgba(255,255,255,0)_70%)] blur-2xl" />

      <div className="relative grid gap-4 sm:gap-8 lg:grid-cols-[260px_1fr]">
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

        <div className="space-y-4 sm:space-y-8">
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
              <Link
                href="/groups/create"
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
              >
                Create Group
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600"
            >
              <option value="smart">Smart sort</option>
              <option value="recent">Most recent</option>
            </select>
            <Link
                href="/groups/create"
                className="ml-auto rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
              >
                Create group
              </Link>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-nowrap items-center gap-1 overflow-x-auto sm:flex-wrap sm:gap-2 sm:overflow-visible">
              {categoryConfig.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`whitespace-nowrap rounded-md border px-3 py-1 text-[11px] font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
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

            {loading ? (
              <SwipeDeckSkeleton />
            ) : (
              <SwipeDeck groups={grouped[activeCategory]} />
            )}
          </div>
        </div>
      </div>

      <FiltersDrawer
        open={drawerOpen}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        onClose={() => setDrawerOpen(false)}
        showDistanceHelper={Boolean(
          filters.distance.trim() && (user?.location_lat == null || user?.location_lng == null)
        )}
      />
    </div>
  );
}
