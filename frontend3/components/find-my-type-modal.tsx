"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

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
  { key: "education_level", label: "Education level", type: "single", options: ["high school", "college", "bachelors", "masters", "phd", "other"] },
  { key: "religion", label: "Religion", type: "single", options: ["christian", "muslim", "jewish", "hindu", "buddhist", "other", "none"] },
  { key: "political_views", label: "Political views", type: "single", options: ["liberal", "moderate", "conservative", "not political"] },
  { key: "smoking", label: "Smoking", type: "single", options: ["never", "sometimes", "often"] },
  { key: "drinking", label: "Drinking", type: "single", options: ["never", "sometimes", "often"] },
  { key: "diet", label: "Diet", type: "single", options: ["vegan", "vegetarian", "pescatarian", "omnivore"] },
  { key: "sleep_habits", label: "Sleep schedule", type: "single", options: ["early bird", "night owl", "flexible"] },
  { key: "social_energy", label: "Social energy", type: "single", options: ["introvert", "ambivert", "extrovert"] },
  { key: "fitness_level", label: "Fitness level", type: "single", options: ["never", "sometimes", "weekly", "daily"] },
  { key: "has_children", label: "Has kids", type: "single", options: ["yes", "no", "open", "unsure"] },
  { key: "wants_children", label: "Wants kids", type: "single", options: ["yes", "no", "open", "unsure"] },
  { key: "casual_dating", label: "Casual dating", type: "single", options: ["yes", "no"] },
  { key: "kink_friendly", label: "Kink friendly", type: "single", options: ["yes", "no"] },
  { key: "languages", label: "Languages", type: "text_list", placeholder: "English, French" },
  { key: "interests", label: "Interests", type: "text_list", placeholder: "Travel, Gym, Food" },
  { key: "pets", label: "Pets", type: "text_list", placeholder: "Dogs, Cats" },
  { key: "availability_windows", label: "Availability", type: "text_list", placeholder: "Weekends, Evenings" },
  { key: "ethnicity", label: "Ethnicity", type: "text", placeholder: "Optional" },
  { key: "zodiac_sign", label: "Zodiac sign", type: "single", options: ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"] },
  { key: "personality_type", label: "Personality type", type: "text", placeholder: "INTJ, ENFP..." },
  { key: "body_type", label: "Body type", type: "single", options: ["slim", "athletic", "average", "curvy", "plus-size"] },
  { key: "hair_color", label: "Hair color", type: "single", options: ["black", "brown", "blonde", "red", "gray", "other"] },
  { key: "eye_color", label: "Eye color", type: "single", options: ["brown", "blue", "green", "hazel", "gray", "other"] },
  { key: "income_bracket", label: "Income bracket", type: "single", options: ["<25k", "25-50k", "50-100k", "100k+"] },
  { key: "career_field", label: "Career field", type: "text", placeholder: "Tech, Finance..." },
  { key: "location_city", label: "City", type: "text", placeholder: "Lagos, Nairobi..." },
  { key: "location_country", label: "Country", type: "text", placeholder: "Nigeria, Kenya..." },
  { key: "travel_frequency", label: "Travel frequency", type: "single", options: ["rarely", "sometimes", "often"] },
  { key: "communication_style", label: "Communication style", type: "single", options: ["text", "call", "in-person", "mixed"] },
  { key: "love_languages", label: "Love languages", type: "text_list", placeholder: "Quality time, Acts of service" },
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

export default function FindMyTypeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { accessToken } = useAuth();
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
    if (!open) return;
    setStep(0);
    setIntent("friendship");
    setSelectedCriteria([]);
    setCriteriaValues({});
    setOffers([]);
    setResults([]);
    setRequestId(null);
    setError(null);
    setSentTo({});
  }, [open]);

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
    setOffers((prev) =>
      prev.includes(offer) ? prev.filter((item) => item !== offer) : [...prev, offer]
    );
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
            value = Number(value);
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Find my type
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">Match preferences</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
          {step === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Select what you are looking for.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { key: "friendship", label: "Friendship", desc: "Meet new people & hang out." },
                  { key: "relationship", label: "Relationship", desc: "Dates and long-term vibes." },
                  { key: "mutual_benefits", label: "Mutual benefits", desc: "Mutual benefit connections." },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setIntent(item.key as Intent)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      intent === item.key
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-base font-semibold">{item.label}</p>
                    <p className={`mt-1 text-xs ${intent === item.key ? "text-white/80" : "text-slate-500"}`}>
                      {item.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">
                  Pick up to {MAX_CRITERIA} criteria for your partner.
                </p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {selectedCriteria.length}/{MAX_CRITERIA} selected
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {CRITERIA.map((criterion) => {
                  const active = selectedCriteria.includes(criterion.key);
                  return (
                    <button
                      key={criterion.key}
                      type="button"
                      onClick={() => toggleCriterion(criterion.key)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {criterion.label}
                    </button>
                  );
                })}
              </div>

              {selectedCriteria.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800">Fill in selected criteria</h3>
                  {selectedCriteria.map((key) => {
                    const criterion = CRITERIA.find((item) => item.key === key);
                    if (!criterion) return null;
                    const value = criteriaValues[key];
                    if (criterion.type === "range") {
                      const range = (value as { min?: string; max?: string }) || {};
                      return (
                        <div key={key} className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-sm font-semibold text-slate-700">{criterion.label}</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <input
                              type="number"
                              value={range.min || ""}
                              onChange={(event) =>
                                updateCriterionValue(key, { ...range, min: event.target.value })
                              }
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              placeholder="Min"
                            />
                            <input
                              type="number"
                              value={range.max || ""}
                              onChange={(event) =>
                                updateCriterionValue(key, { ...range, max: event.target.value })
                              }
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              placeholder="Max"
                            />
                          </div>
                        </div>
                      );
                    }
                    if (criterion.type === "number") {
                      return (
                        <div key={key} className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-sm font-semibold text-slate-700">{criterion.label}</p>
                          <input
                            type="number"
                            value={(value as string) || ""}
                            onChange={(event) => updateCriterionValue(key, event.target.value)}
                            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            placeholder={criterion.placeholder}
                          />
                        </div>
                      );
                    }
                    if (criterion.type === "single") {
                      return (
                        <div key={key} className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-sm font-semibold text-slate-700">{criterion.label}</p>
                          <select
                            value={(value as string) || ""}
                            onChange={(event) => updateCriterionValue(key, event.target.value)}
                            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          >
                            <option value="">Select</option>
                            {(criterion.options || []).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                    if (criterion.type === "multi") {
                      const selected = Array.isArray(value) ? value : [];
                      return (
                        <div key={key} className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-sm font-semibold text-slate-700">{criterion.label}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(criterion.options || []).map((option) => {
                              const active = selected.includes(option);
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() =>
                                    updateCriterionValue(
                                      key,
                                      active
                                        ? selected.filter((item) => item !== option)
                                        : [...selected, option]
                                    )
                                  }
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                    active
                                      ? "border-slate-900 bg-slate-900 text-white"
                                      : "border-slate-200 text-slate-600"
                                  }`}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-sm font-semibold text-slate-700">{criterion.label}</p>
                        <input
                          value={(value as string) || ""}
                          onChange={(event) => updateCriterionValue(key, event.target.value)}
                          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          placeholder={criterion.placeholder || "Enter value"}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Select what you offer. Choose as many as you want.</p>
              <div className="flex flex-wrap gap-2">
                {OFFER_OPTIONS.map((offer) => {
                  const active = offers.includes(offer);
                  return (
                    <button
                      key={offer}
                      type="button"
                      onClick={() => toggleOffer(offer)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {offer}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Matches</h3>
                <span className="text-xs text-slate-500">{results.length} profiles</span>
              </div>
              {results.length === 0 ? (
                <p className="text-sm text-slate-600">No matches found yet.</p>
              ) : (
                <div className="space-y-3">
                  {results.map((result) => {
                    const name =
                      result.user.full_name || result.user.username || `User ${result.user.id}`;
                    const scoreLabel =
                      result.criteria_count > 0
                        ? `${result.match_count}/${result.criteria_count}`
                        : "0/0";
                    return (
                      <div
                        key={result.user.id}
                        className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        {result.user.profile_image_url ? (
                          <img
                            src={resolveMediaUrl(result.user.profile_image_url)}
                            alt={name}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-slate-200" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">{name}</p>
                          <p className="text-xs text-slate-500">
                            {result.user.age ? `${result.user.age} · ` : ""}
                            {[result.user.location_city, result.user.location_country]
                              .filter(Boolean)
                              .join(", ") || "Location unavailable"}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          Match {scoreLabel}
                        </span>
                        <Button
                          size="sm"
                          className="bg-blue-600 text-white hover:bg-blue-700"
                          onClick={() => handleSendRequest(result.user.id)}
                          disabled={Boolean(sentTo[result.user.id])}
                        >
                          {sentTo[result.user.id] ? "Sent" : "Send request"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            Step {step + 1} of 4
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep((prev) => prev - 1)}>
                Back
              </Button>
            ) : null}
            {step < 2 ? (
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setStep((prev) => prev + 1)}
              >
                Continue
              </Button>
            ) : null}
            {step === 2 ? (
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleFindMatches}
                disabled={isLoading}
              >
                {isLoading ? "Finding..." : "Find matches"}
              </Button>
            ) : null}
            {step === 3 ? (
              <Button variant="outline" onClick={onClose}>
                Done
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
