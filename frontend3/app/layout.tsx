import { Sora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Navbar from "@/components/navbar";
import LayoutShell from "@/components/layout-shell";
// CHANGE THIS IMPORT:
import { Toaster } from "@/components/ui/sonner"; 
import LocationGate from "@/components/location-gate";

const sora = Sora({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sora.className} bg-slate-50 text-slate-900 min-h-screen`}>
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
