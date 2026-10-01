"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { site } from "@/content/site";
import { CALLBACK_TOPICS_EXISTING, CALLBACK_TOPICS_NEW, type FieldErrors } from "@/lib/leads/constants";
import { submitLead, SubmitError } from "@/lib/leads/client";
import { track } from "@/lib/analytics";
import { Turnstile } from "./Turnstile";
import { CheckIcon } from "./Icons";

type Existing = "yes" | "no" | "not_sure";

export interface CallbackPrefill {
  job?: string;
  first?: string;
  last?: string;
  email?: string;
  phone?: string;
  zip?: string;
}

/**
 * Branching callback form (04-page-specs.md, modeled on Aspect's callback page).
 * Support links in Solvern emails can prefill it: /customer-service?job=SV-1234&first=Dana&email=...
 */
export function CallbackForm({ prefill = {} }: { prefill?: CallbackPrefill }) {
  const [existing, setExisting] = useState<Existing | null>(prefill.job ? "yes" : null);
  const [topic, setTopic] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [started, setStarted] = useState(false);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const onToken = useCallback((t: string) => setToken(t), []);

  useEffect(() => setTopic(""), [existing]);

  const onStart = () => {
    if (started) return;
    setStarted(true);
    track("form_start", { form: "callback" });
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const local: FieldErrors = {};
    if (!existing) local.existingJob = "Choose an answer.";
    if (!topic) local.topic = "Choose a topic.";
    if (get("message").length < 3) local.message = "Tell us what you would like to discuss.";
    if (!/^\d{5}(-\d{4})?$/.test(get("zip"))) local.zip = "Enter a 5-digit zip code.";
    if (!get("firstName")) local.firstName = "Enter your first name.";
    if (!get("lastName")) local.lastName = "Enter your last name.";
    if (get("phone").replace(/\D/g, "").length < 10) local.phone = "Enter a phone number with area code.";
    if (!/^\S+@\S+\.\S+$/.test(get("email"))) local.email = "Enter a valid email address.";
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length) return focusFirst(local);

    setStatus("sending");
    try {
      await submitLead({
        type: "callback",
        existingJob: existing,
        jobNumber: existing === "yes" ? get("jobNumber") : "",
        topic,
        message: get("message"),
        zip: get("zip"),
        firstName: get("firstName"),
        lastName: get("lastName"),
        phone: get("phone"),
        email: get("email"),
        preferredContact: get("preferredContact") || "phone",
        company: get("company"),
        turnstileToken: token,
      });
      track("form_submit", { form: "callback", existing_job: existing === "yes", topic });
      setStatus("done");
      requestAnimationFrame(() => doneRef.current?.focus());
    } catch (err) {
      const se = err instanceof SubmitError ? err : new SubmitError("Something went wrong. Please try again or call us.");
      setErrors(se.fields);
      setFormError(se.message);
      setStatus("idle");
      setResetKey((k) => k + 1);
      focusFirst(se.fields);
    }
  }

  function focusFirst(errs: FieldErrors) {
    const first = Object.keys(errs)[0];
    if (!first) return;
    formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  const fid = (k: string) => `${id}-${k}`;
  const err = (k: string) =>
    errors[k] ? (
      <span className="field-error" id={`${fid(k)}-err`}>
        {errors[k]}
      </span>
    ) : null;
  const aria = (k: string) => ({ id: fid(k), name: k, "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `${fid(k)}-err` : undefined });

  if (status === "done") {
    return (
      <div className="cs-form" id="callback">
        <div className="form-success" ref={doneRef} tabIndex={-1} role="status">
          <span className="form-success__icon" style={{ background: "var(--ink)", color: "var(--white)" }}>
            <CheckIcon />
          </span>
          <h2 className="h3">Received.</h2>
          <p className="body-l">
            The right person on our team will contact you. We aim to reply within {site.callback.responseTime} during {site.callback.hours}.
          </p>
          <p className="small">A confirmation is on its way to your email.</p>
        </div>
      </div>
    );
  }

  const topics = existing === "yes" ? CALLBACK_TOPICS_EXISTING : CALLBACK_TOPICS_NEW;

  return (
    <form ref={formRef} className="cs-form" id="callback" noValidate onSubmit={onSubmit} onFocus={onStart} aria-label="Request a callback">
      <div className="cs-step">
        <span className="cs-step__n" aria-hidden="true">
          1
        </span>
        <h2 className="cs-step__t">About your request</h2>
      </div>

      <fieldset aria-describedby={errors.existingJob ? `${fid("existingJob")}-err` : undefined}>
        <legend>Is this about a job you have already booked?</legend>
        <div className="choice-row">
          {(
            [
              ["yes", "Yes"],
              ["no", "No"],
              ["not_sure", "Not sure"],
            ] as [Existing, string][]
          ).map(([v, l]) => (
            <label className="choice" key={v}>
              <input type="radio" name="existingJob" value={v} checked={existing === v} onChange={() => setExisting(v)} />
              {l}
            </label>
          ))}
        </div>
        {err("existingJob")}
      </fieldset>

      {existing && (
        <div className="cs-branch" aria-live="polite">
          {existing === "yes" && (
            <div className="field">
              <label htmlFor={fid("jobNumber")}>Job number</label>
              <input className="input" type="text" defaultValue={prefill.job} maxLength={40} autoComplete="off" {...aria("jobNumber")} aria-describedby={`${fid("jobNumber")}-hint`} />
              <span className="field-hint" id={`${fid("jobNumber")}-hint`}>
                Shown on your booking confirmation or invoice, for example {site.callback.jobNumberExample}
              </span>
            </div>
          )}
          <div className="field">
            <label htmlFor={fid("topic")}>{existing === "yes" ? "What would you like to discuss?" : "What type of enquiry?"}</label>
            <select className="select" value={topic} onChange={(e) => setTopic(e.target.value)} {...aria("topic")}>
              <option value="">Choose from the list</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {err("topic")}
          </div>
          {topic === "New project or estimate" && (
            <div className="callout">
              <strong>The fastest route is a Concept Preview.</strong>
              <span className="small">Send a photo, draw on it to show what you want, and get a concept image and estimate within 48 hours. Or carry on here and we will call you.</span>
              <Link href="/concept-preview" className="btn btn--ink btn--sm" data-track="cta_click" data-location="callback-new-project">
                Get my Concept Preview
              </Link>
            </div>
          )}
        </div>
      )}
      {!existing && (
        <p className="small">
          Not an existing job? You will be asked what kind of enquiry it is instead: a new project or estimate, help and advice, careers at Solvern, or partnerships.
        </p>
      )}

      <div className="cs-step">
        <span className="cs-step__n" aria-hidden="true">
          2
        </span>
        <h2 className="cs-step__t">Tell us more</h2>
      </div>
      <div className="field">
        <label htmlFor={fid("message")}>What would you like to discuss?</label>
        <textarea className="textarea" rows={4} maxLength={2000} {...aria("message")} />
        {err("message")}
      </div>
      <div className="field">
        <label htmlFor={fid("zip")}>Zip code</label>
        <input className="input" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={10} defaultValue={prefill.zip} {...aria("zip")} />
        <span className="field-hint">So we can confirm we cover your area</span>
        {err("zip")}
      </div>

      <div className="cs-step">
        <span className="cs-step__n" aria-hidden="true">
          3
        </span>
        <h2 className="cs-step__t">How to reach you</h2>
      </div>
      <div className="grid-2" style={{ gap: 16 }}>
        <div className="field">
          <label htmlFor={fid("firstName")}>First name</label>
          <input className="input" type="text" autoComplete="given-name" maxLength={80} defaultValue={prefill.first} {...aria("firstName")} />
          {err("firstName")}
        </div>
        <div className="field">
          <label htmlFor={fid("lastName")}>Last name</label>
          <input className="input" type="text" autoComplete="family-name" maxLength={80} defaultValue={prefill.last} {...aria("lastName")} />
          {err("lastName")}
        </div>
        <div className="field">
          <label htmlFor={fid("phone")}>Phone</label>
          <input className="input" type="tel" autoComplete="tel" maxLength={30} defaultValue={prefill.phone} {...aria("phone")} />
          {err("phone")}
        </div>
        <div className="field">
          <label htmlFor={fid("email")}>Email</label>
          <input className="input" type="email" autoComplete="email" maxLength={200} defaultValue={prefill.email} {...aria("email")} />
          {err("email")}
        </div>
      </div>
      <fieldset>
        <legend>How would you like us to contact you?</legend>
        <div className="choice-row">
          {(
            [
              ["phone", "Phone call"],
              ["text", "Text"],
              ["email", "Email"],
            ] as const
          ).map(([v, l], i) => (
            <label className="choice" key={v}>
              <input type="radio" name="preferredContact" value={v} defaultChecked={i === 0} />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

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
      <button type="submit" className="btn btn--ink btn--block" style={{ minHeight: 56 }} disabled={status === "sending"}>
        {status === "sending" ? "Sending" : "Request a callback"}
      </button>
    </form>
  );
}
