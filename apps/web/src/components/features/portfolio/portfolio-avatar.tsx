import type { ReactElement } from "react";
import { Avatar } from "@mui/material";
import type { PortfolioDto } from "@/api/types";
import { initials } from "@/utils/format";

interface PortfolioAvatarProps {
  name: string;
  size: number;
  /** When "open", the avatar gets the success ring. Omit for no ring. */
  availability?: PortfolioDto["availability"];
}

/** Monogram avatar with the shared "open to work" ring - one home for the ring rule. */
export function PortfolioAvatar(props: PortfolioAvatarProps): ReactElement {
  const { name, size, availability } = props;
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        fontSize: size <= 44 ? "0.9rem" : "1.4rem",
        bgcolor: "surfaces.elevated",
        color: "accent.primary",
        border: availability === "open" ? "2px solid" : "none",
        borderColor: "success.main",
      }}
    >
      {initials(name)}
    </Avatar>
  );
}
