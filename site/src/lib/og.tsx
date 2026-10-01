/**
 * Social share cards (Open Graph and Twitter), rendered at build time with next/og.
 * Brand only: the Solvern mark, Plus Jakarta Sans, white ground, ink text and the trade color.
 * No illustration: trade art is still an open item.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const INK = "#1B2330";
const WHITE = "#FFFFFF";

let fonts: Promise<{ name: string; data: Buffer; weight: 600 | 800; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    ([600, 800] as const).map(async (weight) => ({
      name: "Plus Jakarta Sans",
      data: await fs.readFile(path.join(process.cwd(), "src/fonts/og", `PlusJakartaSans-${weight}.woff`)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

function Mark({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill={color}>
      <path d="M16 16H80V30H30V41H51L45 55H16Z" />
      <path d="M55 41H80V80H16V66H66V55H49Z" />
    </svg>
  );
}

export interface OgCard {
  /** "Solvern Carpentry", "Solvern Home" */
  eyebrow: string;
  title: string;
  /** Accent: the trade color, or ink on the hub. */
  color: string;
  /** Text color on the accent. */
  onColor: string;
}

export async function renderOgImage({ eyebrow, title, color, onColor }: OgCard) {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: WHITE, fontFamily: "Plus Jakarta Sans", color: INK }}>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", padding: "64px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Mark color={INK} size={64} />
          <span style={{ fontSize: 34, fontWeight: 800 }}>{eyebrow}</span>
        </div>
        <div style={{ display: "flex", fontSize: title.length > 48 ? 64 : 76, lineHeight: 1.08, fontWeight: 800, maxWidth: 1000 }}>{title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: color, color: onColor, padding: "0 72px", height: 108 }}>
        <span style={{ fontSize: 32, fontWeight: 800 }}>See it first. Built right.</span>
        <span style={{ fontSize: 26, fontWeight: 600 }}>Metro Atlanta</span>
      </div>
    </div>,
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
