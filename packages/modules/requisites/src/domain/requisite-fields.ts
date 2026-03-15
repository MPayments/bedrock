import type { RequisiteKind } from "./requisite-kind";

export interface RequisiteFieldsInput {
  kind: RequisiteKind;
  beneficiaryName?: string | null;
  institutionName?: string | null;
  institutionCountry?: string | null;
  accountNo?: string | null;
  corrAccount?: string | null;
  iban?: string | null;
  bic?: string | null;
  swift?: string | null;
  bankAddress?: string | null;
  network?: string | null;
  assetCode?: string | null;
  address?: string | null;
  memoTag?: string | null;
  accountRef?: string | null;
  subaccountRef?: string | null;
  contact?: string | null;
  notes?: string | null;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function collectRequisiteFieldIssues(
  input: RequisiteFieldsInput,
): string[] {
  const issues: string[] = [];

  switch (input.kind) {
    case "bank":
      if (!hasText(input.beneficiaryName)) {
        issues.push("beneficiaryName is required for bank requisites");
      }
      if (!hasText(input.institutionName)) {
        issues.push("institutionName is required for bank requisites");
      }
      if (!hasText(input.institutionCountry)) {
        issues.push("institutionCountry is required for bank requisites");
      }
      if (!hasText(input.accountNo)) {
        issues.push("accountNo is required for bank requisites");
      }
      break;
    case "blockchain":
      if (!hasText(input.network)) {
        issues.push("network is required for blockchain requisites");
      }
      if (!hasText(input.assetCode)) {
        issues.push("assetCode is required for blockchain requisites");
      }
      if (!hasText(input.address)) {
        issues.push("address is required for blockchain requisites");
      }
      break;
    case "exchange":
    case "custodian":
      if (!hasText(input.institutionName)) {
        issues.push(`institutionName is required for ${input.kind} requisites`);
      }
      if (!hasText(input.institutionCountry)) {
        issues.push(
          `institutionCountry is required for ${input.kind} requisites`,
        );
      }
      if (!hasText(input.accountRef)) {
        issues.push(`accountRef is required for ${input.kind} requisites`);
      }
      break;
  }

  return issues;
}

export function resolveRequisiteIdentity(input: RequisiteFieldsInput): string {
  switch (input.kind) {
    case "bank":
      return (
        input.accountNo?.trim() ||
        input.iban?.trim() ||
        input.swift?.trim() ||
        input.bic?.trim() ||
        ""
      );
    case "blockchain":
      return input.address?.trim() || "";
    case "exchange":
    case "custodian":
      return (
        input.accountRef?.trim() ||
        input.subaccountRef?.trim() ||
        input.institutionName?.trim() ||
        ""
      );
  }
}
