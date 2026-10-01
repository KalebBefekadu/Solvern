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

/** Markup limits, enforced by the drawing tool and by the server schema. */
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_STROKES = 300;
export const MAX_NOTES = 60;
export const MAX_POINTS_PER_STROKE = 1500;
export const MAX_NOTE_LENGTH = 500;

export type FieldErrors = Record<string, string>;
