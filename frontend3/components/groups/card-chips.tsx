"use client";

import {
  Calendar,
  ClipboardCheck,
  Gift,
  Heart,
  MapPin,
  Users,
  Wallet,
} from "lucide-react";
import type { SwipeGroup } from "@/components/groups/types";

interface Chip {
  label: string;
  icon: JSX.Element;
}

const COST_LABELS: Record<string, string> = {
  free: "Free",
  shared: "Shared Cost",
  fully_paid: "Fully Paid",
  custom: "Custom",
};

const CATEGORY_LABELS: Record<string, string> = {
  mutual_benefits: "Mutual Benefits",
  friendship: "Friendship",
  dating: "Dating",
};

export default function CardChips({ group }: { group: SwipeGroup }) {
  const approved = group.approved_members ?? 0;
  const spotsLeft =
    group.max_participants != null
      ? Math.max(group.max_participants - approved, 0)
      : null;
  const requirements = group.requirements || [];
  const restricted = requirements.find((req) => req.applies_to !== "all");
  const offerings = Array.isArray(group.offerings) ? group.offerings : [];
  const expectationsText = Array.isArray(group.expectations)
    ? group.expectations.join(", ")
    : typeof group.expectations === "string"
      ? group.expectations
      : "";
  const trimLabel = (value: string, max = 28) =>
    value.length > max ? `${value.slice(0, Math.max(max - 3, 0))}...` : value;

  const chips: Chip[] = [
    ...(group.category
      ? [
          {
            label: CATEGORY_LABELS[group.category] || group.category,
            icon: <Heart className="h-3.5 w-3.5" />,
          },
        ]
      : []),
    {
      label: COST_LABELS[group.cost_type] || "Shared",
      icon: <Wallet className="h-3.5 w-3.5" />,
    },
  ];

  if (spotsLeft != null) {
    chips.push({
      label: `${spotsLeft} spots left`,
      icon: <Users className="h-3.5 w-3.5" />,
    });
  }

  offerings.slice(0, 2).forEach((offer) => {
    chips.push({
      label: `Offer: ${trimLabel(offer, 22)}`,
      icon: <Gift className="h-3.5 w-3.5" />,
    });
  });

  if (expectationsText) {
    chips.push({
      label: `Expect: ${trimLabel(expectationsText, 26)}`,
      icon: <ClipboardCheck className="h-3.5 w-3.5" />,
    });
  }

  if (group.location) {
    chips.push({
      label: group.location,
      icon: <MapPin className="h-3.5 w-3.5" />,
    });
  }

  if (restricted) {
    chips.push({
      label: `${restricted.applies_to} only`.replace("_", " "),
      icon: <Heart className="h-3.5 w-3.5" />,
    });
  }

  if (group.start_date) {
    chips.push({
      label: new Date(group.start_date).toLocaleDateString(),
      icon: <Calendar className="h-3.5 w-3.5" />,
    });
  }

  if (group.shared_tags && group.shared_tags.length > 0) {
    chips.push({
      label: `Shared: ${group.shared_tags[0]}`,
      icon: <Heart className="h-3.5 w-3.5" />,
    });
  }

  const visibleChips = chips.slice(0, 6);

  return (
    <div className="flex flex-wrap gap-2">
      {visibleChips.map((chip, index) => (
        <span
          key={`${chip.label}-${index}`}
          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
        >
          {chip.icon}
          {chip.label}
        </span>
      ))}
    </div>
  );
}
