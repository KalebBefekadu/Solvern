"use client";

import { useCallback, useRef, useState } from "react";
import { uid } from "@/lib/markup";
import { track } from "@/lib/analytics";
import { SubmitError } from "@/lib/leads/client";
import type { FieldErrors } from "@/lib/leads/constants";
import { useFieldErrors } from "./useFieldErrors";

type Status = "idle" | "sending" | "done";

/**
 * Shared lifecycle for every lead form: start tracking, Turnstile token, validation,
 * submission, server field errors and focus management.
 */
export function useLeadForm(form: string, trackProps: () => Record<string, unknown> = () => ({})) {
  const fields = useFieldErrors();
  const [status, setStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const onToken = useCallback((t: string) => setToken(t), []);
  /** Same id for every retry of this attempt; the server stores the lead once. */
  const requestId = useRef(uid());

  const onStart = () => {
    if (started) return;
    setStarted(true);
    track("form_start", { form, ...trackProps() });
  };

  const fail = (errs: FieldErrors, message: string | null) => {
    fields.setErrors(errs);
    setFormError(message);
    track("form_error", { form, fields: Object.keys(errs).join(","), server: message !== null });
    fields.focusFirst(errs);
  };

  /** Runs local checks, then `send`. Returns true once the request is stored. */
  const submit = async (localErrors: FieldErrors, send: () => Promise<void>) => {
    if (status === "sending") return false;
    setFormError(null);
    if (Object.keys(localErrors).length) {
      fail(localErrors, null);
      return false;
    }
    fields.setErrors({});
    setStatus("sending");
    try {
      await send();
      track("form_submit", { form, ...trackProps() });
      setStatus("done");
      return true;
    } catch (err) {
      const se = err instanceof SubmitError ? err : new SubmitError("Something went wrong. Please try again or call us.");
      setStatus("idle");
      setResetKey((k) => k + 1); // Turnstile tokens are single use.
      fail(se.fields, se.message);
      return false;
    }
  };

  return { ...fields, status, formError, started, token, resetKey, onToken, onStart, submit, requestId: requestId.current };
}
