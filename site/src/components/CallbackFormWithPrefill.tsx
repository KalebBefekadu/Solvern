"use client";

import { useSearchParams } from "next/navigation";
import { CallbackForm } from "./CallbackForm";

/** Reads ?job=&first=&last=&email=&phone=&zip= from support links in Solvern emails. */
export function CallbackFormWithPrefill() {
  const q = useSearchParams();
  const v = (k: string) => q.get(k)?.slice(0, 120) || undefined;
  const prefill = { job: v("job"), first: v("first"), last: v("last"), email: v("email"), phone: v("phone"), zip: v("zip") };
  return <CallbackForm key={q.toString()} prefill={prefill} />;
}
