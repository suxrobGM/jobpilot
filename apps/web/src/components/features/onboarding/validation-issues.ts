// Only the Personal step edits profile fields; issues on the rest (all optional) get no step.
const PERSONAL_FIELDS = new Set([
  "firstName",
  "lastName",
  "contactEmail",
  "phone",
  "website",
  "linkedin",
  "github",
]);

export interface ValidationIssue {
  field: string;
  path: string;
  message: string;
  stepIndex: number | null;
}

interface SchemaIssue {
  path: PropertyKey[];
  message: string;
}

export function describeIssues(
  issues: readonly SchemaIssue[],
  personalStepIndex: number,
): ValidationIssue[] {
  return issues.map((issue) => {
    const field = String(issue.path[0] ?? "");
    return {
      field,
      path: issue.path.map(String).join(".") || "form",
      message: issue.message,
      stepIndex: PERSONAL_FIELDS.has(field) ? personalStepIndex : null,
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
