import type { ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { fontFamilies } from "@/theme";
import { PanelBadge, PanelFrame, panelCellSx } from "./panel-frame";

const CLIENT_MARKERS = ["$40k+ spent", "92% hire rate", "4.9 rating", "payment verified"];

export function UpworkPanel(): ReactElement {
  return (
    <PanelFrame label="upwork">
      <Stack spacing={1.5}>
        <Box sx={[panelCellSx, { padding: 1.5 }]}>
          <Stack spacing={1}>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
              Build a Next.js dashboard for a logistics startup
            </Typography>
            <Typography variant="captionMuted">Fixed price · $4,500 · Expert</Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
              {CLIENT_MARKERS.map((marker) => (
                <PanelBadge key={marker} mono color="text.secondary" borderColor="line.border">
                  {marker}
                </PanelBadge>
              ))}
            </Stack>
          </Stack>
        </Box>
        <Stack spacing={0.5}>
          <Typography
            sx={{ fontFamily: fontFamilies.mono, fontSize: "0.6875rem", color: "text.disabled" }}
          >
            ✕ 14 jobs dropped · low hire rate, no spend history
          </Typography>
          <Typography
            sx={{ fontFamily: fontFamilies.mono, fontSize: "0.6875rem", color: "success.main" }}
          >
            ✓ proposal drafted · awaiting your review
          </Typography>
        </Stack>
      </Stack>
    </PanelFrame>
  );
}
