import { cors } from "@elysiajs/cors";
import { env } from "@/env";

export const corsPlugin = cors({
  origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  // Web is a different origin; without this the browser can't read Retry-After on a 429.
  exposeHeaders: ["retry-after"],
});
