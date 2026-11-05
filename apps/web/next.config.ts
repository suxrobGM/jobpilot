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
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    turbopackRustReactCompiler: true,
    turbopackGc: true,
  },
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1"],
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Compile the workspace TS packages consumed by the app.
  transpilePackages: ["@jobpilot/contracts", "@jobpilot/api-client"],
  // Index routes that only pick a default tab. The query string carries over, so the OAuth
  // callback flags still reach the security tab.
  redirects: async () => [
    { source: "/account/security", destination: "/settings/security", permanent: true },
    { source: "/settings", destination: "/settings/profile", permanent: false },
    { source: "/documents", destination: "/documents/resumes", permanent: false },
    // Detail routes stay under these prefixes, since plugin skills link to them.
    { source: "/resumes", destination: "/documents/resumes", permanent: false },
    { source: "/cover-letters", destination: "/documents/cover-letters", permanent: false },
    { source: "/networking", destination: "/networking/contacts", permanent: false },
  ],
};

// Plugins must be string references under Turbopack (loader options are serialized).
const withMDX = createMDX({
  options: {
    remarkPlugins: [["remark-gfm"]],
  },
});

export default withMDX(config);
