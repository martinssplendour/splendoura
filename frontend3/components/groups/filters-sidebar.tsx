"use client";

import { SlidersHorizontal } from "lucide-react";

export interface GroupFilters {
  location: string;
  activity: string;
  minAge: string;
  maxAge: string;
  distance: string;
  cost: string;
  creatorVerified: boolean;
}

interface FiltersSidebarProps {
  filters: GroupFilters;
  onChange: (filters: GroupFilters) => void;
  onReset: () => void;
  showDistanceHelper?: boolean;
  distanceHelperText?: string;
}

export default function FiltersSidebar({
  filters,
  onChange,
  onReset,
  showDistanceHelper,
  distanceHelperText = "Add location coordinates in your profile.",
}: FiltersSidebarProps) {
  return (
    <aside className="hidden w-full max-w-xs flex-col gap-6 rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-900/10 backdrop-blur lg:flex">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filters</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Refine matches</h3>
        </div>
        <SlidersHorizontal className="h-4 w-4 text-slate-400" />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-slate-400">Location</p>
        <input
          value={filters.location}
          onChange={(event) => onChange({ ...filters, location: event.target.value })}
          placeholder="City or area"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-slate-400">Type</p>
        <input
          value={filters.activity}
          onChange={(event) => onChange({ ...filters, activity: event.target.value })}
          placeholder="Dinner, trip, club..."
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-slate-400">Age range</p>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={filters.minAge}
            onChange={(event) => onChange({ ...filters, minAge: event.target.value })}
            placeholder="Min"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          />
          <input
            value={filters.maxAge}
            onChange={(event) => onChange({ ...filters, maxAge: event.target.value })}
            placeholder="Max"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-slate-400">Distance (km)</p>
        <input
          value={filters.distance}
          onChange={(event) => onChange({ ...filters, distance: event.target.value })}
          placeholder="25"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
        />
        {showDistanceHelper ? (
          <p className="text-xs text-slate-400">{distanceHelperText}</p>
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-slate-400">Cost</p>
        <select
          value={filters.cost}
          onChange={(event) => onChange({ ...filters, cost: event.target.value })}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
        >
          <option value="">Any</option>
          <option value="free">Free</option>
          <option value="shared">Shared cost</option>
          <option value="fully_paid">Fully paid</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">Verification</p>
          <p className="text-sm font-semibold text-slate-700">Verified creators only</p>
        </div>
        <input
          type="checkbox"
          checked={filters.creatorVerified}
          onChange={(event) => onChange({ ...filters, creatorVerified: event.target.checked })}
          className="h-4 w-4 accent-slate-900"
        />
      </div>

      <button
        type="button"
        onClick={onReset}
        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
      >
        Reset filters
      </button>
    </aside>
  );
}
