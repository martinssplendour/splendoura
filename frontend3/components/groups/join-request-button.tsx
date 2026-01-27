// components/groups/join-request-button.tsx
"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

// 1. Define the structure for individual group requirements
export interface GroupRequirement {
  id?: number;
  applies_to: "male" | "female" | "other" | "all";
  min_age: number;
  max_age: number;
  consent_flags?: Record<string, boolean>;
  additional_requirements?: string | null;
}

// 2. Define the Props for this component
interface JoinRequestButtonProps {
  groupId: number;
  requirements: GroupRequirement[];
}

export default function JoinRequestButton({ groupId, requirements }: JoinRequestButtonProps) {
  const { user, accessToken } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState("");
  const [consentSelections, setConsentSelections] = useState<Record<string, boolean>>({});

  const activeRequirement = useMemo(() => {
    if (!requirements.length) return null;
    if (!user?.gender) return requirements[0];
    return (
      requirements.find((req) => req.applies_to === user.gender) ||
      requirements.find((req) => req.applies_to === "all") ||
      requirements[0]
    );
  }, [requirements, user?.gender]);

  const consentKeys = useMemo(() => {
    if (!activeRequirement?.consent_flags) return [];
    return Object.keys(activeRequirement.consent_flags);
  }, [activeRequirement]);

  const requiredConsentKeys = useMemo(() => {
    if (!activeRequirement?.consent_flags) return [];
    return Object.entries(activeRequirement.consent_flags)
      .filter(([, required]) => required)
      .map(([key]) => key);
  }, [activeRequirement]);

  const handleToggleConsent = (key: string) => {
    setConsentSelections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Example of using the requirements logic (Safety check)
  const handleJoinRequest = async () => {
    if (!accessToken) {
      setStatusMessage("Please sign in to request membership.");
      return;
    }
    if (joinMessage.trim().length > 500) {
      setStatusMessage("Join message must be 500 characters or less.");
      return;
    }
    if (requiredConsentKeys.some((key) => !consentSelections[key])) {
      setStatusMessage("Please accept the required consent checks.");
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const consentFlags: Record<string, boolean> = {};
      consentKeys.forEach((key) => {
        consentFlags[key] = Boolean(consentSelections[key]);
      });

      const res = await apiFetch(`/groups/${groupId}/join`, {
        method: "POST",
        body: JSON.stringify({
          consent_flags: consentFlags,
          request_message: joinMessage.trim() || null,
        }),
        token: accessToken,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to send join request.");
      }
      setStatusMessage("Request sent. The creator will review it.");
      setShowConsent(false);
      setAgreed(false);
      setJoinMessage("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send join request.";
      setStatusMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <Button asChild className="w-full bg-blue-600 text-white hover:bg-blue-700">
        <Link href="/auth/login">Login to Join</Link>
      </Button>
    );
  }
  if (!user.profile_image_url) {
    return (
      <Button asChild className="w-full bg-blue-600 text-white hover:bg-blue-700">
        <Link href="/profile">Upload a photo to Join</Link>
      </Button>
    );
  }
  return (
    <div className="space-y-4">
      {showConsent ? (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in slide-in-from-top-2">
          <p className="text-sm mb-4 font-medium text-blue-800">Confirm requirements</p>
          {consentKeys.length === 0 ? (
            <label className="flex items-start gap-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-600">
                I have read the requirements and understand this is a shared experience.
              </span>
            </label>
          ) : (
            <div className="space-y-2 mb-4">
              {consentKeys.map((key) => (
                <label key={key} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(consentSelections[key])}
                    onChange={() => handleToggleConsent(key)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">
                    {key}
                    {requiredConsentKeys.includes(key) ? (
                      <span className="ml-1 text-xs text-rose-600">(required)</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="space-y-2 mb-4">
            <label className="text-xs font-semibold uppercase text-slate-400">Add a note</label>
            <textarea
              value={joinMessage}
              onChange={(event) => setJoinMessage(event.target.value)}
              placeholder="Introduce yourself or share why you'd be a great fit."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              rows={3}
            />
            <p className="text-xs text-slate-500">Max 500 characters.</p>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setShowConsent(false)}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={(consentKeys.length === 0 ? !agreed : false) || isSubmitting}
              onClick={handleJoinRequest}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isSubmitting ? "Sending..." : "Send Request"}
            </Button>
          </div>
          {statusMessage ? (
            <p className="text-sm text-blue-700">{statusMessage}</p>
          ) : null}
        </div>
      ) : (
        <Button
          className="w-full h-12 text-lg bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => setShowConsent(true)}
        >
          Request to Join
        </Button>
      )}
    </div>
  );
}
