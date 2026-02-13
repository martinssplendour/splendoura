"use client";

export default function SwipeDeckSkeleton() {
  return (
    <div className="relative mx-auto h-full min-h-0 w-[95%] sm:w-[94%] md:w-[92%] lg:w-[90%]">
      <div className="h-full min-h-[60vh] w-full animate-pulse rounded-xl bg-slate-200" />
      <div className="mt-5 flex items-center gap-3">
        <div className="h-12 flex-1 animate-pulse rounded-full bg-slate-200" />
        <div className="h-12 flex-1 animate-pulse rounded-full bg-slate-200" />
      </div>
    </div>
  );
}
