"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { MarkupPhoto } from "@/lib/markup";
import { track } from "@/lib/analytics";
import { submitLead, SubmitError, uploadPhotos } from "@/lib/leads/client";
import type { FieldErrors } from "@/lib/leads/constants";
import { MarkupTool } from "./MarkupTool";
import { Turnstile } from "./Turnstile";
import { CheckIcon } from "./Icons";

export interface TradeOption {
  slug: string;
  name: string;
  diagnosis: boolean;
  photoSubject: string;
  formPlaceholder: string;
  exampleNotes: string[];
}

interface Props {
  /** Fixed trade (trade pages) or a list to choose from (standalone /concept-preview page). */
  trade?: TradeOption;
  tradeOptions?: TradeOption[];
  /** Preselected option when tradeOptions is used. */
  initial?: TradeOption;
}

export function PreviewForm({ trade, tradeOptions, initial }: Props) {
  const [selected, setSelected] = useState<TradeOption | undefined>(trade ?? initial);
  const current = trade ?? selected;
  const diagnosis = current?.diagnosis ?? false;

  const [photos, setPhotos] = useState<MarkupPhoto[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [progress, setProgress] = useState("");
  const [started, setStarted] = useState(false);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const onStart = () => {
    if (started) return;
    setStarted(true);
    track("form_start", { form: diagnosis ? "visit" : "concept_preview", trade: current?.slug });
  };
  const onToken = useCallback((t: string) => setToken(t), []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const local: FieldErrors = {};
    if (!current) local.tradeSlug = "Choose a trade.";
    if (get("message").length < 3) local.message = diagnosis ? "Tell us what is happening." : "Tell us a little about what you want.";
    if (get("name").length < 2) local.name = "Enter your name.";
    if (!/^\d{5}(-\d{4})?$/.test(get("zip"))) local.zip = "Enter a 5-digit zip code.";
    if (get("phone").replace(/\D/g, "").length < 10) local.phone = "Enter a phone number with area code.";
    if (!/^\S+@\S+\.\S+$/.test(get("email"))) local.email = "Enter a valid email address.";
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length) {
      focusFirstError(local);
      return;
    }
    setStatus("sending");
    try {
      const records = await uploadPhotos(photos, setProgress);
      setProgress("Sending your request");
      await submitLead({
        type: diagnosis ? "visit" : "concept_preview",
        tradeSlug: current!.slug,
        message: get("message"),
        name: get("name"),
        zip: get("zip"),
        phone: get("phone"),
        email: get("email"),
        company: get("company"),
        turnstileToken: token,
        photos: records,
      });
      track("form_submit", { form: diagnosis ? "visit" : "concept_preview", trade: current!.slug, photos: photos.length });
      setStatus("done");
      requestAnimationFrame(() => doneRef.current?.focus());
    } catch (err) {
      const se = err instanceof SubmitError ? err : new SubmitError("Something went wrong. Please try again or call us.");
      setErrors(se.fields);
      setFormError(se.message);
      setStatus("idle");
      setResetKey((k) => k + 1);
      focusFirstError(se.fields);
    }
  }

  function focusFirstError(errs: FieldErrors) {
    const first = Object.keys(errs)[0];
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
    el?.focus();
  }

  const fid = (k: string) => `${id}-${k}`;
  const err = (k: string) =>
    errors[k] ? (
      <span className="field-error" id={`${fid(k)}-err`}>
        {errors[k]}
      </span>
    ) : null;
  const aria = (k: string) => ({ id: fid(k), name: k, "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `${fid(k)}-err` : undefined });

  const title = diagnosis ? "Request a visit" : "Get my Concept Preview";

  return (
    <div className="see-grid">
      <div className="panel panel--tool">
        <MarkupTool
          photos={photos}
          setPhotos={(v) => {
            onStart();
            setPhotos(v);
          }}
          photoSubject={current?.photoSubject ?? "space"}
          exampleNotes={current?.exampleNotes ?? []}
          diagnosis={diagnosis}
          tradeSlug={current?.slug}
        />
      </div>

      <div className="panel">
        {status === "done" ? (
          <div className="form-success" ref={doneRef} tabIndex={-1} role="status">
            <span className="form-success__icon">
              <CheckIcon />
            </span>
            <h3 className="h3">Received.</h3>
            <p className="body-l">
              {diagnosis
                ? "We will call you back to confirm a time for your visit."
                : "Your Concept Preview and estimate will arrive within 48 hours."}
            </p>
            <p className="small">A confirmation is on its way to your email.</p>
          </div>
        ) : (
          <form ref={formRef} className="form" noValidate onSubmit={onSubmit} onFocus={onStart} aria-labelledby={fid("title")}>
            <h3 className="h3" id={fid("title")}>
              {title}
            </h3>

            {tradeOptions && (
              <div className="field">
                <label htmlFor={fid("tradeSlug")}>Trade or project</label>
                <select
                  className="select"
                  {...aria("tradeSlug")}
                  value={selected?.slug ?? ""}
                  onChange={(e) => setSelected(tradeOptions.find((t) => t.slug === e.target.value))}
                >
                  <option value="">Choose a trade</option>
                  {tradeOptions.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {err("tradeSlug")}
              </div>
            )}

            <div className="field">
              <label htmlFor={fid("message")}>{diagnosis ? "What's happening?" : "What would you like?"}</label>
              <textarea className="textarea" rows={3} maxLength={2000} placeholder={current?.formPlaceholder} {...aria("message")} />
              {err("message")}
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor={fid("name")}>Name</label>
                <input className="input" type="text" autoComplete="name" maxLength={120} {...aria("name")} />
                {err("name")}
              </div>
              <div className="field">
                <label htmlFor={fid("zip")}>Zip code</label>
                <input className="input" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={10} {...aria("zip")} />
                {err("zip")}
              </div>
              <div className="field">
                <label htmlFor={fid("phone")}>Phone</label>
                <input className="input" type="tel" autoComplete="tel" maxLength={30} {...aria("phone")} />
                {err("phone")}
              </div>
              <div className="field">
                <label htmlFor={fid("email")}>Email</label>
                <input className="input" type="email" autoComplete="email" maxLength={200} {...aria("email")} />
                {err("email")}
              </div>
            </div>

            <div className="hp" aria-hidden="true">
              <label htmlFor={fid("company")}>Company</label>
              <input id={fid("company")} name="company" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <Turnstile active={started} onToken={onToken} resetKey={resetKey} />

            {formError && (
              <p className="form-status form-status--error" role="alert">
                {formError}
              </p>
            )}

            <button type="submit" className="btn btn--trade btn--block" disabled={status === "sending"} aria-describedby={fid("promise")}>
              {status === "sending" ? progress || "Sending" : title}
            </button>
            <span className="small" id={fid("promise")} aria-live="polite">
              {diagnosis ? "We call back to confirm a time." : "Your Concept Preview and estimate arrive within 48 hours."}
            </span>
            {photos.length === 0 && (
              <span className="small">
                {diagnosis ? "A photo helps us arrive prepared, but it is optional." : "Adding a photo gets you a Concept Preview. You can also send your request without one."}
              </span>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
