"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { pageview } from "@/lib/gtag";

export default function GoogleAnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const url = query ? `${pathname}?${query}` : pathname;
    pageview(url);
  }, [pathname, query]);

  return null;
}
