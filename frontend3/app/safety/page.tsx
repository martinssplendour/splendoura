import { Button } from "@/components/ui/button";

export default function SafetyCenterPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-none border-0 bg-white sm:rounded-3xl sm:border sm:border-slate-200 p-6">
        <h1 className="text-3xl font-semibold text-slate-900">Safety Center</h1>
        <p className="mt-2 text-sm text-slate-600">
          Simple steps to help you stay safe while meeting new people.
        </p>
      </div>

      <div className="rounded-none border-0 bg-white sm:rounded-3xl sm:border sm:border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Before you meet</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Meet in public places and share your plan.</li>
          <li>Use in-app chat until you feel comfortable.</li>
          <li>Verify profiles and trust your instincts.</li>
        </ul>
      </div>

      <div className="rounded-none border-0 bg-white sm:rounded-3xl sm:border sm:border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">During the date</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Keep control of your transport.</li>
          <li>Do not leave drinks unattended.</li>
          <li>Leave if anything feels off.</li>
        </ul>
      </div>

      <div className="rounded-none border-0 bg-white sm:rounded-3xl sm:border sm:border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Emergency help</h2>
        <p className="mt-2 text-sm text-slate-600">
          If you are in immediate danger, call your local emergency number.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <a href="tel:911">Call emergency services</a>
        </Button>
      </div>

      <div className="rounded-none border-0 bg-white sm:rounded-3xl sm:border sm:border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Need support?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Contact our safety team for help or reports.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <a href="mailto:safety@splendoure.com">Email safety@splendoure.com</a>
        </Button>
      </div>
    </div>
  );
}

