"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { BottomNav } from "@/components/navigation/BottomNav";
import SwipeDeck from "@/components/groups/SwipeDeck";
import type { SwipeGroup } from "@/components/groups/types";
import ProfileSwipeDeck, { ProfileMatch } from "@/components/profiles/ProfileSwipeDeck";
import FindMyTypeModal from "@/components/find-my-type-modal";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type AppliedFilters = {
  location: string;
  activity: string;
  minAge: string;
  maxAge: string;
  distance: string;
  cost: string;
  gender: string;
  creatorVerified: boolean;
};

const CATEGORY_CONFIG = [
  {
    id: "mutual_benefits" as const,
    label: "Mutual benefits",
    description: "Intimate experiences with mutual financial benefit.",
  },
  {
    id: "friendship" as const,
    label: "Friendship",
    description: "Meet new people and hang out as friends.",
  },
  {
    id: "dating" as const,
    label: "Dating",
    description: "Two-person date planning groups.",
  },
  {
    id: "profiles" as const,
    label: "Profiles",
    description: "Swipe profiles based on your discovery filters.",
  },
];
type CategoryId = (typeof CATEGORY_CONFIG)[number]["id"];

const COST_OPTIONS = [
  { id: "", label: "Any" },
  { id: "free", label: "Free" },
  { id: "shared", label: "Shared" },
  { id: "fully_paid", label: "Fully paid" },
  { id: "custom", label: "Custom" },
];

const GENDER_OPTIONS = [
  { id: "both", label: "Both" },
  { id: "female", label: "Women" },
  { id: "male", label: "Men" },
];

