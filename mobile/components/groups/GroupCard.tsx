import type { StyleProp, ViewStyle } from "react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { API_HOST } from "@/lib/api";
import type { SwipeGroup } from "@/components/groups/types";

type OverlayLabel = {
  text: string;
  variant: "like" | "nope";
  opacity: number;
};

interface GroupCardProps {
  group: SwipeGroup;
  overlayLabel?: OverlayLabel | null;
  containerStyle?: StyleProp<ViewStyle>;
  imageUrls?: string[];
  activeImageIndex?: number;
  onTapLeft?: () => void;
  onTapRight?: () => void;
  onInfoPress?: () => void;
  creatorAvatarUrl?: string | null;
  onCreatorPress?: () => void;
  topLeftMeta?: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  mutual_benefits: "Mutual benefits",
  friendship: "Friendship",
  dating: "Dating",
};

const COST_LABELS: Record<string, string> = {
  free: "Free",
  shared: "Shared cost",
  fully_paid: "Fully paid",
  custom: "Custom",
};

const trimLabel = (value: string, max = 28) =>
  value.length > max ? `${value.slice(0, Math.max(max - 3, 0))}...` : value;

const buildChips = (group: SwipeGroup) => {
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

  const chips: string[] = [];

  if (group.category) {
    chips.push(CATEGORY_LABELS[group.category] || group.category);
  }
  chips.push(COST_LABELS[group.cost_type] || "Shared");
  if (spotsLeft != null) {
    chips.push(`${spotsLeft} spots left`);
  }
  offerings.slice(0, 2).forEach((offer) => {
    chips.push(`Offer: ${trimLabel(offer, 22)}`);
  });
  if (expectationsText) {
    chips.push(`Expect: ${trimLabel(expectationsText, 26)}`);
  }
  if (group.location) {
    chips.push(trimLabel(group.location, 24));
  }
  if (restricted) {
    chips.push(`${restricted.applies_to} only`.replace("_", " "));
  }
  if (group.start_date) {
    chips.push(new Date(group.start_date).toLocaleDateString());
  }
  if (group.shared_tags && group.shared_tags.length > 0) {
    chips.push(`Shared: ${group.shared_tags[0]}`);
  }

  return chips.slice(0, 6);
};

const resolveUrl = (url: string) => (url.startsWith("http") ? url : `${API_HOST}${url}`);

