"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { SignedImage } from "@/components/signed-media";

type Intent = "friendship" | "relationship" | "mutual_benefits";
type CriterionType = "range" | "number" | "single" | "multi" | "text" | "text_list";

type CriterionValue =
  | { min?: string; max?: string }
  | string
  | string[]
  | number
  | null;

type CriterionDef = {
  key: string;
  label: string;
  type: CriterionType;
  options?: string[];
  placeholder?: string;
};

const CRITERIA: CriterionDef[] = [
  { key: "age_range", label: "Age range", type: "range" },
  { key: "distance_km", label: "Distance (km)", type: "number", placeholder: "e.g. 25" },
  { key: "height_range", label: "Height (cm)", type: "range" },
  { key: "weight_range", label: "Weight (kg)", type: "range" },
  { key: "income_range", label: "Income range (USD)", type: "range" },
  { key: "gender", label: "Gender", type: "multi", options: ["male", "female", "other"] },
  {
    key: "sexual_orientation",
    label: "Sexual orientation",
    type: "multi",
    options: ["straight", "gay", "lesbian", "bisexual", "pansexual", "asexual", "queer"],
  },
  {
    key: "relationship_preference",
    label: "Relationship style",
    type: "single",
    options: ["monogamy", "non-monogamy", "open", "polyamory"],
  },
  {
    key: "education_level",
    label: "Education level",
    type: "single",
    options: ["high school", "college", "bachelors", "masters", "phd", "other"],
  },
  {
    key: "religion",
    label: "Religion",
    type: "single",
    options: ["christian", "muslim", "jewish", "hindu", "buddhist", "other", "none"],
  },
  {
    key: "political_views",
    label: "Political views",
    type: "single",
    options: ["liberal", "moderate", "conservative", "not political"],
  },
  { key: "smoking", label: "Smoking", type: "single", options: ["never", "sometimes", "often"] },
  { key: "drinking", label: "Drinking", type: "single", options: ["never", "sometimes", "often"] },
  {
    key: "diet",
    label: "Diet",
    type: "single",
    options: ["vegan", "vegetarian", "pescatarian", "omnivore"],
  },
  {
    key: "sleep_habits",
    label: "Sleep schedule",
    type: "single",
    options: ["early bird", "night owl", "flexible"],
  },
  {
    key: "social_energy",
    label: "Social energy",
    type: "single",
    options: ["introvert", "ambivert", "extrovert"],
  },
  {
    key: "fitness_level",
    label: "Fitness level",
    type: "single",
    options: ["never", "sometimes", "weekly", "daily"],
  },
  {
    key: "has_children",
    label: "Has kids",
    type: "single",
    options: ["yes", "no", "open", "unsure"],
  },
  {
    key: "wants_children",
    label: "Wants kids",
    type: "single",
    options: ["yes", "no", "open", "unsure"],
  },
  { key: "casual_dating", label: "Casual dating", type: "single", options: ["yes", "no"] },
  { key: "kink_friendly", label: "Kink friendly", type: "single", options: ["yes", "no"] },
  { key: "languages", label: "Languages", type: "text_list", placeholder: "English, French" },
  { key: "interests", label: "Interests", type: "text_list", placeholder: "Travel, Gym, Food" },
  { key: "pets", label: "Pets", type: "text_list", placeholder: "Dogs, Cats" },
  {
    key: "availability_windows",
    label: "Availability",
    type: "text_list",
    placeholder: "Weekends, Evenings",
  },
  { key: "ethnicity", label: "Ethnicity", type: "text", placeholder: "Optional" },
  {
    key: "zodiac_sign",
    label: "Zodiac sign",
    type: "single",
    options: [
      "aries",
      "taurus",
      "gemini",
      "cancer",
      "leo",
      "virgo",
      "libra",
      "scorpio",
      "sagittarius",
      "capricorn",
      "aquarius",
      "pisces",
    ],
  },
  { key: "personality_type", label: "Personality type", type: "text", placeholder: "INTJ" },
  {
    key: "body_type",
    label: "Body type",
    type: "single",
    options: ["slim", "athletic", "average", "curvy", "plus-size"],
  },
  {
    key: "hair_color",
    label: "Hair color",
    type: "single",
    options: ["black", "brown", "blonde", "red", "gray", "other"],
  },
  {
    key: "eye_color",
    label: "Eye color",
    type: "single",
    options: ["brown", "blue", "green", "hazel", "gray", "other"],
  },
  {
    key: "income_bracket",
    label: "Income bracket",
    type: "single",
    options: ["<25k", "25-50k", "50-100k", "100k+"],
  },
  { key: "career_field", label: "Career field", type: "text", placeholder: "Tech, Finance" },
  { key: "location_city", label: "City", type: "text", placeholder: "Lagos, Nairobi" },
  { key: "location_country", label: "Country", type: "text", placeholder: "Nigeria, Kenya" },
  {
    key: "travel_frequency",
    label: "Travel frequency",
    type: "single",
    options: ["rarely", "sometimes", "often"],
  },
  {
    key: "communication_style",
    label: "Communication style",
    type: "single",
    options: ["text", "call", "in-person", "mixed"],
  },
  {
    key: "love_languages",
    label: "Love languages",
    type: "text_list",
    placeholder: "Quality time, Acts of service",
  },
  { key: "verified_status", label: "Verified status", type: "single", options: ["verified", "any"] },
];

