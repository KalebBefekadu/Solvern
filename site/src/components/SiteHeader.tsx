"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { site } from "@/content/site";
import { Lockup } from "./Logo";
import { ChevronDown, CloseIcon, MenuIcon, PhoneIcon } from "./Icons";

export interface NavLink {
  label: string;
  href: string;
}
export interface TradeGroup {
  family: string;
  trades: { slug: string; shortName: string; color: string }[];
}

interface Props {
  /** trade: no trade directory (owner rule). hub: full trades menu. minimal: customer service page. */
  variant: "trade" | "hub" | "minimal";
  links?: NavLink[];
  primary?: NavLink;
  tradeGroups?: TradeGroup[];
  label?: string;
}

export function SiteHeader({ variant, links = [], primary, tradeGroups = [], label }: Props) {
  const [open, setOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const menuId = useId();
  const megaId = useId();
  const megaRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // The mobile menu only exists below 1024px: close it if the window grows past that.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 1025px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  useEffect(() => {
    if (!open && !megaOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (open) {
          setOpen(false);
          menuBtnRef.current?.focus();
        }
        if (megaOpen) {
          setMegaOpen(false);
          triggerRef.current?.focus();
        }
      }
    };
    const onClick = (e: MouseEvent) => {
      if (megaOpen && !megaRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setMegaOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open, megaOpen]);

  const close = () => {
    setOpen(false);
    setMegaOpen(false);
  };

  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Link href="/" className="site-header__logo" aria-label="Solvern Home" onClick={close}>
          <Lockup title="Solvern" />
        </Link>

        {variant !== "minimal" && (
          <nav aria-label="Main" className="site-nav">
            {variant === "hub" && (
              <button
                ref={triggerRef}
                type="button"
                className="nav-trigger"
                aria-expanded={megaOpen}
                aria-controls={megaId}
                onClick={() => setMegaOpen((v) => !v)}
              >
                Trades <ChevronDown />
              </button>
            )}
            {links.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="site-header__right">
          {variant === "minimal" ? (
            <span className="site-header__cs" style={{ display: "inline", fontWeight: 700 }}>
              {label}
            </span>
          ) : (
            <Link href="/customer-service" className="site-header__cs">
              Customer service
            </Link>
          )}
          <a href={site.phone.href} className="site-header__phone" data-location="header">
            {site.phone.display}
          </a>
          {primary && (
            <Link href={primary.href} className="btn btn--ink btn--sm" data-track="cta_click" data-location="header">
              {primary.label}
            </Link>
          )}
          <a href={site.phone.href} className="icon-btn" aria-label={`Call ${site.phone.display}`} data-location="header-mobile">
            <PhoneIcon />
          </a>
          {variant !== "minimal" && (
            <button
              ref={menuBtnRef}
              type="button"
              className="icon-btn"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          )}
        </div>
      </div>

      {variant === "hub" && megaOpen && (
        <div className="mega" id={megaId} ref={megaRef}>
          <div className="wrap mega__grid">
            {tradeGroups.map((g) => (
              <div key={g.family}>
                <span className="mega__family">{g.family}</span>
                {g.trades.map((t) => (
                  <Link key={t.slug} href={`/${t.slug}`} onClick={close}>
                    <span className="swatch" style={{ ["--sw" as string]: t.color }} aria-hidden="true" />
                    {t.shortName}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {variant !== "minimal" && (
        <div className="mobile-menu" id={menuId} data-open={open}>
          {/* Rendered only while open: the button needs JavaScript anyway, and this keeps 23 links out of every page's HTML. */}
          {open && (
            <nav aria-label="Mobile" className="wrap">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={close}>
                  {l.label}
                </Link>
              ))}
              <Link href="/customer-service" onClick={close}>
                Customer service
              </Link>
              {variant === "hub" &&
                tradeGroups.map((g) => (
                  <div key={g.family}>
                    <div className="mobile-menu__group">{g.family}</div>
                    {g.trades.map((t) => (
                      <Link key={t.slug} href={`/${t.slug}`} className="mobile-menu__trade" onClick={close}>
                        <span className="swatch" style={{ ["--sw" as string]: t.color }} aria-hidden="true" />
                        {t.shortName}
                      </Link>
                    ))}
                  </div>
                ))}
            </nav>
          )}
        </div>
      )}
    </header>
  );
}
