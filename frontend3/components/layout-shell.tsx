"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isChat = pathname?.startsWith("/chat");
  const isDiscover = pathname?.startsWith("/groups");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const shouldLock = isChat || isDiscover;
    document.body.classList.toggle("no-scroll", shouldLock);
    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [isChat, isDiscover]);

  return (
    <main
      className={
        isLanding
          ? "flex-1 min-h-0"
          : isChat
            ? "flex-1 min-h-0 overflow-hidden px-0 py-0"
            : isDiscover
              ? "flex-1 min-h-0 overflow-hidden container mx-auto px-4 py-6"
              : "flex-1 min-h-0 container mx-auto px-4 py-8 pb-24 md:pb-8"
      }
    >
      {children}
    </main>
  );
}
