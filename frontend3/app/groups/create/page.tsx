"use client";

import GroupFormWizard from "@/components/groups/group-form-wizard";

export default function CreateGroupPage() {
  return (
    <div className="relative overflow-hidden rounded-[40px] border border-white/70 bg-white/70 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#e2f4ff_0%,_#f8fbff_40%,_#fff1ea_100%)] opacity-80" />
      <div className="relative space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Create your event
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Publish a group in minutes
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Share the basics, set requirements, and go live with a swipe-ready card.
          </p>
        </div>
        <GroupFormWizard />
      </div>
    </div>
  );
}
