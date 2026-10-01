// Shared by client forms and server validation. No zod here, so it stays out of client bundles.

export const CALLBACK_TOPICS_EXISTING = [
  "Arrival time update",
  "Billing or payment question",
  "Change booking details",
  "Cancel a booking",
  "Ongoing or follow-on work",
  "Issue with work carried out",
] as const;

export const CALLBACK_TOPICS_NEW = ["New project or estimate", "Help or advice", "Careers at Solvern", "Partnerships"] as const;

export type FieldErrors = Record<string, string>;
