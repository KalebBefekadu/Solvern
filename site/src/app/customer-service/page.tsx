import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import Link from "next/link";
import { Suspense } from "react";
import { site } from "@/content/site";
import { HUB_THEME } from "@/lib/content";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CallbackForm } from "@/components/CallbackForm";
import { CallbackFormWithPrefill } from "@/components/CallbackFormWithPrefill";
import { JsonLd } from "@/components/sections";
import { localBusinessJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Customer service: request a callback | Solvern Home",
  description: "Questions about new work or a job you have booked with Solvern Home? Request a callback and the right person on our team will call you back.",
  path: "/customer-service",
});

export default function CustomerServicePage() {
  return (
    <div style={HUB_THEME}>
      <SiteHeader variant="minimal" label="Customer service" />
      <main id="main">
        <section className="wrap page-head" aria-labelledby="cs-title">
          <span className="eyebrow">Customer service</span>
          <h1 className="h1 h1--cs" id="cs-title">
            Request a callback.
          </h1>
          <p className="lead">
            Questions about new work or a job you have booked? Fill in the form and the right person on our team will call you back. We aim to reply within{" "}
            {site.callback.responseTime} during {site.callback.hours}.
          </p>
        </section>

        <section className="wrap cs-grid page-end">
          <Suspense fallback={<CallbackForm />}>
            <CallbackFormWithPrefill />
          </Suspense>
          <aside className="cs-aside" aria-label="Other ways to reach us">
            <div className="cs-card cs-card--ink">
              <span className="cs-call__label">Prefer to call?</span>
              <a href={site.phone.href} className="cs-phone" data-location="customer-service">
                {site.phone.display}
              </a>
              <span>{site.callback.daysAndHours}</span>
            </div>
            <div className="cs-card cs-card--tint">
              <h2 className="cs-card__t">Already a customer?</h2>
              <p>Use the support link in any email from Solvern. It opens this form with your job details already filled in.</p>
            </div>
            <div className="cs-card cs-card--outline">
              <h2 className="cs-card__t">Planning something new?</h2>
              <p>Send a photo and get a concept image and estimate within 48 hours.</p>
              <Link href="/concept-preview" className="btn btn--ink btn--compact" data-track="cta_click" data-location="customer-service">
                Get my Concept Preview
              </Link>
            </div>
          </aside>
        </section>
      </main>
      <SiteFooter compact />
      <JsonLd data={localBusinessJsonLd()} />
    </div>
  );
}
