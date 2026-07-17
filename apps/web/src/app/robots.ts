import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { PUBLIC_ROUTES } from "./public-routes";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [...PUBLIC_ROUTES],
        disallow: [
          "/workspace",
          "/campaigns",
          "/applications",
          "/analytics",
          "/inbox",
          "/outreach",
          "/documents",
          "/resumes",
          "/cover-letters",
          "/boards",
          "/upwork",
          "/settings",
          "/onboarding",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
