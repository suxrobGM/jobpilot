import { ImageResponse } from "next/og";
import { api } from "@/api/client";
import { getPublicFetchOptions } from "@/api/server";
import { markDataUri } from "@/components/brand/mark-svg";
import { accent, feedback, surfaces, textColors } from "@/theme/palette";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "JobPilot portfolio";

interface OgProps {
  params: Promise<{ username: string }>;
}

// Satori renders this - inline styles only, no MUI/emotion, every multi-child div is flex.
export default async function PortfolioOgImage(props: OgProps): Promise<ImageResponse> {
  const { username } = await props.params;

  // Resolved outside the try: a bailout signal from `headers()` must not be swallowed as a down API.
  const options = await getPublicFetchOptions();

  // A down API must yield the generic card, never a 500 that breaks the link unfurl.
  let name = "JobPilot portfolio";
  let headline: string | null = null;
  let applications: number | null = null;
  try {
    const { data } = await api.public.portfolio({ username }).get(options);
    if (data) {
      name = data.displayName;
      headline = data.headline;
      applications = data.stats.applications;
    }
  } catch {
    // fall through to the generic card
  }

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
        {/* biome-ignore lint/performance/noImgElement: this is a next/og data-URI SVG, not a Next <Image>. */}
        <img width={56} height={56} src={markDataUri(56)} alt="" />
        <div style={{ color: textColors.primary, fontSize: 34, fontWeight: 700 }}>JobPilot</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            color: textColors.primary,
            fontSize: 80,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          {name}
        </div>
        {headline && (
          <div
            style={{ color: textColors.secondary, fontSize: 38, lineHeight: 1.3, maxWidth: 940 }}
          >
            {headline}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: textColors.disabled,
          fontSize: 24,
        }}
      >
        <div style={{ display: "flex" }}>jobpilot.suxrobgm.net/u/{username}</div>
        {applications !== null && (
          <div style={{ display: "flex", color: accent.primary }}>
            {applications} applications tracked
          </div>
        )}
      </div>
    </div>,
    { ...size },
  );
}
