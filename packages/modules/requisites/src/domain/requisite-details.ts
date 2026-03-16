import { ValidationError } from "@bedrock/shared/core/errors";

import {
  invariant,
  normalizeOptionalText,
  ValueObject,
} from "@bedrock/shared/core/domain";

import { normalizeCountryCode } from "./country-code";
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

export interface RequisiteDetailsFields {
  kind: RequisiteKind;
  description: string | null;
  beneficiaryName: string | null;
  institutionName: string | null;
  institutionCountry: string | null;
  accountNo: string | null;
  corrAccount: string | null;
  iban: string | null;
  bic: string | null;
  swift: string | null;
  bankAddress: string | null;
  network: string | null;
  assetCode: string | null;
  address: string | null;
  memoTag: string | null;
  accountRef: string | null;
  subaccountRef: string | null;
  contact: string | null;
  notes: string | null;
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

export function validateRequisiteFields(input: RequisiteFieldsInput) {
  const issues = collectRequisiteFieldIssues(input);

  invariant(
    issues.length === 0,
    "requisite.fields.invalid",
    issues.join("; "),
  );
}

function normalizeRequisiteDetails(
  input: RequisiteFieldsInput & { description?: string | null },
): RequisiteDetailsFields {
  const normalized: RequisiteDetailsFields = {
    kind: input.kind,
    description: normalizeOptionalText(input.description),
    beneficiaryName: normalizeOptionalText(input.beneficiaryName),
    institutionName: normalizeOptionalText(input.institutionName),
    institutionCountry: normalizeOptionalText(input.institutionCountry),
    accountNo: normalizeOptionalText(input.accountNo),
    corrAccount: normalizeOptionalText(input.corrAccount),
    iban: normalizeOptionalText(input.iban),
    bic: normalizeOptionalText(input.bic),
    swift: normalizeOptionalText(input.swift),
    bankAddress: normalizeOptionalText(input.bankAddress),
    network: normalizeOptionalText(input.network),
    assetCode: normalizeOptionalText(input.assetCode),
    address: normalizeOptionalText(input.address),
    memoTag: normalizeOptionalText(input.memoTag),
    accountRef: normalizeOptionalText(input.accountRef),
    subaccountRef: normalizeOptionalText(input.subaccountRef),
    contact: normalizeOptionalText(input.contact),
    notes: normalizeOptionalText(input.notes),
  };

  if (normalized.institutionCountry !== null) {
    normalized.institutionCountry = normalizeCountryCode(
      normalized.institutionCountry,
    );
  }

  try {
    validateRequisiteFields(normalized);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    throw error;
  }

  return normalized;
}

export class RequisiteDetails extends ValueObject<RequisiteDetailsFields> {
  private constructor(fields: RequisiteDetailsFields) {
    super(fields);
  }

  static create(
    input: RequisiteFieldsInput & { description?: string | null },
  ): RequisiteDetails {
    return new RequisiteDetails(normalizeRequisiteDetails(input));
  }

  toFields(): RequisiteDetailsFields {
    return { ...this.props };
  }
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

export function buildRequisiteDisplayLabel(
  input: {
    label: string;
    currencyCode?: string | null;
  } & RequisiteFieldsInput,
) {
  const identity = resolveRequisiteIdentity(input);
  const parts = [input.label.trim()];

  if (identity.length > 0) {
    parts.push(identity);
  }

  if (input.currencyCode && input.currencyCode.trim().length > 0) {
    parts.push(input.currencyCode.trim().toUpperCase());
  }

  return parts.join(" · ");
}
