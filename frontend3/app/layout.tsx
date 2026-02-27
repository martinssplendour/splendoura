import { Sora } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Navbar from "@/components/navbar";
import LayoutShell from "@/components/layout-shell";
// CHANGE THIS IMPORT:
import { Toaster } from "@/components/ui/sonner"; 
import LocationGate from "@/components/location-gate";
import GoogleAnalyticsPageView from "@/components/google-analytics-page-view";
import { GA_MEASUREMENT_ID } from "@/lib/gtag";

const sora = Sora({ subsets: ["latin"] });

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sora.className} bg-slate-50 text-slate-900 min-h-screen`}>
        {GA_MEASUREMENT_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
            <GoogleAnalyticsPageView />
          </>
        ) : null}
        <AuthProvider>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <LayoutShell>
              <LocationGate>{children}</LocationGate>
            </LayoutShell>
            {/* The component name is usually the same, but verified it is using the new import */}
            <Toaster />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
