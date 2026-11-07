import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { PUBLIC_ROUTES } from "./public-routes";

/**
 * Keep this polarity: `disallow: ["/"]` ties with PUBLIC_ROUTES' "/" and loses, and crawlers
 * honoring only `Disallow:` would read it as "block the whole site".
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [...PUBLIC_ROUTES],
        disallow: [
          "/admin",
          "/pilot",
          "/pipeline",
          "/applications",
          "/analytics",
          "/inbox",
          "/networking",
          "/resumes",
          "/cover-letters",
          "/portfolio",
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
