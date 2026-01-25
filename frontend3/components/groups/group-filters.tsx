// frontend3/components/groups/group-filters.tsx
"use client";
import { Search, SlidersHorizontal } from "lucide-react";

export default function FiltersPanel() {
  return (
    <div className="glass-card rounded-2xl p-6 sticky top-24 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
        <SlidersHorizontal size={18} className="text-blue-600" />
        <h2 className="font-bold text-slate-800">Filters</h2>
      </div>

      {/* Search Bar */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Search</label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
          <input 
            placeholder="Search groups..." 
            className="w-full pl-8 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>
      </div>

      {/* Activity Type */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Activity Type</label>
        <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>All Activities</option>
          <option>Vacation</option>
          <option>Dinner</option>
          <option>Clubbing</option>
          <option>Trip</option>
        </select>
      </div>

      {/* Cost Type */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Cost Type</label>
        <div className="space-y-2">
          {["Free", "Shared", "Fully Paid"].map((cost) => (
            <label key={cost} className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
              />
              <span className="text-sm text-slate-600 group-hover:text-blue-600 transition-colors">
                {cost}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95">
        Apply Filters
      </button>
    </div>
  );
}