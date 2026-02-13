"use client";

import { forwardRef } from "react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { SwipeGroup } from "@/components/groups/types";
import { SignedImage } from "@/components/signed-media";

interface EventCardProps {
  group: SwipeGroup;
  onInfoClick?: () => void;
  overlayLabel?: { text: string; variant: "like" | "nope"; opacity: number } | null;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  imageUrls?: string[];
  activeImageIndex?: number;
  onPrevImage?: () => void;
  onNextImage?: () => void;
  creatorName?: string;
  creatorAvatarUrl?: string | null;
  locationLabel?: string | null;
}

const EventCard = forwardRef<HTMLDivElement, EventCardProps>(
  (
    {
      group,
      onInfoClick,
      overlayLabel,
      footer,
      className,
      style,
      imageUrls,
      activeImageIndex,
      onPrevImage,
      onNextImage,
      creatorName,
      creatorAvatarUrl,
      locationLabel,
    },
    ref
  ) => {
    const costLabelMap: Record<SwipeGroup["cost_type"], string> = {
      free: "Free",
      shared: "Shared cost",
      fully_paid: "Fully paid",
      custom: "Custom",
    };
    const costLabel = costLabelMap[group.cost_type] || group.cost_type.replace("_", " ");
    const spotsLeft =
      group.max_participants != null
        ? Math.max(group.max_participants - (group.approved_members ?? 0), 0)
        : null;
    const costLine = `${group.cost_type.replace("_", " ")} - ${
      group.max_participants
        ? `${Math.max(group.max_participants - (group.approved_members ?? 0), 0)} spots left`
        : "Open spots"
    }`;
    const offersList = Array.isArray(group.offerings)
      ? group.offerings
          .map((offer) => String(offer).trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
    const offersLine = offersList.length > 0 ? `Offers: ${offersList.join(", ")}` : null;
    const expectationsList = (
      Array.isArray(group.expectations)
        ? group.expectations
        : typeof group.expectations === "string"
          ? group.expectations.split(",")
          : []
    )
      .map((value) => String(value).trim())
      .filter(Boolean)
      .slice(0, 3);
    const expectationsLine =
      expectationsList.length > 0 ? `Expectations: ${expectationsList.join(", ")}` : null;

    const images =
      imageUrls && imageUrls.length > 0
        ? imageUrls
        : group.cover_image_url
        ? [group.cover_image_url]
        : [];
    const safeIndex = Math.min(activeImageIndex ?? 0, Math.max(images.length - 1, 0));
    const activeImage = images.length > 0 ? images[safeIndex] : null;

    const hasTopLeftMeta = Boolean(creatorName || locationLabel);
    const infoClickable = Boolean(onInfoClick);

    return (
      <div
        ref={ref}
        className={`relative grid h-full min-h-0 grid-rows-[minmax(0,65%)_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none sm:border-white/70 sm:shadow-2xl sm:shadow-slate-900/15 ${
          className || ""
        }`}
        style={style}
      >
        <div className="relative h-full min-h-0 w-full">
          {activeImage ? (
            <SignedImage
              src={activeImage}
              alt={group.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-slate-200" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/65 via-slate-900/20 to-transparent" />
          {images.length > 1 ? (
            <div className="absolute left-3 right-3 top-2 flex gap-0.5">
              {images.map((_, index) => (
                <span
                  key={`media-${index}`}
                  className={`h-0.5 flex-1 rounded-full ${
                    index === safeIndex ? "bg-white/90" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          ) : null}
          {hasTopLeftMeta ? (
            <div className="absolute left-3 top-6 z-10 max-w-[70%] text-white drop-shadow">
              {creatorName ? (
                <p className="text-[clamp(1.5rem,7.01vw,1.875rem)] font-semibold leading-none">
                  {creatorName}
                </p>
              ) : null}
              {locationLabel ? (
                <p className="text-[clamp(0.6875rem,3.04vw,0.8125rem)] leading-none text-white/85">
                  {locationLabel}
                </p>
              ) : null}
            </div>
          ) : null}
          {creatorName ? (
            <Link
              href={`/users/${group.creator_id}`}
              onClick={(event) => event.stopPropagation()}
              className="absolute right-4 top-6 z-10 h-[var(--ui-avatar-size)] w-[var(--ui-avatar-size)] overflow-hidden rounded-full border-2 border-white/80 bg-slate-900/40 shadow-md"
              aria-label="View creator profile"
            >
              {creatorAvatarUrl ? (
                <SignedImage
                  src={creatorAvatarUrl}
                  alt={creatorName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-white/40" />
              )}
            </Link>
          ) : null}
          {images.length > 1 ? (
            <div className="absolute inset-0 flex">
              <button
                type="button"
                className="h-full w-1/2"
                onClick={(event) => {
                  event.stopPropagation();
                  onPrevImage?.();
                }}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="Previous image"
              />
              <button
                type="button"
                className="h-full w-1/2"
                onClick={(event) => {
                  event.stopPropagation();
                  onNextImage?.();
                }}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="Next image"
              />
            </div>
          ) : null}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 text-white">
            <p className="text-[0.5625rem] uppercase tracking-wide text-white/70">Featured</p>
            <h2 className="mt-1 text-base font-semibold">{group.title}</h2>
            <p className="text-[0.5625rem] text-white/80">{costLine}</p>
          </div>
          {overlayLabel ? (
            <div
              className={`absolute left-3 ${hasTopLeftMeta ? "top-24" : "top-3"} rounded-xl border px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-widest ${
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

        <div
          className={`min-h-0 space-y-1 overflow-hidden p-2 sm:p-3 ${infoClickable ? "cursor-pointer" : ""}`}
          onClick={onInfoClick}
        >
          <div>
            <p className="mt-0.5 text-[0.625rem] text-slate-600 line-clamp-1">
              {group.description}
            </p>
          </div>
          <p className="text-[0.5625rem] text-slate-500 line-clamp-1">{costLabel}</p>
          {spotsLeft != null ? (
            <p className="text-[0.5625rem] text-slate-500 line-clamp-1">
              {spotsLeft} spots left
            </p>
          ) : null}
          {offersLine ? (
            <p className="text-[0.5625rem] text-slate-500 line-clamp-1">{offersLine}</p>
          ) : null}
          {expectationsLine ? (
            <p className="text-[0.5625rem] text-slate-500 line-clamp-1">{expectationsLine}</p>
          ) : null}
        </div>

        {footer ? (
          <div className="border-t border-slate-100 bg-white/95 px-2 py-2 sm:px-3">
            {footer}
          </div>
        ) : null}
      </div>
    );
  }
);

EventCard.displayName = "EventCard";

export default EventCard;
