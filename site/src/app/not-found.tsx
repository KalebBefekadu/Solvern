import Link from "next/link";
import { site } from "@/content/site";
import { SimplePage } from "@/components/SimplePage";

export default function NotFound() {
  return (
    <SimplePage>
      <section className="wrap page-head" style={{ paddingBottom: 96 }}>
        <span className="eyebrow">Page not found</span>
        <h1 className="h1">This page is not here.</h1>
        <p className="lead">The link may be old or mistyped. Start from the home page, or call us and we will point you in the right direction.</p>
        <div className="btn-row">
          <Link href="/" className="btn btn--ink">
            Go to Solvern Home
          </Link>
          <a href={site.phone.href} className="btn btn--outline" data-location="404">
            Call {site.phone.display}
          </a>
        </div>
      </section>
    </SimplePage>
  );
}
