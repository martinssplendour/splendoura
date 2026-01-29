"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type ToggleRowProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </div>
      <label className="relative inline-flex h-6 w-11 cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-slate-200 transition peer-checked:bg-emerald-500" />
        <span className="relative ml-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
      </label>
    </div>
  );
}

type SectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

function SettingsSection({ title, description, children }: SectionProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="text-sm text-slate-600">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { user, accessToken, refreshSession, logout } = useAuth();
  const [showOrientation, setShowOrientation] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [incognitoMode, setIncognitoMode] = useState(false);
  const [globalMode, setGlobalMode] = useState(false);
  const [genderPref, setGenderPref] = useState("both");
  const [blockNudity, setBlockNudity] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicators, setTypingIndicators] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const details = (user?.profile_details as Record<string, unknown>) || {};
    const discovery = (user?.discovery_settings as Record<string, unknown>) || {};
    const safety = (details.safety_settings as Record<string, unknown>) || {};
    const notifications = (details.notification_settings as Record<string, unknown>) || {};
    const chat = (details.chat_settings as Record<string, unknown>) || {};

    setShowOrientation((details.show_orientation as boolean) ?? true);
    setProfileVisibility(discovery.profile_visibility !== false);
    setIncognitoMode(Boolean(discovery.incognito_mode));
    setGlobalMode(Boolean(discovery.global_mode));
    const genders = discovery.genders as string[] | undefined;
    const hasMale = genders?.includes("male");
    const hasFemale = genders?.includes("female");
    if (hasMale && hasFemale) {
      setGenderPref("both");
    } else if (hasFemale) {
      setGenderPref("female");
    } else if (hasMale) {
      setGenderPref("male");
    }
    setBlockNudity(Boolean(safety.block_nudity));
    setPushNotifs((notifications.push_enabled as boolean) ?? true);
    setEmailNotifs((notifications.email_enabled as boolean) ?? false);
    setReadReceipts((chat.read_receipts as boolean) ?? true);
    setTypingIndicators((chat.typing_indicators as boolean) ?? true);
  }, [user]);

  const handleSave = async () => {
    if (!accessToken) {
      setStatus("Sign in to update settings.");
      return;
    }
    setSaving(true);
    setStatus(null);

    try {
      const details = (user?.profile_details as Record<string, unknown>) || {};
      const discovery = (user?.discovery_settings as Record<string, unknown>) || {};
      const safety = (details.safety_settings as Record<string, unknown>) || {};
      const notifications = (details.notification_settings as Record<string, unknown>) || {};
      const chat = (details.chat_settings as Record<string, unknown>) || {};

      const profile_details = {
        ...details,
        show_orientation: showOrientation,
        safety_settings: {
          ...safety,
          block_nudity: blockNudity,
        },
        notification_settings: {
          ...notifications,
          push_enabled: pushNotifs,
          email_enabled: emailNotifs,
        },
        chat_settings: {
          ...chat,
          read_receipts: readReceipts,
          typing_indicators: typingIndicators,
        },
      };

      const discovery_settings = {
        ...discovery,
        profile_visibility: profileVisibility,
        incognito_mode: incognitoMode,
        global_mode: globalMode,
        genders:
          genderPref === "male"
            ? ["male"]
            : genderPref === "female"
              ? ["female"]
              : ["male", "female"],
      };

      const res = await apiFetch("/users/me", {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({ profile_details, discovery_settings }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to update settings.");
      }

      await refreshSession();
      setStatus("Settings saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update settings.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">Sign in to manage your account settings.</p>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeft size={16} /> Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">Settings</p>
          <h1 className="text-2xl font-semibold text-slate-900">Profile & preferences</h1>
          <p className="text-sm text-slate-600">Control privacy, discovery, and notifications.</p>
        </div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Back to profile
        </Link>
      </div>

      <SettingsSection title="Account" description="Profile basics and verification status.">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Verification status</p>
            <p className="text-xs text-slate-500">{user?.verification_status || "unverified"}</p>
          </div>
          <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
            <Link href="/profile">Edit profile</Link>
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Privacy & visibility">
        <ToggleRow
          label="Profile visible"
          description="Let others view your profile and content."
          checked={profileVisibility}
          onChange={setProfileVisibility}
        />
        <ToggleRow
          label="Incognito mode"
          description="Browse without appearing in discovery lists."
          checked={incognitoMode}
          onChange={setIncognitoMode}
        />
        <ToggleRow
          label="Show orientation"
          description="Display sexual orientation on your profile."
          checked={showOrientation}
          onChange={setShowOrientation}
        />
      </SettingsSection>

      <SettingsSection title="Discovery & matching">
        <ToggleRow
          label="Global mode"
          description="Expand recommendations beyond your local area."
          checked={globalMode}
          onChange={setGlobalMode}
        />
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm font-semibold text-slate-700">Show me</p>
          <select
            value={genderPref}
            onChange={(event) => setGenderPref(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="both">Men & women</option>
            <option value="female">Women</option>
            <option value="male">Men</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">
          Age range and distance filters are managed in your profile.
        </p>
      </SettingsSection>

      <SettingsSection title="Safety">
        <ToggleRow
          label="Block nudity in chat"
          description="Filter sensitive images in direct messages."
          checked={blockNudity}
          onChange={setBlockNudity}
        />
        <Button asChild variant="outline" className="border-emerald-200 text-emerald-700">
          <Link href="/safety">Open Safety Center</Link>
        </Button>
      </SettingsSection>

      <SettingsSection title="Notifications">
        <ToggleRow
          label="Push notifications"
          description="Alerts for matches, messages, and group updates."
          checked={pushNotifs}
          onChange={setPushNotifs}
        />
        <ToggleRow
          label="Email notifications"
          description="Weekly summaries and important alerts."
          checked={emailNotifs}
          onChange={setEmailNotifs}
        />
      </SettingsSection>

      <SettingsSection title="Chat & social">
        <ToggleRow
          label="Read receipts"
          description="Let others see when you have read their message."
          checked={readReceipts}
          onChange={setReadReceipts}
        />
        <ToggleRow
          label="Typing indicators"
          description="Show when you are typing."
          checked={typingIndicators}
          onChange={setTypingIndicators}
        />
      </SettingsSection>

      <SettingsSection title="Payments & subscriptions" description="Billing tools are coming soon.">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Upgrade plans, boosts, and subscriptions will appear here.
        </div>
      </SettingsSection>

      <SettingsSection title="Legal & support" description="Policies and support resources.">
        <div className="flex flex-col gap-2 text-sm text-slate-600">
          <Link href="/safety" className="font-semibold text-emerald-600 hover:text-emerald-700">
            Safety guidelines
          </Link>
          <span>Terms of service</span>
          <span>Privacy policy</span>
          <span>Contact support</span>
        </div>
      </SettingsSection>

      {status ? <p className="text-sm text-slate-600">{status}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {saving ? "Saving..." : "Save settings"}
        </Button>
        <Button
          variant="outline"
          onClick={logout}
          className="border-rose-200 text-rose-600 hover:text-rose-700"
        >
          Log out
        </Button>
      </div>
    </div>
  );
}