export default function GroupsScreen() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const params = useLocalSearchParams<{ creator_id?: string }>();
  const creatorId = params.creator_id ? String(params.creator_id) : "";
  const [groups, setGroups] = useState<SwipeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("friendship");
  const [findTypeOpen, setFindTypeOpen] = useState(false);
  const [profileMatches, setProfileMatches] = useState<ProfileMatch[]>([]);
  const [profileRequestId, setProfileRequestId] = useState<number | null>(null);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [minAgeFilter, setMinAgeFilter] = useState("");
  const [maxAgeFilter, setMaxAgeFilter] = useState("");
  const [distanceFilter, setDistanceFilter] = useState("");
  const [costFilter, setCostFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("both");
  const [creatorVerifiedFilter, setCreatorVerifiedFilter] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    location: "",
    activity: "",
    minAge: "",
    maxAge: "",
    distance: "",
    cost: "",
    gender: "both",
    creatorVerified: false,
  });

  useEffect(() => {
    if (!user) return;
    const discovery = (user.discovery_settings as Record<string, unknown>) || {};
    if (!locationFilter && user.location_city) {
      setLocationFilter(user.location_city);
    }
    if (!distanceFilter && discovery.distance_km != null) {
      setDistanceFilter(String(discovery.distance_km));
    }
    if (!minAgeFilter && discovery.age_min != null) {
      setMinAgeFilter(String(discovery.age_min));
    }
    if (!maxAgeFilter && discovery.age_max != null) {
      setMaxAgeFilter(String(discovery.age_max));
    }
    const genders = discovery.genders as string[] | undefined;
    const hasMale = genders?.includes("male");
    const hasFemale = genders?.includes("female");
    if (hasMale && hasFemale) {
      setGenderFilter("both");
    } else if (hasFemale) {
      setGenderFilter("female");
    } else if (hasMale) {
      setGenderFilter("male");
    }
  }, [distanceFilter, locationFilter, maxAgeFilter, minAgeFilter, user]);

  const queryParams = useMemo(() => {
    const query = new URLSearchParams();
    if (creatorId) query.set("creator_id", creatorId);
    if (appliedFilters.location.trim()) {
      query.set("location", appliedFilters.location.trim());
    }
    if (appliedFilters.activity.trim()) {
      query.set("activity_type", appliedFilters.activity.trim());
    }
    const minAgeValue = Number.parseInt(appliedFilters.minAge.trim(), 10);
    const maxAgeValue = Number.parseInt(appliedFilters.maxAge.trim(), 10);
    if (!Number.isNaN(minAgeValue) && minAgeValue > 0) {
      query.set("min_age", String(minAgeValue));
    }
    if (!Number.isNaN(maxAgeValue) && maxAgeValue > 0) {
      query.set("max_age", String(maxAgeValue));
    }
    if (appliedFilters.cost) {
      query.set("cost_type", appliedFilters.cost);
    }
    if (appliedFilters.creatorVerified) {
      query.set("creator_verified", "true");
    }
    const distanceValue = Number.parseFloat(appliedFilters.distance.trim());
    if (!Number.isNaN(distanceValue) && distanceValue > 0) {
      if (user?.location_lat != null && user?.location_lng != null) {
        query.set("lat", String(user.location_lat));
        query.set("lng", String(user.location_lng));
        query.set("radius_km", String(distanceValue));
      }
    }
    return query.toString();
  }, [appliedFilters, creatorId, user?.location_lat, user?.location_lng]);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    const useDiscover = Boolean(accessToken);
    const endpoint = useDiscover ? "/groups/discover" : "/groups";
    const url = queryParams ? `${endpoint}?${queryParams}` : endpoint;
    let res = await apiFetch(url, accessToken ? { token: accessToken } : undefined);
    if (res.status === 401 && useDiscover) {
      const fallbackUrl = queryParams ? `/groups?${queryParams}` : "/groups";
      res = await apiFetch(fallbackUrl);
    }
    if (res.ok) {
      const data: SwipeGroup[] = await res.json();
      setGroups(data);
    } else {
      setStatus("Unable to load groups right now.");
    }
    setLoading(false);
  }, [accessToken, queryParams]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const profileCriteria = useMemo(() => {
    const discovery = (user?.discovery_settings as Record<string, unknown>) || {};
    const criteria: { key: string; value: unknown }[] = [];
    const ageMin = discovery.age_min as number | undefined;
    const ageMax = discovery.age_max as number | undefined;
    if (ageMin != null || ageMax != null) {
      criteria.push({
        key: "age_range",
        value: {
          ...(ageMin != null ? { min: ageMin } : {}),
          ...(ageMax != null ? { max: ageMax } : {}),
        },
      });
    }
    const distance = discovery.distance_km as number | undefined;
    if (distance != null) {
      criteria.push({ key: "distance_km", value: distance });
    }
    const genders = discovery.genders as string[] | undefined;
    const resolvedGenders =
      appliedFilters.gender === "male"
        ? ["male"]
        : appliedFilters.gender === "female"
          ? ["female"]
          : appliedFilters.gender === "both"
            ? ["male", "female"]
            : Array.isArray(genders)
              ? genders
              : [];
    if (resolvedGenders.length > 0) {
      criteria.push({ key: "gender", value: resolvedGenders });
    }
    return criteria;
  }, [appliedFilters.gender, user?.discovery_settings]);

  const profileCriteriaKey = useMemo(() => JSON.stringify(profileCriteria), [profileCriteria]);

  useEffect(() => {
    let active = true;
    const loadProfiles = async () => {
      if (!accessToken) {
        if (active) {
          setProfileMatches([]);
          setProfileRequestId(null);
          setProfilesError(null);
          setProfilesLoading(false);
        }
        return;
      }
      setProfilesLoading(true);
      setProfilesError(null);
      try {
        const res = await apiFetch("/match/requests", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            intent: "relationship",
            criteria: profileCriteria,
            offers: [],
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.detail || "Unable to load profiles right now.");
        }
        const data: { request?: { id: number }; results?: ProfileMatch[] } = await res.json();
        if (active) {
          setProfileMatches(data.results || []);
          setProfileRequestId(data.request?.id ?? null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load profiles right now.";
        if (active) {
          setProfilesError(message);
          setProfileMatches([]);
          setProfileRequestId(null);
        }
      } finally {
        if (active) {
          setProfilesLoading(false);
        }
      }
    };
    loadProfiles();
    return () => {
      active = false;
    };
  }, [accessToken, profileCriteriaKey]);

  const grouped = useMemo(() => {
    const buckets: Record<string, SwipeGroup[]> = {
      mutual_benefits: [],
      friendship: [],
      dating: [],
    };
    groups.forEach((group) => {
      const key = (group.category || "friendship") as CategoryId;
      if (buckets[key]) {
        buckets[key].push(group);
      } else {
        buckets.friendship.push(group);
      }
    });
    return buckets;
  }, [groups]);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({
      location: locationFilter,
      activity: activityFilter,
      minAge: minAgeFilter,
      maxAge: maxAgeFilter,
      distance: distanceFilter,
      cost: costFilter,
      gender: genderFilter,
      creatorVerified: creatorVerifiedFilter,
    });
    setShowFilters(false);
  }, [
    activityFilter,
    costFilter,
    creatorVerifiedFilter,
    distanceFilter,
    genderFilter,
    locationFilter,
    maxAgeFilter,
    minAgeFilter,
  ]);

  const handleClearFilters = useCallback(() => {
    setLocationFilter("");
    setActivityFilter("");
    setMinAgeFilter("");
    setMaxAgeFilter("");
    setDistanceFilter("");
    setCostFilter("");
    setCreatorVerifiedFilter(false);
    setAppliedFilters({
      location: "",
      activity: "",
      minAge: "",
      maxAge: "",
      distance: "",
      cost: "",
      gender: "both",
      creatorVerified: false,
    });
    setGenderFilter("both");
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.appNameWrap}>
                <Image source={require("../../assets/brand/icon.png")} style={styles.appLogo} />
                <Text style={styles.appName}>Splendoura</Text>
              </View>
              <Text style={styles.title}>Discover plans and swipe to join</Text>
            </View>
            <View style={styles.headerActions}>
              <View style={styles.headerActionRow}>
                <Button variant="outline" size="xs" onPress={() => setShowFilters((prev) => !prev)}>
                  {showFilters ? "Hide filters" : "Filters"}
                </Button>
                <Button variant="ghost" size="xs" onPress={() => router.push("/groups/create")}>
                  Create group
                </Button>
              </View>
              <Button size="xs" onPress={() => setFindTypeOpen(true)}>
                Find my type
              </Button>
            </View>
          </View>

          {showFilters ? (
            <Modal
              transparent
              animationType="slide"
              visible={showFilters}
              onRequestClose={() => setShowFilters(false)}
            >
              <View style={styles.filterOverlay}>
                <Pressable style={styles.filterBackdrop} onPress={() => setShowFilters(false)} />
                <View style={styles.filterSheet}>
                  <View style={styles.filterHeader}>
                    <View>
                      <Text style={styles.filterKicker}>Filters</Text>
                      <Text style={styles.filterTitle}>Refine your matches</Text>
                    </View>
                    <Pressable onPress={() => setShowFilters(false)}>
                      <Text style={styles.filterClose}>Close</Text>
                    </Pressable>
                  </View>

                  <View style={styles.filterDivider} />

                  <ScrollView
                    contentContainerStyle={styles.filters}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.filterField}>
                      <Text style={styles.filterLabel}>Location</Text>
                      <TextInput
                        value={locationFilter}
                        onChangeText={setLocationFilter}
                        placeholder="City or area"
                        style={styles.filterInput}
                      />
                    </View>

                    <View style={styles.filterField}>
                      <Text style={styles.filterLabel}>Activity</Text>
                      <TextInput
                        value={activityFilter}
                        onChangeText={setActivityFilter}
                        placeholder="Dinner, travel..."
                        style={styles.filterInput}
                      />
                    </View>

                    <View style={styles.filterField}>
                      <Text style={styles.filterLabel}>Age range</Text>
                      <View style={styles.filterRow}>
                        <TextInput
                          value={minAgeFilter}
                          onChangeText={setMinAgeFilter}
                          placeholder="Min"
                          keyboardType="number-pad"
                          style={[styles.filterInput, styles.filterInputHalf]}
                        />
                        <TextInput
                          value={maxAgeFilter}
                          onChangeText={setMaxAgeFilter}
                          placeholder="Max"
                          keyboardType="number-pad"
                          style={[styles.filterInput, styles.filterInputHalf]}
                        />
                      </View>
                    </View>

                    <View style={styles.filterField}>
                      <Text style={styles.filterLabel}>Distance (km)</Text>
                      <TextInput
                        value={distanceFilter}
                        onChangeText={setDistanceFilter}
                        placeholder="25"
                        keyboardType="decimal-pad"
                        style={styles.filterInput}
                      />
                      {user?.location_lat == null || user?.location_lng == null ? (
                        <Text style={styles.helper}>Add location coordinates in your profile.</Text>
                      ) : null}
                    </View>

                    <View style={styles.filterField}>
                      <Text style={styles.filterLabel}>Cost</Text>
                      <View style={styles.optionRow}>
                        {COST_OPTIONS.map((option) => (
                          <Pressable
                            key={option.id || "any"}
                            onPress={() => setCostFilter(option.id)}
                            style={[
                              styles.optionChip,
                              costFilter === option.id ? styles.optionChipActive : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.optionText,
                                costFilter === option.id ? styles.optionTextActive : null,
                              ]}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View style={styles.filterField}>
                      <Text style={styles.filterLabel}>Show me</Text>
                      <View style={styles.segmentedRow}>
                        {GENDER_OPTIONS.map((option) => (
                          <Pressable
                            key={option.id}
                            onPress={() => setGenderFilter(option.id)}
                            style={[
                              styles.segment,
                              genderFilter === option.id ? styles.segmentActive : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.segmentText,
                                genderFilter === option.id ? styles.segmentTextActive : null,
                              ]}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View style={styles.switchRow}>
                      <Text style={styles.filterLabel}>Verified creators only</Text>
                      <Switch
                        value={creatorVerifiedFilter}
                        onValueChange={setCreatorVerifiedFilter}
                      />
                    </View>
                  </ScrollView>

                  <View style={styles.filterFooter}>
                    <Button variant="ghost" size="sm" onPress={handleClearFilters}>
                      Clear
                    </Button>
                    <Button size="sm" onPress={handleApplyFilters}>
                      Apply filters
                    </Button>
                  </View>
                </View>
              </View>
            </Modal>
          ) : null}

          <View style={styles.categorySection}>
            <View style={styles.categoryRow}>
              {CATEGORY_CONFIG.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => setActiveCategory(category.id)}
                  style={[
                    styles.categoryChip,
                    activeCategory === category.id ? styles.categoryChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      activeCategory === category.id ? styles.categoryChipTextActive : null,
                    ]}
                  >
                    {category.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.deckArea}>
            {activeCategory === "profiles" ? (
              profilesLoading ? (
                <ActivityIndicator size="large" color="#2563eb" />
              ) : accessToken ? (
                <>
                  <ProfileSwipeDeck profiles={profileMatches} requestId={profileRequestId} />
                  {profilesError ? (
                    <Text style={styles.status}>{profilesError}</Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.status}>Sign in to see profile matches.</Text>
              )
            ) : loading ? (
              <ActivityIndicator size="large" color="#2563eb" />
            ) : (
              <SwipeDeck groups={grouped[activeCategory]} />
            )}
            {status ? <Text style={styles.status}>{status}</Text> : null}
          </View>
        </View>
        <BottomNav />
      </View>
      <FindMyTypeModal visible={findTypeOpen} onClose={() => setFindTypeOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  page: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 5,
    marginTop: 36,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  headerActions: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 3,
    marginTop: 1,
  },
  headerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  appNameWrap: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#eef2ff",
    borderColor: "#c7d2fe",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    shadowColor: "#6366f1",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  appName: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4338ca",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  appLogo: {
    width: 18,
    height: 18,
  },
  title: {
    fontSize: 8,
    fontWeight: "600",
    color: "rgba(15, 23, 42, 0.65)",
  },
  categorySection: {
    gap: 0,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 5,
  },
  categoryChip: {
    paddingHorizontal: 9.6,
    paddingVertical: 4.8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  categoryChipActive: {
    backgroundColor: "#1e293b",
    borderColor: "#1e293b",
  },
  categoryChipText: {
    fontSize: 9.6,
    fontWeight: "600",
    color: "#475569",
  },
  categoryChipTextActive: {
    color: "#ffffff",
  },
  filterOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  filterSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 14,
    maxHeight: "85%",
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filterKicker: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#94a3b8",
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  filterClose: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
  },
  filterDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  filters: {
    gap: 14,
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
  },
  filterField: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#ffffff",
  },
  filterInputHalf: {
    flex: 1,
  },
  helper: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 4,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  optionChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  optionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  optionTextActive: {
    color: "#ffffff",
  },
  segmentedRow: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  filterFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 6,
  },
  deckArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    paddingTop: 0,
  },
  status: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 8,
  },
});
