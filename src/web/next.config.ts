import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  reactCompiler: true,
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material"],
  },
};

export default config;
