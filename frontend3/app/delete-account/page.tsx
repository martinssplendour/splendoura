export const metadata = {
  title: "Delete Account | Splendoure",
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold">Delete your Splendoure account</h1>
          <p className="mt-2 text-sm text-slate-600">
            This page explains how to delete your account and what data is removed.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">How to delete your account</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>Sign in to your Splendoure account.</li>
            <li>Open Settings.</li>
            <li>Scroll to the “Danger zone” section.</li>
            <li>Select “Delete account” and confirm.</li>
          </ol>
          <p className="mt-3 text-sm text-slate-600">
            If you cannot access your account, email{" "}
            <span className="font-semibold">support@splendoure.com</span> from your registered
            email address.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">What data is deleted</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>Your profile details, photos, and media.</li>
            <li>Your discovery preferences and settings.</li>
            <li>Your memberships and visibility within groups.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">What data may be retained</h2>
          <p className="mt-3 text-sm text-slate-600">
            We may retain limited data for safety, abuse prevention, or legal compliance. This may
            include basic audit logs and records needed to enforce our terms or resolve disputes.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Retained data is kept only as long as necessary for these purposes.
          </p>
        </section>
      </div>
    </main>
  );
}
