"use client";

export default function SwipeDeckSkeleton() {
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div className="h-12 w-1/2 animate-pulse rounded-2xl bg-slate-200" />
      <div className="mt-6 h-[520px] w-full animate-pulse rounded-[32px] bg-slate-200" />
      <div className="mt-6 flex items-center gap-3">
        <div className="h-12 flex-1 animate-pulse rounded-full bg-slate-200" />
        <div className="h-12 flex-1 animate-pulse rounded-full bg-slate-200" />
      </div>
    </div>
  );
}
