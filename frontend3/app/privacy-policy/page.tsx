export const metadata = {
  title: "Privacy Policy | Splendoure",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-600">Effective date: January 30, 2026</p>
        <p className="mt-1 text-xs text-slate-500">Privacy policy URL: https://splendoure.com/privacy-policy</p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-slate-700">
          <p>
            This Privacy Policy explains how Splendoure collects, uses, and shares information
            when you use our website and mobile app. We keep this policy clear and simple so you
            can understand how your data is handled.
          </p>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Who we are</h2>
          <p>
            Splendoure is operated by the developer. If you have questions about this policy or
            your data, contact us at <span className="font-semibold">support@splendoure.com</span>.
          </p>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Information we collect</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Account details:</strong> name, username, email, password (stored in
              encrypted form), and account settings.
            </li>
            <li>
              <strong>Profile details:</strong> photos, bio, preferences, and other information
              you choose to add. We don’t require sensitive information; if you add it, you choose
              to share it.
            </li>
            <li>
              <strong>Group and chat content:</strong> group posts, messages, and files you
              share.
            </li>
            <li>
              <strong>Location (optional):</strong> if you allow it, we use your location to show
              nearby groups and profiles.
            </li>
            <li>
              <strong>Device and usage data:</strong> basic device info and how you use the app
              (for example, pages visited and actions taken).
            </li>
          </ul>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">How we use information</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Provide and improve the Splendoure experience.</li>
            <li>Match you with groups or profiles based on your preferences.</li>
            <li>Enable chat, group features, and notifications.</li>
            <li>Protect the community, prevent abuse, and enforce our terms.</li>
          </ul>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">How we share information</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>With other users:</strong> your profile and content are visible to others
              based on how you use the app.
            </li>
            <li>
              <strong>With service providers:</strong> trusted partners who help us run the app
              (hosting, analytics, email).
            </li>
            <li>
              <strong>For legal reasons:</strong> if required by law or to protect users and the
              platform.
            </li>
          </ul>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Ads</h2>
          <p>
            Splendoure does not show ads at this time. If we add ads in the future, we will update
            this policy and any required disclosures.
          </p>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">App access</h2>
          <p>
            Some features require signing in. If reviewers need access to a restricted area, we
            will provide instructions in the Play Console App access section.
          </p>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Permissions we use</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Photos/media: to upload profile and group images.</li>
            <li>Camera: to capture photos or videos you choose to share.</li>
            <li>Microphone: for voice notes or calls where available.</li>
            <li>Location (optional): to show nearby groups and profiles.</li>
          </ul>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Your rights</h2>
          <p>
            Depending on where you live, you may have the right to access, correct, delete, or
            restrict the use of your data. You can request these by emailing{" "}
            <span className="font-semibold">support@splendoure.com</span>.
          </p>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Your choices</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Update or delete your profile information in settings.</li>
            <li>Control location access in your device settings.</li>
            <li>Manage notifications in the app settings.</li>
            <li>Request account deletion by contacting us at support@splendoure.com.</li>
          </ul>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Data retention</h2>
          <p>
            We keep your information only as long as needed to provide the service, keep the
            community safe, or comply with legal requirements. You can request deletion at any
            time.
          </p>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Security</h2>
          <p>
            We use reasonable security measures to protect your information, but no system is
            completely secure.
          </p>
          <p className="mt-2">
            We use HTTPS/TLS to protect data in transit. Data is stored by our hosting and storage
            providers with encryption at rest. Photos are stored in private storage and accessed
            using time‑limited signed URLs.
          </p>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Children’s privacy</h2>
          <p>
            Splendoure is intended for adults. We do not knowingly collect data from anyone under
            18.
          </p>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Changes to this policy</h2>
          <p>
            We may update this policy from time to time. If we make material changes, we will post
            the update here.
          </p>

          <h2 className="mt-6 text-lg font-semibold text-slate-900">Contact us</h2>
          <p>
            If you have questions, contact us at{" "}
            <span className="font-semibold">support@splendoure.com</span>.
          </p>
        </section>
      </div>
    </main>
  );
}
