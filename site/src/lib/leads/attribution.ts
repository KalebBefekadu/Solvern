/** Attribution is intentionally limited to paths and campaign identifiers, never URL query text. */
export const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"] as const;
export type CampaignKey = (typeof CAMPAIGN_KEYS)[number];

const SAFE_CAMPAIGN_VALUE = /^[A-Za-z0-9._~-]{1,120}$/;

export function safePagePath(value: string): string {
  if (value.length > 500 || !/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)?)?$/.test(value)) return "";
  return value;
}

export function safeCampaignValue(value: string): string | null {
  if (!SAFE_CAMPAIGN_VALUE.test(value)) return null;
  // Reject obvious phone numbers accidentally placed in a campaign parameter.
  if (/^[\d._~-]+$/.test(value) && value.replace(/\D/g, "").length >= 10) return null;
  return value;
}

export function safeAttribution(value: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of CAMPAIGN_KEYS) {
    const raw = value[key];
    if (typeof raw !== "string") continue;
    const safe = safeCampaignValue(raw);
    if (safe) out[key] = safe;
  }
  if (typeof value.landing_page === "string") {
    const path = safePagePath(value.landing_page);
    if (path) out.landing_page = path;
  }
  return out;
}
