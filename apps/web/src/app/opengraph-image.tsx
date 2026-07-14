import { ImageResponse } from "next/og";
import { accent, feedback, surfaces, textColors } from "@/theme/palette";
import { gradients } from "@/theme/tokens";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "JobPilot - your AI job agent";

// Satori renders this - inline styles only, no MUI/emotion, every multi-child div is flex.
export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: surfaces.base,
        padding: 80,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: 10,
          background: `linear-gradient(90deg, ${accent.primary}, ${feedback.warning}, ${accent.secondary})`,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            background: gradients.reversed,
            border: `1px solid ${accent.primary}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          J
        </div>
        <div style={{ color: textColors.primary, fontSize: 40, fontWeight: 700 }}>JobPilot</div>
      </div>
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
          Your AI job agent, running on your machine.
        </div>
        <div style={{ color: textColors.secondary, fontSize: 30, lineHeight: 1.4, maxWidth: 940 }}>
          Search any job board, tailor your resume, apply, and track every reply - on your own
          Claude or Codex subscription.
        </div>
      </div>
      <div style={{ display: "flex", color: textColors.disabled, fontSize: 24 }}>
        jobpilot.suxrobgm.net
      </div>
    </div>,
    { ...size },
  );
}
