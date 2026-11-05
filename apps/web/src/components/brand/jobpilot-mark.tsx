import type { ReactElement } from "react";
import { Box } from "@mui/material";

interface JobPilotMarkProps {
  /** Rendered width/height in px (the mark is square). */
  size?: number;
}

/** Mirrored by `public/icon.svg` and `mark-svg.ts`. Repeated gradient ids match, so no `useId`. */
export function JobPilotMark(props: JobPilotMarkProps): ReactElement {
  const { size = 36 } = props;
  return (
    <Box
      component="svg"
      aria-hidden
      viewBox="0 0 100 100"
      sx={{ width: size, height: size, display: "block" }}
    >
      <defs>
        <linearGradient id="jp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#191A22" />
          <stop offset="1" stopColor="#0B0B0A" />
        </linearGradient>
        <linearGradient id="jp-flame" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#FF8A5C" />
          <stop offset="0.55" stopColor="#FF6A3D" />
          <stop offset="1" stopColor="#D9532A" />
        </linearGradient>
        <radialGradient id="jp-crown" cx="0.5" cy="0.08" r="0.7">
          <stop offset="0" stopColor="#4C8DFF" stopOpacity="0.34" />
          <stop offset="1" stopColor="#4C8DFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="jp-ember" cx="0.5" cy="0.9" r="0.6">
          <stop offset="0" stopColor="#FF6A3D" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FF6A3D" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="jp-eye" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#CFE0FF" />
          <stop offset="1" stopColor="#6FA8FF" />
        </radialGradient>
      </defs>
      <rect
        x="3"
        y="3"
        width="94"
        height="94"
        rx="24"
        fill="url(#jp-bg)"
        stroke="#3A3B44"
        strokeWidth="1.5"
      />
      <rect x="3" y="3" width="94" height="94" rx="24" fill="url(#jp-crown)" />
      <rect x="3" y="3" width="94" height="94" rx="24" fill="url(#jp-ember)" />
      <line
        x1="50"
        y1="16"
        x2="50"
        y2="9.5"
        stroke="#FF6A3D"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="50" cy="7" r="3" fill="#6FA8FF" />
      <rect
        x="21"
        y="26"
        width="58"
        height="17"
        rx="8.5"
        fill="#0C0D13"
        stroke="#23252F"
        strokeWidth="1.4"
      />
      <circle cx="37" cy="34.5" r="5.6" fill="url(#jp-eye)" />
      <circle cx="63" cy="34.5" r="5.6" fill="url(#jp-eye)" />
      <circle cx="35" cy="32.5" r="1.7" fill="#FFFFFF" fillOpacity="0.85" />
      <circle cx="61" cy="32.5" r="1.7" fill="#FFFFFF" fillOpacity="0.85" />
      <path
        d="M45 53 L67 53"
        fill="none"
        stroke="url(#jp-flame)"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M63 53 L63 70 C63 80 54 86 44 86 C37 86 32 83 29 77"
        fill="none"
        stroke="url(#jp-flame)"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  );
}
