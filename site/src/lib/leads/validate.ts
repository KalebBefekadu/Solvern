// Client-side checks that mirror the server schema (schema.ts), without shipping Zod to the browser.
// The server stays the authority; these only give instant, field-level feedback.

export const ZIP_RE = /^\d{5}(-\d{4})?$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MESSAGES = {
  zip: "Enter a 5-digit zip code.",
  phone: "Enter a phone number with area code.",
  email: "Enter a valid email address.",
} as const;

export const isZip = (v: string) => ZIP_RE.test(v.trim());
export const isPhone = (v: string) => v.replace(/\D/g, "").length >= 10;
export const isEmail = (v: string) => EMAIL_RE.test(v.trim());

/** Zip, phone and email checks shared by every lead form. */
export function contactErrors(get: (k: string) => string) {
  const out: Record<string, string> = {};
  if (!isZip(get("zip"))) out.zip = MESSAGES.zip;
  if (!isPhone(get("phone"))) out.phone = MESSAGES.phone;
  if (!isEmail(get("email"))) out.email = MESSAGES.email;
  return out;
}
