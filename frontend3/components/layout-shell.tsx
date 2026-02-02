"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isChat = pathname?.startsWith("/chat");
  const isDiscoverIndex = pathname === "/groups";
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const setAppHeight = () => {
      document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
    };
    setAppHeight();
    window.addEventListener("resize", setAppHeight);
    return () => window.removeEventListener("resize", setAppHeight);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    updateMatch();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateMatch);
    } else {
      // @ts-expect-error - legacy Safari
      mediaQuery.addListener(updateMatch);
    }
    return () => {
      if (mediaQuery.addEventListener) {
        mediaQuery.removeEventListener("change", updateMatch);
      } else {
        // @ts-expect-error - legacy Safari
        mediaQuery.removeListener(updateMatch);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const shouldLock = (isChat || isDiscoverIndex) && isMobile;
    document.body.classList.toggle("no-scroll", shouldLock);
    document.documentElement.classList.toggle("no-scroll", shouldLock);
    return () => {
      document.body.classList.remove("no-scroll");
      document.documentElement.classList.remove("no-scroll");
    };
  }, [isChat, isDiscoverIndex, isMobile]);

  return (
    <main
      className={
        isLanding
          ? "flex-1 min-h-0"
          : isChat
            ? "flex-1 min-h-0 overflow-hidden px-0 py-0"
            : isDiscoverIndex
              ? "flex-1 min-h-0 overflow-hidden container mx-auto px-4 pt-2 pb-0"
              : "flex-1 min-h-0 container mx-auto px-4 py-8 pb-24 md:pb-8"
      }
    >
      {children}
    </main>
  );
}
