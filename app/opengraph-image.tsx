import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = BRAND.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "white" }}>
        <div style={{ display: "flex", fontSize: 150, fontWeight: 700, width: 220, height: 220, borderRadius: 48, background: "#0d9488", alignItems: "center", justifyContent: "center" }}>S</div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 700, marginTop: 36 }}>{BRAND.name}</div>
        <div style={{ display: "flex", fontSize: 38, marginTop: 14, color: "#99f6e4" }}>{BRAND.tagline}</div>
      </div>
    ),
    size,
  );
}
