import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { site } from "@/content/site";
import { SimplePage } from "@/components/SimplePage";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy | Solvern Home",
  description: "How Solvern Home collects, uses and protects the information and photos you send us through our website, forms and Concept Preview requests.",
  path: "/privacy",
});

// Template for the owner's attorney to review before launch. Bracketed values are open items.
export default function PrivacyPage() {
  return (
    <SimplePage>
      <section className="wrap page-head">
        <span className="eyebrow">Legal</span>
        <h1 className="h1">Privacy policy</h1>
        <p className="small">Last updated: [DATE]</p>
      </section>
      <section className="wrap page-end">
        <div className="prose">
          <p>
            This policy explains how {site.legalName}, doing business as Solvern Home (&quot;Solvern&quot;, &quot;we&quot;), handles information you share with us through this
            website.
          </p>
          <h2>What we collect</h2>
          <ul>
            <li>Contact details you enter in a form: name, phone, email and zip code.</li>
            <li>What you tell us about your project, including notes you add to photos.</li>
            <li>Photos you upload, the drawings you make on them, and a marked-up copy we create from them.</li>
            <li>Job numbers and booking details you give us when you request a callback.</li>
            <li>Basic visit information, such as the page you came from and campaign tags in the link you followed.</li>
          </ul>
          <h2>How we use it</h2>
          <ul>
            <li>To prepare your Concept Preview and estimate, schedule visits and respond to callback requests.</li>
            <li>To contact you by your preferred method about your request or job.</li>
            <li>To understand which pages and campaigns help homeowners find us.</li>
          </ul>
          <p>We do not sell your personal information.</p>
          <h2>Your photos</h2>
          <p>
            Photos are stored privately and used by our team to prepare your Concept Preview and estimate. We will only show your photos or Concept Preview publicly, such as in our
            project gallery, with your permission.
          </p>
          <h2>Who we share it with</h2>
          <p>
            Service providers that help us run the website and our business, such as hosting, data storage, email and spam protection, under agreements that limit how they use it.
            If you apply for financing, you share information directly with {site.financing.partner} under their own privacy policy.
          </p>
          <h2>How long we keep it</h2>
          <p>[Retention period set by the owner]</p>
          <h2>Your choices</h2>
          <p>
            You can ask us to access, correct or delete your information by calling {site.phone.display} or emailing {site.email}.
          </p>
          <h2>Contact</h2>
          <p>
            {site.legalName}, doing business as Solvern Home. {site.phone.display}. {site.email}.
          </p>
        </div>
      </section>
    </SimplePage>
  );
}
