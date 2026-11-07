import type { CONTACT_DISCOVERY_SOURCES } from "@jobpilot/contracts/networking";

/** Where a contact was found, as the user reads it. */
export const FOUND_VIA: Record<(typeof CONTACT_DISCOVERY_SOURCES)[number], string> = {
  google: "Google",
  company_site: "Company site",
  web: "Web",
  linkedin: "LinkedIn",
  manual: "Added by you",
};
