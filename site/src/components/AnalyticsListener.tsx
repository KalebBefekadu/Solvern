"use client";

import { useEffect } from "react";
import { captureUtm, track } from "@/lib/analytics";

/**
 * One delegated listener for the whole site:
 * - any tel: link fires phone_click
 * - any element with data-track fires that event with its data-* details
 */
export function AnalyticsListener() {
  useEffect(() => {
    captureUtm();
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("a, button");
      if (!el) return;
      const href = el.getAttribute("href") || "";
      if (href.startsWith("tel:")) {
        track("phone_click", { location: el.dataset.location || "unknown" });
        return;
      }
      const ev = el.dataset.track as Parameters<typeof track>[0] | undefined;
      if (ev) track(ev, { label: el.dataset.label || el.textContent?.trim(), location: el.dataset.location });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
