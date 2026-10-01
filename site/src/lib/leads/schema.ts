import { z } from "zod";
import { CALLBACK_TOPICS_EXISTING, CALLBACK_TOPICS_NEW } from "./constants";

export { CALLBACK_TOPICS_EXISTING, CALLBACK_TOPICS_NEW };

export const LEAD_TYPES = ["concept_preview", "visit", "callback"] as const;
export const CONTACT_PREFS = ["phone", "text", "email"] as const;

const trimmed = (max: number) => z.string().trim().max(max);
const phone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a phone number with area code.");
const zip = z
  .string()
  .trim()
  .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit zip code.");
const email = z.string().trim().max(200).email("Enter a valid email address.");

/** Paths returned by /api/uploads. Anything else is rejected. */
export const uploadPath = z.string().regex(/^leads\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\/[a-z0-9-]+\.(jpg|jpeg|png|webp|heic|heif)$/i);

const point = z.tuple([z.number(), z.number(), z.number()]);
export const photoSchema = z.object({
  originalPath: uploadPath,
  annotatedPath: uploadPath.nullable(),
  strokes: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    strokes: z
      .array(z.object({ pen: z.enum(["blue", "orange", "green"]), color: z.string().max(9), note: z.number().int().nullable(), points: z.array(point).max(5000) }))
      .max(300),
  }),
  notes: z
    .array(z.object({ n: z.number().int(), pen: z.enum(["blue", "orange", "green"]), color: z.string().max(9), text: trimmed(500), anchor: z.object({ x: z.number(), y: z.number() }) }))
    .max(60),
});

const base = {
  sourceUrl: trimmed(500).optional().default(""),
  utm: z.record(z.string().max(60), z.string().max(200)).optional().default({}),
  turnstileToken: z.string().max(4096).optional().default(""),
  /** Honeypot. Real people never see or fill this field. */
  company: z.string().max(200).optional().default(""),
};

export const previewLeadSchema = z.object({
  type: z.enum(["concept_preview", "visit"]),
  tradeSlug: z.string().regex(/^[a-z-]{2,40}$/, "Choose a trade."),
  message: trimmed(2000).min(3, "Tell us a little about what you want."),
  name: trimmed(120).min(2, "Enter your name."),
  zip,
  phone,
  email,
  preferredContact: z.enum(CONTACT_PREFS).optional(),
  photos: z.array(photoSchema).max(5).default([]),
  ...base,
});

export const callbackLeadSchema = z
  .object({
    type: z.literal("callback"),
    existingJob: z.enum(["yes", "no", "not_sure"]),
    jobNumber: trimmed(40).optional().default(""),
    topic: trimmed(80).min(1, "Choose a topic."),
    message: trimmed(2000).min(3, "Tell us what you would like to discuss."),
    zip,
    firstName: trimmed(80).min(1, "Enter your first name."),
    lastName: trimmed(80).min(1, "Enter your last name."),
    phone,
    email,
    preferredContact: z.enum(CONTACT_PREFS),
    ...base,
  })
  .superRefine((v, ctx) => {
    const allowed: readonly string[] = v.existingJob === "yes" ? CALLBACK_TOPICS_EXISTING : CALLBACK_TOPICS_NEW;
    if (!allowed.includes(v.topic)) ctx.addIssue({ code: "custom", path: ["topic"], message: "Choose a topic." });
  });

export type PreviewLead = z.infer<typeof previewLeadSchema>;
export type CallbackLead = z.infer<typeof callbackLeadSchema>;
export type LeadInput = PreviewLead | CallbackLead;

export const uploadRequestSchema = z.object({
  files: z
    .array(
      z.object({
        kind: z.enum(["original", "annotated"]),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
        size: z.number().int().positive().max(15 * 1024 * 1024),
      }),
    )
    .min(1)
    .max(10),
});

export type { FieldErrors } from "./constants";
import type { FieldErrors } from "./constants";

export function flattenErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
