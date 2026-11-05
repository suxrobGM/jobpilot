import { ImageResponse } from "next/og";
import { OG_SIZE, OgFrame } from "@/components/seo/og-frame";
import { SITE_HOST } from "@/lib/constants";
import { textColors } from "@/theme/palette";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "JobPilot - an AI agent that applies to jobs for you";

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    <OgFrame markSize={64} footer={<div style={{ display: "flex" }}>{SITE_HOST}</div>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            color: textColors.primary,
            fontSize: 74,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          An AI agent that applies to jobs for you.
        </div>
        <div style={{ color: textColors.secondary, fontSize: 30, lineHeight: 1.4, maxWidth: 940 }}>
          It finds jobs, tailors your resume, and fills in applications. Free, and it runs on your
          Claude or Codex subscription.
        </div>
      </div>
    </OgFrame>,
    { ...size },
  );
}
