import type { ReactElement, ReactNode } from "react";
import { markDataUri } from "@/components/brand/mark-svg";
import { accent, feedback, surfaces, textColors } from "@/theme/palette";

export const OG_SIZE = { width: 1200, height: 630 };

interface OgFrameProps {
  /** Brand mark edge in px; the wordmark scales with it. */
  markSize: number;
  children: ReactNode;
  footer: ReactNode;
}

// Satori renders this - inline styles only, no MUI/emotion, every multi-child div is flex.
export function OgFrame(props: OgFrameProps): ReactElement {
  const { markSize, children, footer } = props;
  return (
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
        {/* biome-ignore lint/performance/noImgElement: this is a next/og data-URI SVG, not a Next <Image>. */}
        <img width={markSize} height={markSize} src={markDataUri(markSize)} alt="" />
        <div style={{ color: textColors.primary, fontSize: markSize * 0.62, fontWeight: 700 }}>
          JobPilot
        </div>
      </div>
      {children}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: textColors.disabled,
          fontSize: 24,
        }}
      >
        {footer}
      </div>
    </div>
  );
}
