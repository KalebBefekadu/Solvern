import Link from "next/link";
import { site } from "@/content/site";

/** Mobile sticky bottom bar: Call plus the page's primary action. Hidden above 1024px. */
export function BottomBar({ primary }: { primary: { label: string; href: string } }) {
  return (
    <>
    <div className="bottom-bar-spacer" aria-hidden="true" />
    <div className="bottom-bar" role="region" aria-label="Quick actions">
      <a href={site.phone.href} className="btn btn--outline" data-location="bottom-bar">
        Call
      </a>
      <Link href={primary.href} className="btn btn--ink" data-track="cta_click" data-location="bottom-bar">
        {primary.label}
      </Link>
    </div>
    </>
  );
}
