"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <main
      className={
        isLanding
          ? "flex-1 min-h-0"
          : "flex-1 min-h-0 container mx-auto px-4 py-8 pb-24 md:pb-8"
      }
    >
      {children}
    </main>
  );
}
