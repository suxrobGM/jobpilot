import { ImageResponse } from "next/og";
import { markDataUri } from "@/components/brand/mark-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Full-bleed: iOS applies its own squircle mask and dislikes transparency.
export default function AppleIcon(): ImageResponse {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      {/* biome-ignore lint/performance/noImgElement: this is a next/og data-URI SVG, not a Next <Image>. */}
      <img width={180} height={180} src={markDataUri(180, { bleed: true })} alt="" />
    </div>,
    { ...size },
  );
}
