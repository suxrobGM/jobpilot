"use client";

import { type ReactElement, type ReactNode, useRef, useState } from "react";
import { PlayArrow } from "@mui/icons-material";
import { alpha, Box, Card, IconButton, Typography } from "@mui/material";
import { accent, motion, surfaces } from "@/theme";
import { Glow } from "../glow";
import { Section } from "../section";

const POSTER = "/teaser-poster.jpg";
const SOURCE = "/teaser.mp4";

// The poster is a busy UI screenshot; the play button needs a strong scrim.
const scrim = `radial-gradient(ellipse 45% 55% at 50% 50%, ${alpha(surfaces.base, 0.72)}, ${alpha(surfaces.base, 0.5)} 70%)`;

interface TeaserProps {
  /** The server-fetched proof strip, passed in because this is a client component. */
  footer: ReactNode;
}

/** Poster + `preload="none"`: the 10 MB cut costs nothing until a visitor asks for it. */
export function Teaser(props: TeaserProps): ReactElement {
  const { footer } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const play = (): void => {
    setStarted(true);
    void videoRef.current?.play();
  };

  return (
    <Section id="demo" tightTop>
      <Box sx={{ position: "relative" }}>
        <Glow placement="center" bleed={56} />
        <Card variant="showcase" sx={{ position: "relative" }}>
          <Box
            component="video"
            ref={videoRef}
            src={SOURCE}
            poster={POSTER}
            preload="none"
            playsInline
            controls={started}
            onEnded={() => setStarted(false)}
            sx={{ display: "block", width: "100%", height: "auto", aspectRatio: "16 / 9" }}
          />
          {!started && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                background: scrim,
              }}
            >
              <IconButton
                onClick={play}
                aria-label="Play the JobPilot demo"
                sx={{
                  width: { xs: 64, md: 84 },
                  height: { xs: 64, md: 84 },
                  color: "common.white",
                  border: 1,
                  borderColor: alpha(accent.primary, 0.55),
                  backgroundColor: alpha(accent.primary, 0.22),
                  backdropFilter: "blur(4px)",
                  transition: `transform ${motion.standard}, background-color ${motion.standard}`,
                  "&:hover": {
                    backgroundColor: alpha(accent.primary, 0.36),
                    transform: "scale(1.06)",
                  },
                  "@media (prefers-reduced-motion: reduce)": {
                    transition: "none",
                    "&:hover": { transform: "none" },
                  },
                }}
              >
                <PlayArrow fontSize="2xxl" />
              </IconButton>
            </Box>
          )}
        </Card>
      </Box>
      <Typography variant="body2Muted" sx={{ mt: 2, textAlign: "center" }}>
        A real Pilot run: one request finds new-grad ML roles on hiring.cafe, you pick one, and
        Claude Code submits the application. Sound on.
      </Typography>
      {footer}
    </Section>
  );
}
