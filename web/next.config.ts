import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  reactCompiler: true,
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material"],
  },
  serverExternalPackages: ["@prisma/client"],
};

export default config;
