import type { ReactElement } from "react";
import { UnfoldMore } from "@mui/icons-material";
import { ButtonBase } from "@mui/material";
import { TURN_INDENT } from "./pilot-turn";
import { foldLabel, type ThreadRow } from "./thread-folds";

interface ThreadFoldProps {
  rows: ThreadRow[];
  onOpen: () => void;
}

/** A quiet stretch of history as one line; opening it lays the rows back out in place. */
export function ThreadFold(props: ThreadFoldProps): ReactElement {
  const { rows, onOpen } = props;
  return (
    <ButtonBase
      onClick={onOpen}
      sx={(theme) => ({
        alignSelf: "flex-start",
        gap: 1,
        ml: { xs: 0, sm: TURN_INDENT },
        px: 1,
        py: 0.5,
        borderRadius: theme.radii.md,
        color: "text.secondary",
        typography: "body2",
        transition: theme.motion.fast,
        "&:hover": { color: "text.primary", backgroundColor: theme.palette.surfaces.card },
      })}
    >
      <UnfoldMore fontSize="sm" />
      {foldLabel(rows)}
    </ButtonBase>
  );
}
