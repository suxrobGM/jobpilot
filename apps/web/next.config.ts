import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

// No /api proxy: the browser calls the backend directly (see api/base-url.ts).
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
};

export default config;
