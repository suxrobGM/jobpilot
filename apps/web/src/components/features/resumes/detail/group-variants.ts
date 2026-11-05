import type { ResumeVariantListItem } from "@/api/types";

export interface VariantGroup {
  company: string;
  variants: ResumeVariantListItem[];
  attached: number;
}

const UNGROUPED = "Other";

/** The tailor skill labels variants `"<Company> - <Job title>"`; the URL host is the fallback. */
function variantCompany(variant: ResumeVariantListItem): string {
  const [head, ...rest] = variant.label.split(" - ");
  if (rest.length > 0 && head.trim()) {
    return head.trim();
  }
  if (variant.jobUrl) {
    try {
      return new URL(variant.jobUrl).hostname.replace(/^www\./, "");
    } catch {
      return UNGROUPED;
    }
  }
  return UNGROUPED;
}

/** Groups by company, biggest group first, with `Other` pinned last. */
export function groupVariants(variants: ResumeVariantListItem[]): VariantGroup[] {
  const byCompany = new Map<string, ResumeVariantListItem[]>();
  for (const variant of variants) {
    const company = variantCompany(variant);
    byCompany.set(company, [...(byCompany.get(company) ?? []), variant]);
  }

  return [...byCompany]
    .map(([company, rows]) => ({
      company,
      variants: rows,
      attached: rows.filter((row) => row.applicationId !== null).length,
    }))
    .sort((a, b) => {
      if (a.company === UNGROUPED) {
        return 1;
      }
      if (b.company === UNGROUPED) {
        return -1;
      }
      return b.variants.length - a.variants.length || a.company.localeCompare(b.company);
    });
}
