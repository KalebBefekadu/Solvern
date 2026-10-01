import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home screen icon: the Solvern mark in white on ink. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1B2330" }}>
        <svg width={120} height={120} viewBox="0 0 96 96" fill="#FFFFFF">
          <path d="M16 16H80V30H30V41H51L45 55H16Z" />
          <path d="M55 41H80V80H16V66H66V55H49Z" />
        </svg>
      </div>
    ),
    size,
  );
}
