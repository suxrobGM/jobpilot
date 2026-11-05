import { SITE_URL } from "@/lib/constants";
import {
  employmentTypes,
  type JobLocation,
  monetaryAmount,
  parseJobLocation,
} from "./job-posting-fields";

interface JobPostingLdInput {
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  salary: string | null;
  employmentType: string | null;
  descriptionExcerpt: string | null;
  skills: readonly string[];
  requirements: readonly string[];
  responsibilities: readonly string[];
  yearsExperience: number | null;
  /** Eden hands back a `Date`; a string is accepted so callers never have to re-wrap it. */
  firstSeenAt: Date | string;
  lastSeenAt: Date | string;
  slug: string;
}

/** Agents never see a posting close, only stop seeing it, so expiry counts from the last sighting. */
const LISTING_VALID_DAYS = 30;

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function htmlList(heading: string, items: readonly string[]): string {
  if (items.length === 0) {
    return "";
  }
  const lis = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<h3>${heading}</h3><ul>${lis}</ul>`;
}

/** Google wants the full description, so this mirrors every section the page renders. */
function jobDescriptionHtml(job: JobPostingLdInput): string {
  const intro = job.descriptionExcerpt ?? `${job.title} at ${job.company}.`;
  return [
    `<p>${escapeHtml(intro)}</p>`,
    htmlList("Requirements", job.requirements),
    htmlList("What you'll do", job.responsibilities),
    htmlList("Skills", job.skills),
  ].join("");
}

function jobPlace(location: JobLocation): object {
  const country = location.countries[0];
  return {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      ...(location.locality && { addressLocality: location.locality }),
      ...(location.region && { addressRegion: location.region }),
      ...(country && { addressCountry: country }),
    },
  };
}

/**
 * `datePosted` is our first sighting, not the board's post date. Returns null when Google would
 * reject the item: a remote job must name a hiring country, an on-site one a place.
 */
export function jobPostingLd(job: JobPostingLdInput): object | null {
  const location = parseJobLocation(job.location ?? "");
  // The API already sets `remote` from the location text at ingest.
  const { remote } = job;
  const hasCountry = location.countries.length > 0;
  const hasPlace = location.locality !== null || hasCountry;
  const eligible = remote ? hasCountry : hasPlace;
  if (!eligible) {
    return null;
  }

  const lastSeen = new Date(job.lastSeenAt).getTime();
  const employmentType = employmentTypes(job.employmentType);
  const baseSalary = monetaryAmount(job.salary);

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    url: `${SITE_URL}/jobs/${job.slug}`,
    datePosted: new Date(job.firstSeenAt).toISOString(),
    validThrough: new Date(lastSeen + LISTING_VALID_DAYS * 86_400_000).toISOString(),
    description: jobDescriptionHtml(job),
    hiringOrganization: { "@type": "Organization", name: job.company },
    // Applying happens on the source board.
    directApply: false,
    ...(employmentType.length > 0 && { employmentType }),
    ...(baseSalary && { baseSalary }),
    ...(job.skills.length > 0 && { skills: job.skills.join(", ") }),
    ...(job.responsibilities.length > 0 && { responsibilities: job.responsibilities.join(" ") }),
    ...(job.yearsExperience && {
      experienceRequirements: {
        "@type": "OccupationalExperienceRequirements",
        monthsOfExperience: job.yearsExperience * 12,
      },
    }),
    ...(remote && {
      jobLocationType: "TELECOMMUTE",
      applicantLocationRequirements: location.countries.map((code) => ({
        "@type": "Country",
        name: code,
      })),
    }),
    ...(hasPlace && { jobLocation: jobPlace(location) }),
  };
}
