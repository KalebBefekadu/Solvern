"use client";

import { site } from "@/content/site";

/** Last-resort boundary for errors in the root layout. Renders its own document, so styles are inline. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Helvetica Neue, Arial, sans-serif", color: "#1B2330", background: "#FFFFFF" }}>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "96px 24px" }}>
          <h1 style={{ fontSize: 40, lineHeight: "44px", margin: "0 0 16px" }}>This page did not load.</h1>
          <p style={{ fontSize: 18, lineHeight: "28px" }}>Try again, or call us and we will take it from here.</p>
          <p style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={reset}
              style={{ minHeight: 48, padding: "0 24px", borderRadius: 999, border: 0, background: "#1B2330", color: "#FFFFFF", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
            >
              Try again
            </button>
            <a href={site.phone.href} style={{ color: "#1B2330", fontWeight: 700 }}>
              Call {site.phone.display}
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
