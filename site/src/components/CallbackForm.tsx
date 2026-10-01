"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { site } from "@/content/site";
import { CALLBACK_TOPICS_EXISTING, CALLBACK_TOPICS_NEW, type FieldErrors } from "@/lib/leads/constants";
import { submitLead } from "@/lib/leads/client";
import { contactErrors } from "@/lib/leads/validate";
import { Turnstile } from "./Turnstile";
import { CheckIcon } from "./Icons";
import { useLeadForm } from "./form/useLeadForm";

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
  const doneRef = useRef<HTMLDivElement>(null);
  const f = useLeadForm("callback", () => ({ existing_job: existing === "yes", topic }));

  const chooseExisting = (v: Existing) => {
    setExisting(v);
    // Topics differ per branch, so a choice from the other list no longer applies.
    if (v !== existing) setTopic("");
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const local: FieldErrors = {};
    if (!existing) local.existingJob = "Choose an answer.";
    if (!topic) local.topic = "Choose a topic.";
    if (get("message").length < 3) local.message = "Tell us what you would like to discuss.";
    if (!get("firstName")) local.firstName = "Enter your first name.";
    if (!get("lastName")) local.lastName = "Enter your last name.";
    Object.assign(local, contactErrors(get));

    const ok = await f.submit(local, async () => {
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
        turnstileToken: f.token,
        requestId: f.requestId,
      });
    });
    if (ok) requestAnimationFrame(() => doneRef.current?.focus());
  }

  const { field, error: err, id: fid, errors, status } = f;

  if (status === "done") {
    return (
      <div className="cs-form" id="callback">
        <div className="form-success" ref={doneRef} tabIndex={-1} role="status">
          <span className="form-success__icon form-success__icon--ink">
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
    <form ref={f.formRef} className="cs-form" id="callback" noValidate onSubmit={onSubmit} onFocus={f.onStart} aria-label="Request a callback" aria-busy={status === "sending"}>
      <div className="cs-step">
        <span className="cs-step__n" aria-hidden="true">
          1
        </span>
        <h2 className="cs-step__t">About your request</h2>
      </div>

      <fieldset aria-describedby={errors.existingJob ? f.errorId("existingJob") : undefined}>
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
              <input type="radio" name="existingJob" value={v} checked={existing === v} onChange={() => chooseExisting(v)} />
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
              <input className="input" type="text" defaultValue={prefill.job} maxLength={40} autoComplete="off" {...field("jobNumber", `${fid("jobNumber")}-hint`)} />
              <span className="field-hint" id={`${fid("jobNumber")}-hint`}>
                Shown on your booking confirmation or invoice, for example {site.callback.jobNumberExample}
              </span>
            </div>
          )}
          <div className="field">
            <label htmlFor={fid("topic")}>{existing === "yes" ? "What would you like to discuss?" : "What type of enquiry?"}</label>
            <select className="select" value={topic} onChange={(e) => setTopic(e.target.value)} {...field("topic")}>
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
              <span className="small">
                Send a photo, draw on it to show what you want, and get a concept image and estimate within 48 hours. Or carry on here and we will call you.
              </span>
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
        <textarea className="textarea" rows={4} maxLength={2000} {...field("message")} />
        {err("message")}
      </div>
      <div className="field">
        <label htmlFor={fid("zip")}>Zip code</label>
        <input className="input" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={10} defaultValue={prefill.zip} {...field("zip", `${fid("zip")}-hint`)} />
        <span className="field-hint" id={`${fid("zip")}-hint`}>
          So we can confirm we cover your area
        </span>
        {err("zip")}
      </div>

      <div className="cs-step">
        <span className="cs-step__n" aria-hidden="true">
          3
        </span>
        <h2 className="cs-step__t">How to reach you</h2>
      </div>
      <div className="grid-2 grid-2--roomy">
        <div className="field">
          <label htmlFor={fid("firstName")}>First name</label>
          <input className="input" type="text" autoComplete="given-name" maxLength={80} defaultValue={prefill.first} {...field("firstName")} />
          {err("firstName")}
        </div>
        <div className="field">
          <label htmlFor={fid("lastName")}>Last name</label>
          <input className="input" type="text" autoComplete="family-name" maxLength={80} defaultValue={prefill.last} {...field("lastName")} />
          {err("lastName")}
        </div>
        <div className="field">
          <label htmlFor={fid("phone")}>Phone</label>
          <input className="input" type="tel" autoComplete="tel" maxLength={30} defaultValue={prefill.phone} {...field("phone")} />
          {err("phone")}
        </div>
        <div className="field">
          <label htmlFor={fid("email")}>Email</label>
          <input className="input" type="email" autoComplete="email" maxLength={200} defaultValue={prefill.email} {...field("email")} />
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
      <Turnstile active={f.started} onToken={f.onToken} resetKey={f.resetKey} />

      {f.formError && (
        <p className="form-status form-status--error" role="alert">
          {f.formError}
        </p>
      )}
      <button type="submit" className="btn btn--ink btn--block btn--tall" disabled={status === "sending"}>
        {status === "sending" ? "Sending" : "Request a callback"}
      </button>
    </form>
  );
}
