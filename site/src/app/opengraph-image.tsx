import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Solvern Home: one team for every part of your home, across metro Atlanta.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({ eyebrow: "Solvern Home", title: "One team for every part of your home.", color: "#1B2330", onColor: "#FFFFFF" });
}
