const FIELD_TO_STEP: Record<string, number> = {
  firstName: 1,
  lastName: 1,
  email: 1,
  phone: 1,
  website: 1,
  linkedin: 1,
  github: 1,
  street: 2,
  aptUnit: 2,
  city: 2,
  state: 2,
  zipCode: 2,
  country: 2,
  usAuthorized: 3,
  requiresSponsorship: 3,
  visaStatus: 3,
  optExtension: 3,
  willingToRelocate: 3,
  preferredLocations: 3,
  eeoGender: 4,
  eeoRace: 4,
  eeoEthnicity: 4,
  eeoHispanicOrLatino: 4,
  eeoVeteranStatus: 4,
  eeoDisabilityStatus: 4,
};

export interface ValidationIssue {
  field: string;
  path: string;
  message: string;
  stepIndex: number | null;
}

export function describeIssues(
  issues: readonly { path: PropertyKey[]; message: string }[],
): ValidationIssue[] {
  return issues.map((issue) => {
    const field = String(issue.path[0] ?? "");
    return {
      field,
      path: issue.path.map(String).join(".") || "form",
      message: issue.message,
      stepIndex: FIELD_TO_STEP[field] ?? null,
    };
  });
}

export function firstStepWithIssue(issues: ValidationIssue[]): number | null {
  for (const issue of issues) {
    if (issue.stepIndex !== null) {
      return issue.stepIndex;
    }
  }
  return null;
}
