// components/groups/join-request-button.tsx
"use client";
import { useState } from "react";
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
  consent_flags: Record<string, boolean>;
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

  // Example of using the requirements logic (Safety check)
  const handleJoinRequest = async () => {
    if (!accessToken) {
      setStatusMessage("Please sign in to request membership.");
      return;
    }
    if (!agreed) {
      setStatusMessage("You must accept the requirements before sending a request.");
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const consentFlags: Record<string, boolean> = {};
      requirements.forEach((req) => {
        if (!req.consent_flags) return;
        Object.keys(req.consent_flags).forEach((key) => {
          consentFlags[key] = true;
        });
      });

      const res = await apiFetch(`/groups/${groupId}/join`, {
        method: "POST",
        body: JSON.stringify({ consent_flags: consentFlags }),
        token: accessToken,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to send join request.");
      }
      setStatusMessage("Request sent. The creator will review it.");
      setShowConsent(false);
      setAgreed(false);
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
          <p className="text-sm mb-4 font-medium text-blue-800">Please confirm:</p>
          <label className="flex items-start gap-2 cursor-pointer mb-4">
            <input 
              type="checkbox" 
              checked={agreed} 
              onChange={(e) => setAgreed(e.target.checked)} 
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
            />
            <span className="text-sm text-slate-600">
              I have read the requirements ({requirements.length} declared) and understand this is a social activity with shared responsibility.
            </span>
          </label>
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
              disabled={!agreed || isSubmitting}
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
