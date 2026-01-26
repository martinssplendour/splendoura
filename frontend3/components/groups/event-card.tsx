"use client";

import { forwardRef } from "react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { SwipeGroup } from "@/components/groups/types";
import CardChips from "@/components/groups/card-chips";
import { resolveMediaUrl } from "@/lib/api";

interface EventCardProps {
  group: SwipeGroup;
  onClick?: () => void;
  overlayLabel?: { text: string; variant: "like" | "nope"; opacity: number } | null;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const EventCard = forwardRef<HTMLDivElement, EventCardProps>(
  ({ group, onClick, overlayLabel, footer, className, style }, ref) => {
    const costLine = `${group.cost_type.replace("_", " ")} · ${
      group.max_participants
        ? `${Math.max(group.max_participants - (group.approved_members ?? 0), 0)} spots left`
        : "Open spots"
    }`;

    return (
      <div
        ref={ref}
        className={`relative flex h-full flex-col overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-2xl shadow-slate-900/15 ${
          className || ""
        }`}
        style={style}
        onClick={onClick}
      >
        <div className="relative h-56 w-full sm:h-72">
          {group.cover_image_url ? (
            <img
              src={resolveMediaUrl(group.cover_image_url)}
              alt={group.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-slate-200" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/65 via-slate-900/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <p className="text-xs uppercase tracking-wide text-white/70">Featured</p>
            <h2 className="mt-1 text-2xl font-semibold">{group.title}</h2>
            <p className="text-xs text-white/80">{costLine}</p>
          </div>
          {overlayLabel ? (
            <div
              className={`absolute left-4 top-4 rounded-2xl border px-4 py-2 text-sm font-semibold uppercase tracking-widest ${
                overlayLabel.variant === "like"
                  ? "border-emerald-400 text-emerald-200"
                  : "border-red-300 text-red-200"
              }`}
              style={{ opacity: overlayLabel.opacity }}
            >
              {overlayLabel.text}
            </div>
          ) : null}
        </div>

        <div className="flex-1 space-y-4 p-5 sm:p-6">
          <div>
            <p className="mt-2 text-sm text-slate-600 line-clamp-3">{group.description}</p>
          </div>

          <CardChips group={group} />
          <Link
            href={`/groups/${group.id}#creator`}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex text-xs font-semibold uppercase tracking-wide text-blue-600"
          >
            View creator profile
          </Link>
        </div>

        {footer ? (
          <div className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    );
  }
);

EventCard.displayName = "EventCard";

export default EventCard;
