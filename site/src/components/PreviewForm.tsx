"use client";

import { useEffect, useRef, useState } from "react";
import type { MarkupPhoto } from "@/lib/markup";
import { submitLead, uploadPhotos } from "@/lib/leads/client";
import { contactErrors } from "@/lib/leads/validate";
import type { FieldErrors } from "@/lib/leads/constants";
import { MarkupTool } from "./MarkupTool";
import { Turnstile } from "./Turnstile";
import { CheckIcon } from "./Icons";
import { useLeadForm } from "./form/useLeadForm";

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
  const formName = diagnosis ? "visit" : "concept_preview";

  const [photos, setPhotos] = useState<MarkupPhoto[]>([]);
  const [progress, setProgress] = useState("");
  const doneRef = useRef<HTMLDivElement>(null);
  const f = useLeadForm(formName, () => ({ trade: current?.slug, photos: photos.length }));

  // Marked-up photos live only in this tab: warn before they are lost.
  const unsent = photos.length > 0 && f.status !== "done";
  useEffect(() => {
    if (!unsent) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsent]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const local: FieldErrors = {};
    if (!current) local.tradeSlug = "Choose a trade.";
    if (get("message").length < 3) local.message = diagnosis ? "Tell us what is happening." : "Tell us a little about what you want.";
    if (get("name").length < 2) local.name = "Enter your name.";
    Object.assign(local, contactErrors(get));

    const ok = await f.submit(local, async () => {
      const records = await uploadPhotos(photos, setProgress);
      setProgress("Sending your request");
      await submitLead({
        type: formName,
        tradeSlug: current!.slug,
        message: get("message"),
        name: get("name"),
        zip: get("zip"),
        phone: get("phone"),
        email: get("email"),
        company: get("company"),
        turnstileToken: f.token,
        requestId: f.requestId,
        photos: records,
      });
    });
    setProgress("");
    if (ok) requestAnimationFrame(() => doneRef.current?.focus());
  }

  const { field, error: err, id: fid } = f;
  const status = f.status;

  const title = diagnosis ? "Request a visit" : "Get my Concept Preview";

  return (
    <div className="see-grid">
      <div className="panel panel--tool">
        <MarkupTool
          photos={photos}
          setPhotos={(v) => {
            f.onStart();
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
          <form ref={f.formRef} className="form" noValidate onSubmit={onSubmit} onFocus={f.onStart} aria-labelledby={fid("title")} aria-busy={status === "sending"}>
            <h3 className="h3" id={fid("title")}>
              {title}
            </h3>

            {tradeOptions && (
              <div className="field">
                <label htmlFor={fid("tradeSlug")}>Trade or project</label>
                <select
                  className="select"
                  {...field("tradeSlug")}
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
              <textarea className="textarea" rows={3} maxLength={2000} placeholder={current?.formPlaceholder} {...field("message")} />
              {err("message")}
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor={fid("name")}>Name</label>
                <input className="input" type="text" autoComplete="name" maxLength={120} {...field("name")} />
                {err("name")}
              </div>
              <div className="field">
                <label htmlFor={fid("zip")}>Zip code</label>
                <input className="input" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={10} {...field("zip")} />
                {err("zip")}
              </div>
              <div className="field">
                <label htmlFor={fid("phone")}>Phone</label>
                <input className="input" type="tel" autoComplete="tel" maxLength={30} {...field("phone")} />
                {err("phone")}
              </div>
              <div className="field">
                <label htmlFor={fid("email")}>Email</label>
                <input className="input" type="email" autoComplete="email" maxLength={200} {...field("email")} />
                {err("email")}
              </div>
            </div>

            <div className="hp" aria-hidden="true">
              <label htmlFor={fid("company")}>Company</label>
              <input id={fid("company")} name="company" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <Turnstile active={f.started} onToken={f.onToken} resetKey={f.resetKey} />

            {f.formError && (
              <p className="form-status form-status--error" role="alert">
                {f.formError}
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
