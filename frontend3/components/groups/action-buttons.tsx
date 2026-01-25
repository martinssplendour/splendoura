"use client";

import { Heart, X } from "lucide-react";

interface ActionButtonsProps {
  onReject: () => void;
  onApprove: () => void;
  isBusy?: boolean;
  hideLabels?: boolean;
}

export default function ActionButtons({
  onReject,
  onApprove,
  isBusy,
  hideLabels,
}: ActionButtonsProps) {
  return (
    <div className="flex w-full items-center gap-3">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onReject();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/30 transition hover:bg-red-600"
      >
        <X className="h-4 w-4" />
        {hideLabels ? null : "No Thanks"}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onApprove();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        disabled={isBusy}
        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:opacity-70"
      >
        <Heart className="h-4 w-4" />
        {hideLabels ? null : isBusy ? "Joining..." : "Join Group"}
      </button>
    </div>
  );
}
