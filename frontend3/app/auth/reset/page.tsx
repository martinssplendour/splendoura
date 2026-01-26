import { Suspense } from "react";
import ResetPasswordForm from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Suspense
          fallback={
            <div className="space-y-3 text-center text-sm text-slate-600">
              <p>Loading reset form…</p>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
