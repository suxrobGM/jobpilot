import path from "node:path";
import { fileURLToPath } from "node:url";
import createMDX from "@next/mdx";
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
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Compile the workspace TS packages consumed by the app.
  transpilePackages: ["@jobpilot/contracts", "@jobpilot/api-client"],
  // Next can only type-check via the TS6 JS API shim; `bun run typecheck` (TS7 native) is the gate.
  typescript: { ignoreBuildErrors: true },
};

// Plugins must be string references under Turbopack (loader options are serialized).
const withMDX = createMDX({
  options: {
    remarkPlugins: [["remark-gfm"]],
  },
});

export default withMDX(config);
