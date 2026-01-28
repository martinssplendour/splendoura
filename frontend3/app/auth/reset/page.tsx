import { Suspense } from "react";
import ResetPasswordForm from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-none border-0 bg-white p-6 shadow-none sm:rounded-2xl sm:border sm:border-slate-200 sm:p-8 sm:shadow-sm">
        <Suspense
          fallback={
            <div className="space-y-3 text-center text-sm text-slate-600">
              <p>Loading reset form...</p>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
