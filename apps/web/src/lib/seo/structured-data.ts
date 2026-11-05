import { GITHUB_URL, SITE_URL } from "@/lib/constants";

// schema.org JSON-LD builders. Stable @id anchors let the graph nodes reference each other.
const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

const abs = (path: string): string => `${SITE_URL}${path === "/" ? "" : path}`;

export function organizationLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: "JobPilot",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    sameAs: [GITHUB_URL],
  };
}

export function websiteLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    name: "JobPilot",
    url: SITE_URL,
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
  };
}

export function softwareApplicationLd(description: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "JobPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Windows, macOS, Linux",
    url: SITE_URL,
    description,
    // Free and open source - the agent runs on the user's own Claude/Codex plan.
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    license: GITHUB_URL,
    publisher: { "@id": ORG_ID },
  };
}

export function faqPageLd(items: readonly { q: string; a: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export interface PersonLdInput {
  name: string;
  username: string;
  headline: string | null;
  links: { website: string | null; linkedin: string | null; github: string | null };
}

/** ProfilePage + Person for a public portfolio; `sameAs` links out to the person's own profiles. */
export function personLd(person: PersonLdInput): object {
  const sameAs = [person.links.website, person.links.linkedin, person.links.github].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: person.name,
      url: abs(`/u/${person.username}`),
      ...(person.headline && { jobTitle: person.headline }),
      ...(sameAs.length > 0 && { sameAs }),
    },
  };
}

export function breadcrumbLd(trail: readonly { name: string; path: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: abs(crumb.path),
    })),
  };
}
