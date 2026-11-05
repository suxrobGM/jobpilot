import type { JobListingPosted } from "@jobpilot/contracts/job-listing";
import type { SelectFieldOption } from "@/components/ui/form";

export const POSTED_OPTIONS: SelectFieldOption<JobListingPosted>[] = [
  { value: "24h", label: "Past 24 hours" },
  { value: "7d", label: "Past 7 days" },
  { value: "30d", label: "Past 30 days" },
];
