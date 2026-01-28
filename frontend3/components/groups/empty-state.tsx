"use client";

import Link from "next/link";

export default function EmptyState() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center rounded-none border-0 bg-white px-6 py-12 text-center shadow-none sm:rounded-[32px] sm:border sm:border-white/70 sm:bg-white/80 sm:px-8 sm:py-16 sm:shadow-xl sm:shadow-slate-900/10">
      <p className="text-sm uppercase tracking-widest text-slate-400">No more events nearby</p>
      <h3 className="mt-3 text-2xl font-semibold text-slate-900">You have seen them all</h3>
      <p className="mt-2 text-sm text-slate-600">
        Adjust filters or create a new group to start the next plan.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/groups/create"
          className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30"
        >
          Create Group
        </Link>
        <Link
          href="/groups"
          className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
        >
          Reset filters
        </Link>
      </div>
    </div>
  );
}
