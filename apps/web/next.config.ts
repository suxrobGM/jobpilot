import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL ?? "http://localhost:8002";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(here, "../.."),
  cacheComponents: true,
  reactCompiler: true,
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1"],
  // Compile the workspace TS packages consumed by the app.
  transpilePackages: ["@jobpilot/contracts", "@jobpilot/api-client"],
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material"],
  },
  // Same-origin dev proxy: the browser (and the local agent) keep calling
  // /api/* on :8000; Next forwards to the Elysia backend. Keeps cookies
  // first-party and avoids cross-origin CORS in dev.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default config;
