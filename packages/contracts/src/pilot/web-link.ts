import { z } from "zod/v4";

// Agent-supplied links are rendered as clickable hrefs and web-push click targets, so reject
// javascript:/data: and other non-web schemes at the write boundary.
export const webLinkSchema = z
  .string()
  .max(2048)
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\//i.test(v),
    "must be a relative path or http(s) URL",
  );
