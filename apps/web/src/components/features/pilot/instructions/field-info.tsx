"use client";

import type { ReactElement } from "react";
import { InfoOutlined } from "@mui/icons-material";
import { InputAdornment, Tooltip } from "@mui/material";

interface FieldInfoProps {
  title: string;
}

/** Info-tooltip end adornment for field help that doesn't fit in helperText. */
export function FieldInfo(props: FieldInfoProps): ReactElement {
  const { title } = props;
  return (
    <InputAdornment position="end">
      <Tooltip title={title}>
        <InfoOutlined fontSize="sm" sx={{ color: "text.secondary", cursor: "help" }} />
      </Tooltip>
    </InputAdornment>
  );
}
