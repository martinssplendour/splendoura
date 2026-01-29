"use client";

import { X } from "lucide-react";
import type { GroupFilters } from "@/components/groups/filters-sidebar";

interface FiltersDrawerProps {
  open: boolean;
  filters: GroupFilters;
  onChange: (filters: GroupFilters) => void;
  onClose: () => void;
  onReset: () => void;
  showDistanceHelper?: boolean;
  distanceHelperText?: string;
}

export default function FiltersDrawer({
  open,
  filters,
  onChange,
  onClose,
  onReset,
  showDistanceHelper,
  distanceHelperText = "Add location coordinates in your profile.",
}: FiltersDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close filters"
      />
      <div className="relative ml-auto h-full w-full max-w-sm bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filters</p>
            <h3 className="text-lg font-semibold text-slate-900">Find your match</h3>
          </div>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-400">Location</p>
            <input
              value={filters.location}
              onChange={(event) => onChange({ ...filters, location: event.target.value })}
              placeholder="City or area"
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-400">Type</p>
            <input
              value={filters.activity}
              onChange={(event) => onChange({ ...filters, activity: event.target.value })}
              placeholder="Dinner, trip, club..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-400">Age range</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={filters.minAge}
                onChange={(event) => onChange({ ...filters, minAge: event.target.value })}
                placeholder="Min"
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
              />
              <input
                value={filters.maxAge}
                onChange={(event) => onChange({ ...filters, maxAge: event.target.value })}
                placeholder="Max"
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-400">Show me</p>
            <select
              value={filters.gender || "both"}
              onChange={(event) => onChange({ ...filters, gender: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="both">Men & women</option>
              <option value="female">Women</option>
              <option value="male">Men</option>
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-400">Distance (km)</p>
            <input
              value={filters.distance}
              onChange={(event) => onChange({ ...filters, distance: event.target.value })}
              placeholder="25"
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
            {showDistanceHelper ? (
              <p className="text-xs text-slate-400">{distanceHelperText}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-400">Cost</p>
            <select
              value={filters.cost}
              onChange={(event) => onChange({ ...filters, cost: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
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
              onChange={(event) =>
                onChange({ ...filters, creatorVerified: event.target.checked })
              }
              className="h-4 w-4 accent-slate-900"
            />
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