const OFFER_OPTIONS = [
  "Attractive / well-groomed",
  "Fit / active",
  "Kind / empathetic",
  "Loyal / committed",
  "Fun / adventurous",
  "Ambitious / driven",
  "Emotionally available",
  "Great communicator",
  "Stable / consistent",
  "Sense of humor",
  "Romantic / affectionate",
  "Thoughtful / supportive",
  "Creative / artistic",
  "Good listener",
  "Family-oriented",
  "Great planner",
  "Travel-ready",
  "Financially responsible",
  "Discreet / private",
  "Respectful of boundaries",
  "Verified profile",
  "Mutual benefits support",
  "Mentorship / networking",
  "Culturally open-minded",
  "Flexible schedule",
  "Generous",
  "Protective",
  "Great cook",
  "Stylish",
  "Low drama",
];

type MatchResult = {
  user: {
    id: number;
    full_name?: string | null;
    username?: string | null;
    age?: number | null;
    location_city?: string | null;
    location_country?: string | null;
    profile_image_url?: string | null;
  };
  match_count: number;
  criteria_count: number;
  score: number;
};

type MatchResponse = {
  request: { id: number };
  results: MatchResult[];
};

const MAX_CRITERIA = 7;

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const isValueEmpty = (def: CriterionDef, value: CriterionValue) => {
  if (def.type === "range") {
    const range = value as { min?: string; max?: string } | undefined;
    return !range || (!range.min && !range.max);
  }
  if (def.type === "number") {
    return value === null || value === undefined || value === "";
  }
  if (def.type === "multi") {
    return !Array.isArray(value) || value.length === 0;
  }
  return value === null || value === undefined || value === "";
};

type ModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function FindMyTypeModal({ visible, onClose }: ModalProps) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<Intent>("friendship");
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);
  const [criteriaValues, setCriteriaValues] = useState<Record<string, CriterionValue>>({});
  const [offers, setOffers] = useState<string[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setIntent("friendship");
    setSelectedCriteria([]);
    setCriteriaValues({});
    setOffers([]);
    setResults([]);
    setRequestId(null);
    setError(null);
    setSentTo({});
  }, [visible]);

  const missingCriteria = useMemo(() => {
    const missing: string[] = [];
    selectedCriteria.forEach((key) => {
      const def = CRITERIA.find((item) => item.key === key);
      if (!def) return;
      const value = criteriaValues[key];
      if (isValueEmpty(def, value)) {
        missing.push(def.label);
      }
    });
    return missing;
  }, [criteriaValues, selectedCriteria]);

  const toggleCriterion = (key: string) => {
    if (selectedCriteria.includes(key)) {
      setSelectedCriteria((prev) => prev.filter((item) => item !== key));
      setCriteriaValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    if (selectedCriteria.length >= MAX_CRITERIA) {
      setError(`You can only pick up to ${MAX_CRITERIA} criteria.`);
      return;
    }
    setError(null);
    setSelectedCriteria((prev) => [...prev, key]);
  };

  const updateCriterionValue = (key: string, value: CriterionValue) => {
    setCriteriaValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleOffer = (offer: string) => {
    setOffers((prev) => (prev.includes(offer) ? prev.filter((item) => item !== offer) : [...prev, offer]));
  };

  const handleFindMatches = async () => {
    if (!accessToken) {
      setError("Sign in to find matches.");
      return;
    }
    if (missingCriteria.length > 0) {
      setError("Please fill in values for all selected criteria.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        intent,
        criteria: selectedCriteria.map((key) => {
          const def = CRITERIA.find((item) => item.key === key);
          let value = criteriaValues[key];
          if (def?.type === "text_list" && typeof value === "string") {
            value = parseList(value);
          }
          if (def?.type === "number" && typeof value === "string") {
            const numeric = Number(value);
            value = Number.isNaN(numeric) ? null : numeric;
          }
          return { key, value };
        }),
        offers,
      };

      const res = await apiFetch("/match/requests", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Unable to find matches right now.");
      }
      const data: MatchResponse = await res.json();
      setResults(data.results || []);
      setRequestId(data.request?.id ?? null);
      setStep(3);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to find matches.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRequest = async (userId: number) => {
    if (!accessToken || !requestId) return;
    try {
      const res = await apiFetch(`/match/requests/${requestId}/send/${userId}`, {
        method: "POST",
        token: accessToken,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Unable to send request.");
      }
      setSentTo((prev) => ({ ...prev, [userId]: true }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send request.";
      setError(message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>Find my type</Text>
              <Text style={styles.title}>Match preferences</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {step === 0 ? (
              <View style={styles.section}>
                <Text style={styles.subtitle}>Select what you are looking for.</Text>
                <View style={styles.intentGrid}>
                  {[
                    { key: "friendship", label: "Friendship", desc: "Meet new people & hang out." },
                    { key: "relationship", label: "Relationship", desc: "Dates and long-term vibes." },
                    {
                      key: "mutual_benefits",
                      label: "Mutual benefits",
                      desc: "Mutual benefit connections.",
                    },
                  ].map((item) => {
                    const active = intent === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setIntent(item.key as Intent)}
                        style={[styles.intentCard, active ? styles.intentCardActive : null]}
                      >
                        <Text style={[styles.intentLabel, active ? styles.intentLabelActive : null]}>
                          {item.label}
                        </Text>
                        <Text style={[styles.intentDesc, active ? styles.intentDescActive : null]}>
                          {item.desc}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {step === 1 ? (
              <View style={styles.section}>
                <View style={styles.rowBetween}>
                  <Text style={styles.subtitle}>Pick up to {MAX_CRITERIA} criteria.</Text>
                  <View style={styles.counterPill}>
                    <Text style={styles.counterText}>
                      {selectedCriteria.length}/{MAX_CRITERIA}
                    </Text>
                  </View>
                </View>

                <View style={styles.chipRow}>
                  {CRITERIA.map((criterion) => {
                    const active = selectedCriteria.includes(criterion.key);
                    return (
                      <Pressable
                        key={criterion.key}
                        onPress={() => toggleCriterion(criterion.key)}
                        style={[styles.chip, active ? styles.chipActive : null]}
                      >
                        <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                          {criterion.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {selectedCriteria.length > 0 ? (
                  <View style={styles.criteriaList}>
                    {selectedCriteria.map((key) => {
                      const criterion = CRITERIA.find((item) => item.key === key);
                      if (!criterion) return null;
                      const value = criteriaValues[key];

                      if (criterion.type === "range") {
                        const range = (value as { min?: string; max?: string }) || {};
                        return (
                          <View key={key} style={styles.card}>
                            <Text style={styles.cardTitle}>{criterion.label}</Text>
                            <View style={styles.row}>
                              <TextInput
                                value={range.min || ""}
                                onChangeText={(text) => updateCriterionValue(key, { ...range, min: text })}
                                placeholder="Min"
                                keyboardType="numeric"
                                style={styles.input}
                              />
                              <TextInput
                                value={range.max || ""}
                                onChangeText={(text) => updateCriterionValue(key, { ...range, max: text })}
                                placeholder="Max"
                                keyboardType="numeric"
                                style={styles.input}
                              />
                            </View>
                          </View>
                        );
                      }

                      if (criterion.type === "number") {
                        return (
                          <View key={key} style={styles.card}>
                            <Text style={styles.cardTitle}>{criterion.label}</Text>
                            <TextInput
                              value={(value as string) || ""}
                              onChangeText={(text) => updateCriterionValue(key, text)}
                              placeholder={criterion.placeholder}
                              keyboardType="numeric"
                              style={styles.input}
                            />
                          </View>
                        );
                      }

                      if (criterion.type === "single") {
                        const selected = typeof value === "string" ? value : "";
                        return (
                          <View key={key} style={styles.card}>
                            <Text style={styles.cardTitle}>{criterion.label}</Text>
                            <View style={styles.chipRow}>
                              {(criterion.options || []).map((option) => {
                                const active = selected === option;
                                return (
                                  <Pressable
                                    key={option}
                                    onPress={() => updateCriterionValue(key, option)}
                                    style={[styles.chip, active ? styles.chipActive : null]}
                                  >
                                    <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                                      {option}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        );
                      }

                      if (criterion.type === "multi") {
                        const selected = Array.isArray(value) ? value : [];
                        return (
                          <View key={key} style={styles.card}>
                            <Text style={styles.cardTitle}>{criterion.label}</Text>
                            <View style={styles.chipRow}>
                              {(criterion.options || []).map((option) => {
                                const active = selected.includes(option);
                                return (
                                  <Pressable
                                    key={option}
                                    onPress={() =>
                                      updateCriterionValue(
                                        key,
                                        active
                                          ? selected.filter((item) => item !== option)
                                          : [...selected, option]
                                      )
                                    }
                                    style={[styles.chip, active ? styles.chipActive : null]}
                                  >
                                    <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                                      {option}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        );
                      }

                      return (
                        <View key={key} style={styles.card}>
                          <Text style={styles.cardTitle}>{criterion.label}</Text>
                          <TextInput
                            value={(value as string) || ""}
                            onChangeText={(text) => updateCriterionValue(key, text)}
                            placeholder={criterion.placeholder || "Enter value"}
                            style={styles.input}
                          />
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {step === 2 ? (
              <View style={styles.section}>
                <Text style={styles.subtitle}>Select what you offer. Choose as many as you want.</Text>
                <View style={styles.chipRow}>
                  {OFFER_OPTIONS.map((offer) => {
                    const active = offers.includes(offer);
                    return (
                      <Pressable
                        key={offer}
                        onPress={() => toggleOffer(offer)}
                        style={[styles.chip, active ? styles.offerActive : null]}
                      >
                        <Text style={[styles.chipText, active ? styles.offerTextActive : null]}>
                          {offer}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {step === 3 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Matches</Text>
                {results.length === 0 ? (
                  <Text style={styles.subtitle}>
                    Type does not exist yet. Try adjusting your criteria.
                  </Text>
                ) : (
                  <View style={styles.resultList}>
                    {results.map((result) => {
                      const name =
                        result.user.full_name || result.user.username || `User ${result.user.id}`;
                      const scoreLabel =
                        result.criteria_count > 0
                          ? `${result.match_count}/${result.criteria_count}`
                          : "0/0";
                      return (
                        <View key={result.user.id} style={styles.resultCard}>
                          <Pressable
                            style={styles.resultMain}
                            onPress={() => router.push(`/users/${result.user.id}`)}
                          >
                            {result.user.profile_image_url ? (
                              <SignedImage uri={result.user.profile_image_url} style={styles.avatar} />
                            ) : (
                              <View style={styles.avatarFallback} />
                            )}
                            <View style={styles.resultInfo}>
                              <Text style={styles.resultName}>{name}</Text>
                              <Text style={styles.resultMeta}>
                                {result.user.age ? `${result.user.age} - ` : ""}
                                {[result.user.location_city, result.user.location_country]
                                  .filter(Boolean)
                                  .join(", ") || "Location unavailable"}
                              </Text>
                            </View>
                          </Pressable>
                          <View style={styles.scorePill}>
                            <Text style={styles.scoreText}>Match {scoreLabel}</Text>
                          </View>
                          <Pressable
                            onPress={() => router.push(`/users/${result.user.id}`)}
                            style={styles.viewProfileButton}
                          >
                            <Text style={styles.viewProfileText}>View</Text>
                          </Pressable>
                          <Button
                            size="sm"
                            onPress={() => handleSendRequest(result.user.id)}
                            disabled={Boolean(sentTo[result.user.id])}
                          >
                            {sentTo[result.user.id] ? "Sent" : "Send"}
                          </Button>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.stepText}>Step {step + 1} of 4</Text>
            <View style={styles.footerActions}>
              {step > 0 ? (
                <Button variant="outline" onPress={() => setStep((prev) => prev - 1)}>
                  Back
                </Button>
              ) : null}
              {step < 2 ? (
                <Button onPress={() => setStep((prev) => prev + 1)}>Continue</Button>
              ) : null}
              {step === 2 ? (
                <Button onPress={handleFindMatches} disabled={isLoading}>
                  {isLoading ? "Finding..." : "Find matches"}
                </Button>
              ) : null}
              {step === 3 ? (
                <Button variant="outline" onPress={onClose}>
                  Done
                </Button>
              ) : null}
            </View>
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.loadingText}>Loading matches...</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    padding: 16,
    justifyContent: "center",
  },
  sheet: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#94a3b8",
    fontWeight: "700",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  closeButton: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  body: {
    padding: 16,
    paddingBottom: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  intentGrid: {
    gap: 10,
  },
  intentCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#ffffff",
  },
  intentCardActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  intentLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  intentLabelActive: {
    color: "#ffffff",
  },
  intentDesc: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  intentDescActive: {
    color: "rgba(255,255,255,0.8)",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counterPill: {
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  chipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  offerActive: {
    borderColor: "#10b981",
    backgroundColor: "#10b981",
  },
  offerTextActive: {
    color: "#ffffff",
  },
  criteriaList: {
    gap: 12,
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  resultList: {
    gap: 10,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  resultMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 160,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e2e8f0",
  },
  resultInfo: {
    flex: 1,
    minWidth: 120,
  },
  resultName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  resultMeta: {
    fontSize: 12,
    color: "#64748b",
  },
  scorePill: {
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  viewProfileButton: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewProfileText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  errorBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 10,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    padding: 12,
    gap: 10,
  },
  stepText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  footerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: "#475569",
  },
});