export default function GroupCard({
  group,
  overlayLabel,
  containerStyle,
  imageUrls,
  activeImageIndex = 0,
  onTapLeft,
  onTapRight,
  onInfoPress,
  creatorAvatarUrl,
  onCreatorPress,
  topLeftMeta,
}: GroupCardProps) {
  const baseImages =
    imageUrls && imageUrls.length > 0
      ? imageUrls
      : group.cover_image_url
        ? [group.cover_image_url]
        : [];
  const images = baseImages.map(resolveUrl);
  const safeIndex = images.length > 0 ? Math.min(activeImageIndex, images.length - 1) : 0;
  const activeImage = images[safeIndex];
  const creatorAvatar = creatorAvatarUrl ? resolveUrl(creatorAvatarUrl) : null;

  const spotsLeft = group.max_participants
    ? Math.max(group.max_participants - (group.approved_members ?? 0), 0)
    : null;
  const costLabel = group.cost_type.replace("_", " ");
  const metaLine = spotsLeft != null ? `${costLabel} · ${spotsLeft} spots left` : costLabel;
  const locationLine = group.location || group.activity_type || "";
  const chips = buildChips(group);
  const discoveryLabels = group.discovery_labels || [];

  return (
    <View style={[styles.card, containerStyle]}>
      <View style={styles.imageWrap}>
        {activeImage ? (
          <Image source={{ uri: activeImage }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        <View style={styles.overlay} />

        {images.length > 0 ? (
          <View style={styles.imageBars}>
            {images.map((_, idx) => (
              <View
                key={`${group.id}-bar-${idx}`}
                style={[styles.imageBar, idx === safeIndex ? styles.imageBarActive : null]}
              />
            ))}
          </View>
        ) : null}

        {onCreatorPress ? (
          <Pressable
            onPress={onCreatorPress}
            style={styles.creatorAvatarButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="View creator profile"
          >
            {creatorAvatar ? (
              <Image source={{ uri: creatorAvatar }} style={styles.creatorAvatarImage} />
            ) : (
              <View style={styles.creatorAvatarFallback} />
            )}
          </Pressable>
        ) : null}

        {topLeftMeta && topLeftMeta.length > 0 ? (
          <View style={styles.topLeftMeta}>
            {topLeftMeta.map((value, index) => (
              <Text
                key={`${value}-${index}`}
                style={[
                  styles.topLeftText,
                  index === 0 ? styles.topLeftName : styles.topLeftLocation,
                ]}
              >
                {value}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.imageText}>
          <Text style={styles.title}>{group.title}</Text>
          {locationLine ? <Text style={styles.meta}>{locationLine}</Text> : null}
          <Text style={styles.meta}>{metaLine}</Text>
        </View>

        <View style={styles.tapZones} pointerEvents="box-none">
          <Pressable style={styles.tapZone} onPress={onTapLeft} />
          <Pressable style={styles.tapZone} onPress={onTapRight} />
        </View>

        {onInfoPress ? (
          <Pressable
            onPress={onInfoPress}
            style={styles.infoButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="View group details"
          >
            <Text style={styles.infoIcon}>i</Text>
          </Pressable>
        ) : null}

        {overlayLabel ? (
          <View
            style={[
              styles.overlayLabel,
              overlayLabel.variant === "like" ? styles.likeBorder : styles.nopeBorder,
              { opacity: overlayLabel.opacity },
            ]}
          >
            <Text style={styles.overlayLabelText}>{overlayLabel.text}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        {discoveryLabels.length > 0 ? (
          <View style={styles.discoverySection}>
            <Text style={styles.discoveryTitle}>Why you're seeing this</Text>
            <View style={styles.discoveryRow}>
              {discoveryLabels.map((label) => (
                <View key={label} style={styles.discoveryPill}>
                  <Text style={styles.discoveryText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <Text style={styles.description} numberOfLines={3}>
          {group.description}
        </Text>
        <View style={styles.chips}>
          {chips.map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  imageWrap: {
    flex: 1,
    minHeight: 360,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1f2937",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  imageBars: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 6,
  },
  creatorAvatarButton: {
    position: "absolute",
    top: 30,
    right: 16,
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    zIndex: 3,
    elevation: 4,
  },
  creatorAvatarImage: {
    width: "100%",
    height: "100%",
  },
  creatorAvatarFallback: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  topLeftMeta: {
    position: "absolute",
    top: 18,
    left: 16,
    gap: 6,
    maxWidth: "70%",
  },
  topLeftText: {
    color: "#ffffff",
    textShadowColor: "rgba(15, 23, 42, 0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  topLeftName: {
    fontSize: 18,
    fontWeight: "700",
  },
  topLeftLocation: {
    fontSize: 11,
    fontWeight: "600",
  },
  imageBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  imageBarActive: {
    backgroundColor: "#ffffff",
  },
  imageText: {
    position: "absolute",
    left: 16,
    right: 72,
    bottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },
  meta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
  overlayLabel: {
    position: "absolute",
    top: 48,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  overlayLabelText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
  },
  likeBorder: {
    borderColor: "#10b981",
  },
  nopeBorder: {
    borderColor: "#f87171",
  },
  infoButton: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    elevation: 3,
  },
  infoIcon: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  tapZones: {
    position: "absolute",
    inset: 0,
    flexDirection: "row",
    zIndex: 1,
  },
  tapZone: {
    flex: 1,
  },
  body: {
    padding: 16,
    gap: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
  },
  description: {
    fontSize: 14,
    color: "#475569",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  discoveryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  discoverySection: {
    gap: 6,
  },
  discoveryTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  discoveryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#a5f3fc",
  },
  discoveryText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0e7490",
    textTransform: "uppercase",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
});
