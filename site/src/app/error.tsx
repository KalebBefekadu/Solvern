"use client";

import Link from "next/link";
import { useEffect } from "react";
import { site } from "@/content/site";

/** Route-level error boundary: keeps the phone number and a way forward on screen. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="wrap page-head" style={{ paddingBottom: 96 }}>
      <span className="eyebrow">Something went wrong</span>
      <h1 className="h1">This page did not load.</h1>
      <p className="lead">Try again, or call us and we will take it from here.</p>
      <div className="btn-row">
        <button type="button" className="btn btn--ink" onClick={reset}>
          Try again
        </button>
        <a href={site.phone.href} className="btn btn--outline" data-location="error">
          Call {site.phone.display}
        </a>
        <Link href="/" className="text-link">
          Go to Solvern Home
        </Link>
      </div>
    </main>
  );
}
