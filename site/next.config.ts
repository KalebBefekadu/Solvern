import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const preview = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production";
const supabaseOrigin = (() => {
  try {
    return process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();

/**
 * Content Security Policy. Next.js inlines its bootstrap scripts, so script-src keeps 'unsafe-inline';
 * everything else is locked to this origin plus the two services the forms use:
 * Cloudflare Turnstile (script and frame) and Supabase Storage (direct photo uploads).
 * Adding Google Tag Manager later means adding its hosts here (docs/08-open-items.md).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin} https://challenges.cloudflare.com`.trim(),
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Share cards read these fonts from disk; make sure the serverless bundle carries them.
  outputFileTracingIncludes: { "/**/*": ["./src/fonts/og/*.woff"] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
      // Logo symbol and brand art: cached for a day, refreshed in the background after that.
      {
        source: "/brand/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/api/(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      // Preview deployments: keep every page out of search, whatever links to them.
      ...(preview ? [{ source: "/(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }] : []),
    ];
  },
};

export default nextConfig;
