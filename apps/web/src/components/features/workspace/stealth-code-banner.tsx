import type { ReactElement } from "react";
import { OpenInNew } from "@mui/icons-material";
import { Box, Link, Stack, Typography } from "@mui/material";

const STEALTH_CODE_URL = "https://github.com/suxrobGM/stealth-code";

/** Footer strip on the workspace page linking to the companion live-interview tool. */
export function StealthCodeBanner(): ReactElement {
  return (
    <Box sx={{ borderTop: 1, borderColor: "divider", paddingBlock: 1.5 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
      >
        <Typography variant="body2Muted">
          Got a technical interview? Stealth Code is an AI assistant for live rounds.
        </Typography>
        <Link
          href={STEALTH_CODE_URL}
          target="_blank"
          rel="noopener noreferrer"
          variant="body2"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
        >
          Download for Windows
          <OpenInNew fontSize="sm" />
        </Link>
      </Stack>
    </Box>
  );
}
