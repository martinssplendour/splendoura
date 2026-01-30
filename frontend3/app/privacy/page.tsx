"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const SECTIONS: {
  title: string;
  body: string;
  bullets?: string[];
}[] = [
  {
    title: "Overview",
    body:
      "This Privacy Policy explains how Splendoure collects, uses, and shares information when you use our website, mobile app, and related services (the \"Services\").",
  },
  {
    title: "Information we collect",
    bullets: [
      "Account details: name, username, email, password (hashed), and verification status.",
      "Profile data you provide: bio, photos, videos, preferences, interests, and discovery settings.",
      "Verification data: profile verification photos and optional ID verification images.",
      "Messages and content: chats, voice notes, and media you send (including metadata such as time sent).",
      "Location data: precise location when you enable it, or approximate location based on IP.",
      "Usage and device data: log files, IP address, device identifiers, app version, and crash data.",
      "Cookies and similar technologies on the web for session and analytics purposes.",
    ],
    body:
      "Some information is required to provide the Services. You may choose to limit optional data, but certain features may not work without it.",
  },
  {
    title: "How we use your information",
    bullets: [
      "Provide and improve the Services, including matching and discovery.",
      "Enable profile creation, group participation, and messaging.",
      "Moderate content and support safety features (for example, sensitive-image checks).",
      "Communicate with you about updates, support requests, and security notices.",
      "Comply with legal obligations and enforce our terms.",
    ],
    body:
      "We process data based on your consent, the performance of a contract with you, our legitimate interests (such as safety and fraud prevention), and legal obligations.",
  },
  {
    title: "How we share information",
    bullets: [
      "With other users: your profile information and content you choose to share is visible to others based on your settings.",
      "With service providers: hosting, storage, analytics, communications, and customer support.",
      "With payment processors if you purchase services (if enabled). We do not store full payment card numbers.",
      "With law enforcement or regulators when required by law or to protect safety and rights.",
    ],
    body:
      "We do not sell your personal information. We only share what is necessary for the Services.",
  },
  {
    title: "Data retention",
    body:
      "We retain your information while your account is active and as needed to provide the Services. You can request deletion at any time. We may keep limited data to comply with legal obligations or resolve disputes.",
  },
  {
    title: "Your choices and rights",
    bullets: [
      "Access, update, or delete your profile information within the app.",
      "Control visibility and discovery settings in your profile and settings.",
      "Opt out of marketing communications where available.",
      "Request a copy of your data or deletion by contacting us.",
    ],
    body:
      "If you are in the EEA, UK, or other regions with data protection laws, you may have additional rights such as portability and objection to processing.",
  },
  {
    title: "Security",
    body:
      "We use administrative, technical, and physical safeguards to protect your data. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.",
  },
  {
    title: "International transfers",
    body:
      "Your information may be processed in countries other than where you live. We use safeguards to protect your data when transferred internationally.",
  },
  {
    title: "Children's privacy",
    body:
      "Splendoure is intended for adults. We do not knowingly collect information from anyone under 18. If you believe a minor has provided data, contact us and we will remove it.",
  },
  {
    title: "Changes to this policy",
    body:
      "We may update this policy from time to time. If we make material changes, we will notify you through the Services or by other means.",
  },
  {
    title: "Contact",
    body:
      "For questions or requests, contact us at support@splendoure.com.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="rounded-none border-0 bg-white p-6 sm:rounded-3xl sm:border sm:border-slate-200">
        <p className="text-xs font-semibold uppercase text-slate-400">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-600">Last updated: January 29, 2026</p>
      </div>

      {SECTIONS.map((section) => (
        <div
          key={section.title}
          className="rounded-none border-0 bg-white p-6 sm:rounded-3xl sm:border sm:border-slate-200"
        >
          <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{section.body}</p>
          {section.bullets ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}

      <div className="rounded-none border-0 bg-white p-6 sm:rounded-3xl sm:border sm:border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">More resources</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/safety" className="font-semibold text-emerald-600 hover:text-emerald-700">
            Safety Center
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/settings" className="font-semibold text-slate-600 hover:text-slate-900">
            Settings
          </Link>
        </div>
        <Button asChild variant="outline" className="mt-4">
          <a href="mailto:support@splendoure.com">Email support@splendoure.com</a>
        </Button>
      </div>
    </div>
  );
}
