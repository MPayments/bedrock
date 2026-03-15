export interface RequisiteProviderRulesInput {
  kind: string;
  country?: string | null;
  bic?: string | null;
  swift?: string | null;
}

export function collectRequisiteProviderIssues(
  input: RequisiteProviderRulesInput,
): string[] {
  const issues: string[] = [];

  if (
    input.kind === "bank" ||
    input.kind === "exchange" ||
    input.kind === "custodian"
  ) {
    if (!input.country) {
      issues.push(`country is required for ${input.kind} providers`);
    }
  }

  if (input.kind === "bank") {
    if (input.country === "RU") {
      if (!input.bic) {
        issues.push("bic is required for Russian banks");
      }
    } else if (input.country && !input.swift) {
      issues.push("swift is required for non-Russian banks");
    }
  } else {
    if (input.bic) {
      issues.push("bic is only allowed for bank providers");
    }
    if (input.swift && input.kind === "blockchain") {
      issues.push("swift is not applicable for blockchain providers");
    }
  }

  return issues;
}
