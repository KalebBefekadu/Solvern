/**
 * Business details. Every bracketed value is an open item (docs/08-open-items.md).
 * Never replace a placeholder with an invented value: the owner supplies the real one.
 */
export const site = {
  name: "Solvern Home",
  brand: "Solvern",
  tagline: "See it first. Built right.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://solvern.com",

  phone: {
    display: "(404) [YOUR NUMBER]",
    /** Dummy number carried over from the design reference. Replace with the real (or call tracking) number. */
    href: "tel:+14045550123",
    /** Set to the real E.164 number to publish it in structured data. Empty until supplied. */
    e164: "",
  },
  email: "[YOUR EMAIL]",
  legalName: "[LEGAL NAME]",
  legalLine: "[LEGAL NAME] doing business as Solvern Home. Serving metro Atlanta.",

  rating: { value: "[4.9]", count: "[000]", source: "[Google]" },

  callback: {
    responseTime: "[30 MINUTES]",
    hours: "[HOURS]",
    daysAndHours: "[DAYS AND HOURS]",
    jobNumberExample: "SV-1234",
  },

  financing: {
    partner: "[FINANCING PARTNER]",
    minimum: "[$ AMOUNT]",
    terms: "[Terms and eligibility from your financing partner]",
    /** Partner link or prequalification widget URL. Empty until the partner is chosen. */
    applyUrl: "",
  },

  boilerplate:
    "Solvern Home serves homeowners across metro Atlanta with one accountable team for 23 trades, from roofing and flooring to plumbing, landscaping and complete renovations. Every project starts with a Concept Preview, so homeowners see the result before work begins, and runs on clear estimates, measured timelines and updates at every stage.",
  footerLine: "One accountable team for 23 trades across metro Atlanta. See it first. Built right.",

  /** Named in the brief. Add more only when the owner confirms them. */
  areas: ["Buckhead", "Alpharetta", "Decatur", "Marietta"],
  social: { handle: "@solvernhome" },
} as const;

export const hasPlaceholder = (s: string) => /\[[^\]]+\]/.test(s);
