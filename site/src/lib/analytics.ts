"use client";

import { CAMPAIGN_KEYS, safeAttribution } from "@/lib/leads/attribution";

/**
 * Vendor-neutral analytics. Events go to window.dataLayer (Google Tag Manager or GA4 can pick them up)
 * and are re-dispatched as a DOM event `solvern:track` for any other listener.
 *
 * Events (05-features.md > Analytics):
 *   phone_click, cta_click, form_start, form_submit, form_error, markup_use, financing_click
 */
export type TrackEvent = "phone_click" | "cta_click" | "form_start" | "form_submit" | "form_error" | "markup_use" | "financing_click";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track(event: TrackEvent, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const payload = { event, page: window.location.pathname, ...props };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
  window.dispatchEvent(new CustomEvent("solvern:track", { detail: payload }));
  if (process.env.NODE_ENV !== "production") console.debug("[track]", payload);
}

const UTM_STORE = "solvern.utm";

/** Stores UTM parameters from the landing URL for the session, so a lead submitted later keeps them. */
export function captureUtm() {
  try {
    const params = new URLSearchParams(window.location.search);
    const found: Record<string, string> = {};
    for (const k of CAMPAIGN_KEYS) {
      const v = params.get(k);
      if (v) found[k] = v;
    }
    const safe = safeAttribution({ ...found, landing_page: window.location.pathname });
    if (Object.keys(safe).some((key) => key !== "landing_page")) {
      sessionStorage.setItem(UTM_STORE, JSON.stringify(safe));
    }
  } catch {
    /* storage unavailable */
  }
}

export function readUtm(): Record<string, string> {
  try {
    return safeAttribution(JSON.parse(sessionStorage.getItem(UTM_STORE) || "{}"));
  } catch {
    return {};
  }
}
