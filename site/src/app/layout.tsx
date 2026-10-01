import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@/styles/globals.css";
import { site } from "@/content/site";
import { seo } from "@/lib/content";
import { AnalyticsListener } from "@/components/AnalyticsListener";

// Plus Jakarta Sans (OFL), self-hosted variable font, weights 400 to 800. Latin subset.
const jakarta = localFont({
  src: "../fonts/PlusJakartaSans-latin-wght.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-jakarta",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: seo.home.title, template: "%s" },
  description: seo.home.description,
  applicationName: site.name,
  openGraph: { siteName: site.name, locale: "en_US", type: "website" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable} data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <AnalyticsListener />
      </body>
    </html>
  );
}
