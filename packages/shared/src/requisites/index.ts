import { z } from "zod";

import { invariant, normalizeOptionalText, ValueObject } from "../core/domain";
import { ValidationError } from "../core/errors";
import { COUNTRY_ALPHA2_SET } from "../reference-data/countries";

export const REQUISITE_KIND_VALUES = [
  "bank",
  "exchange",
  "blockchain",
  "custodian",
] as const;

export type RequisiteKind = (typeof REQUISITE_KIND_VALUES)[number];

export const REQUISITE_OWNER_TYPE_VALUES = [
  "organization",
  "counterparty",
] as const;

export type RequisiteOwnerType = (typeof REQUISITE_OWNER_TYPE_VALUES)[number];

export const RequisiteKindSchema = z.enum(REQUISITE_KIND_VALUES);
export const RequisiteOwnerTypeSchema = z.enum(REQUISITE_OWNER_TYPE_VALUES);

export type CountryCode = string;

export class CountryCodeValue extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static normalize(value: string): string {
    return value.trim().toUpperCase();
  }

  static is(value: string): boolean {
    return COUNTRY_ALPHA2_SET.has(CountryCodeValue.normalize(value));
  }

  static create(value: string): CountryCodeValue {
    const normalized = CountryCodeValue.normalize(value);

    invariant(
      COUNTRY_ALPHA2_SET.has(normalized),
      `country must be a valid ISO 3166-1 alpha-2 code: ${value}`,
      {
        code: "country.invalid",
        meta: { value },
      },
    );

    return new CountryCodeValue(normalized);
  }

  static createOptional(
    value: string | null | undefined,
  ): CountryCodeValue | null {
    if (value == null) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? CountryCodeValue.create(normalized) : null;
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}

export function normalizeCountryCode(value: string): string {
  return CountryCodeValue.normalize(value);
}

export function isCountryCode(value: string): boolean {
  return CountryCodeValue.is(value);
}

export function parseCountryCode(value: string): CountryCode {
  return CountryCodeValue.create(value).value;
}

export function normalizeOptionalCountryCode(
  value: string | null | undefined,
): string | null {
  return CountryCodeValue.createOptional(value)?.value ?? null;
}

export function parseOptionalCountryCode(
  value: string | null | undefined,
): CountryCode | null {
  return CountryCodeValue.createOptional(value)?.value ?? null;
}

export const CountryCodeSchema = z
  .string()
  .trim()
  .transform((value) => CountryCodeValue.normalize(value))
  .refine(
    (value) => CountryCodeValue.is(value),
    "country must be a valid ISO 3166-1 alpha-2 code",
  );

export interface RequisiteFieldsInput {
  kind: RequisiteKind;
  beneficiaryName?: string | null;
  institutionName?: string | null;
  accountNo?: string | null;
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
  accountNo: string | null;
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

function normalizeRequisiteDetails(
  input: RequisiteFieldsInput & { description?: string | null },
): RequisiteDetailsFields {
  const normalized: RequisiteDetailsFields = {
    kind: input.kind,
    description: normalizeOptionalText(input.description),
    beneficiaryName: normalizeOptionalText(input.beneficiaryName),
    institutionName: normalizeOptionalText(input.institutionName),
    accountNo: normalizeOptionalText(input.accountNo),
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

  validateRequisiteFields(normalized);

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

  resolveIdentity(): string {
    return resolveRequisiteIdentity(this.props);
  }

  buildOptionLabel(input: {
    label: string;
    currencyCode?: string | null;
  }): string {
    return buildRequisiteOptionLabel({
      ...input,
      ...this.props,
    });
  }
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

export function buildRequisiteOptionLabel(
  input: {
    label: string;
    currencyCode?: string | null;
  } & RequisiteFieldsInput,
): string {
  const identity = resolveRequisiteIdentity(input);
  const parts = [input.label.trim()];

  if (identity) {
    parts.push(identity);
  }

  if (input.currencyCode && input.currencyCode.trim().length > 0) {
    parts.push(input.currencyCode.trim().toUpperCase());
  }

  return parts.join(" · ");
}

export function resolveCreateRequisiteDefaultFlag(input: {
  requestedIsDefault?: boolean;
  existingActiveCount: number;
}): boolean {
  return input.requestedIsDefault === true || input.existingActiveCount === 0;
}

export function shouldPromoteNextDefault(input: {
  wasDefault: boolean;
  nextIsDefault: boolean;
  currencyChanged: boolean;
}): boolean {
  return (
    input.wasDefault &&
    (input.nextIsDefault === false || input.currencyChanged === true)
  );
}

export function validateRequisiteFields(input: RequisiteFieldsInput) {
  const issues = collectRequisiteFieldIssues(input);

  if (issues.length > 0) {
    throw new ValidationError(issues.join("; "));
  }
}

export function buildRequisiteDisplayLabel(
  input: {
    label: string;
    currencyCode?: string | null;
  } & RequisiteFieldsInput,
) {
  return buildRequisiteOptionLabel(input);
}
