import Link from "next/link";
import { site } from "@/content/site";
import { navName, tradesByFamily } from "@/lib/content";
import { Lockup } from "./Logo";

/**
 * withTrades: the full 23-trade directory. Main site only. Trade pages never show it (owner rule).
 */
export function SiteFooter({ withTrades = false, compact = false }: { withTrades?: boolean; compact?: boolean }) {
  if (compact) {
    return (
      <footer className="site-footer" style={{ paddingTop: 40 }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, fontSize: 14 }}>
          <Link href="/" aria-label="Solvern Home">
            <Lockup />
          </Link>
          <span>{site.legalLine}</span>
        </div>
      </footer>
    );
  }
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <Link href="/" aria-label="Solvern Home">
              <Lockup />
            </Link>
            <span>{site.footerLine}</span>
          </div>
          <div className="site-footer__cols">
            <div>
              <span className="site-footer__h">Contact</span>
              <a href={site.phone.href} data-location="footer">
                {site.phone.display}
              </a>
              <span>{site.email}</span>
            </div>
            <div>
              <span className="site-footer__h">Company</span>
              <Link href="/about">About</Link>
              <Link href="/reviews">Reviews</Link>
              <Link href="/financing">Financing</Link>
            </div>
            <div>
              <span className="site-footer__h">Help</span>
              <Link href="/customer-service">Customer service</Link>
              <Link href="/customer-service#callback">Request a callback</Link>
            </div>
          </div>
        </div>

        {withTrades && (
          <nav className="site-footer__trades" aria-label="All trades">
            {tradesByFamily().map(({ family, trades }) => (
              <div key={family}>
                <span className="site-footer__h">{family}</span>
                <ul>
                  {trades.map((t) => (
                    <li key={t.slug}>
                      <Link href={`/${t.slug}`}>{navName(t)}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}

        <div className="site-footer__legal">
          <span>{site.legalLine}</span>
          <nav aria-label="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
