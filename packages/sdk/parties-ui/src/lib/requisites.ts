export const REQUISITE_KIND_OPTIONS = [
  { value: "bank", label: "Банк" },
  { value: "blockchain", label: "Блокчейн" },
  { value: "exchange", label: "Биржа" },
  { value: "custodian", label: "Кастодиан" },
] as const;

export type RequisiteKind = (typeof REQUISITE_KIND_OPTIONS)[number]["value"];

export const REQUISITE_OWNER_TYPE_OPTIONS = [
  { value: "organization", label: "Организация" },
  { value: "counterparty", label: "Контрагент" },
] as const;

export type RequisiteOwnerType =
  (typeof REQUISITE_OWNER_TYPE_OPTIONS)[number]["value"];

export const REQUISITE_KIND_FILTER_OPTIONS = REQUISITE_KIND_OPTIONS.map(
  (option) => ({
    value: option.value,
    label: option.label,
  }),
);

export const REQUISITE_OWNER_TYPE_FILTER_OPTIONS =
  REQUISITE_OWNER_TYPE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

export function getRequisiteKindLabel(kind: string): string {
  return (
    REQUISITE_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind
  );
}

export function getRequisiteOwnerTypeLabel(ownerType: string): string {
  return (
    REQUISITE_OWNER_TYPE_OPTIONS.find((option) => option.value === ownerType)
      ?.label ?? ownerType
  );
}

export type RelationOption = {
  id: string;
  label: string;
};

export type RequisiteFormValues = {
  ownerId: string;
  providerId: string;
  providerBranchId: string;
  currencyId: string;
  kind: RequisiteKind;
  label: string;
  description: string;
  beneficiaryName: string;
  beneficiaryNameLocal: string;
  beneficiaryAddress: string;
  accountNo: string;
  corrAccount: string;
  iban: string;
  network: string;
  assetCode: string;
  address: string;
  memoTag: string;
  accountRef: string;
  subaccountRef: string;
  contact: string;
  notes: string;
  isDefault: boolean;
};

export type RequisiteDetails = RequisiteFormValues & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type SerializedRequisite = {
  id: string;
  ownerType: RequisiteOwnerType;
  ownerId: string;
  ownerDisplay: string;
  providerId: string;
  providerDisplay: string;
  currencyId: string;
  currencyDisplay: string;
  kind: RequisiteKind;
  kindDisplay: string;
  label: string;
  identity: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_IDENTITY_FIELDS: Pick<
  RequisiteFormValues,
  | "accountNo"
  | "iban"
  | "address"
  | "accountRef"
  | "subaccountRef"
> = {
  accountNo: "",
  iban: "",
  address: "",
  accountRef: "",
  subaccountRef: "",
};

export function resolveRequisiteIdentity(
  input: Pick<RequisiteFormValues, "kind"> &
    Partial<typeof DEFAULT_IDENTITY_FIELDS>,
): string {
  const normalized = { ...DEFAULT_IDENTITY_FIELDS, ...input };

  switch (input.kind) {
    case "bank":
      return normalized.accountNo.trim() || normalized.iban.trim();
    case "blockchain":
      return normalized.address.trim();
    case "exchange":
    case "custodian":
      return normalized.accountRef.trim() || normalized.subaccountRef.trim();
  }
}

type RequisiteIdentifier = {
  scheme: string;
  value: string;
  isPrimary?: boolean;
};

function pickPrimary<T extends { isPrimary?: boolean }>(items: T[]): T | null {
  return items.find((item) => item.isPrimary) ?? items[0] ?? null;
}

export function findRequisiteIdentifier(
  identifiers: RequisiteIdentifier[],
  scheme: string,
): string {
  return (
    pickPrimary(
      identifiers.filter((identifier) => identifier.scheme === scheme),
    )?.value ?? ""
  );
}

export function buildRequisiteIdentifiers(values: RequisiteFormValues) {
  const identifiers: Array<{
    scheme: string;
    value: string;
    isPrimary: boolean;
  }> = [];

  const push = (scheme: string, value: string, isPrimary = false) => {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }

    identifiers.push({ scheme, value: normalized, isPrimary });
  };

  switch (values.kind) {
    case "bank":
      push("local_account_number", values.accountNo, !values.iban.trim());
      push("corr_account", values.corrAccount);
      push("iban", values.iban, !values.accountNo.trim());
      break;
    case "blockchain":
      push("network", values.network);
      push("asset_code", values.assetCode);
      push("wallet_address", values.address, true);
      push("memo_tag", values.memoTag);
      break;
    case "exchange":
    case "custodian":
      push("account_ref", values.accountRef, !values.subaccountRef.trim());
      push("subaccount_ref", values.subaccountRef, !values.accountRef.trim());
      break;
  }

  push("contact", values.contact);

  if (!identifiers.some((identifier) => identifier.isPrimary) && identifiers[0]) {
    identifiers[0] = { ...identifiers[0], isPrimary: true };
  }

  return identifiers;
}

export function toLegacyRequisiteValues(input: {
  kind: RequisiteKind;
  beneficiaryName: string | null;
  beneficiaryNameLocal?: string | null;
  beneficiaryAddress?: string | null;
  paymentPurposeTemplate: string | null;
  notes: string | null;
  identifiers: RequisiteIdentifier[];
}) {
  return {
    description: input.paymentPurposeTemplate ?? "",
    beneficiaryName: input.beneficiaryName ?? "",
    beneficiaryNameLocal: input.beneficiaryNameLocal ?? "",
    beneficiaryAddress: input.beneficiaryAddress ?? "",
    accountNo: findRequisiteIdentifier(input.identifiers, "local_account_number"),
    corrAccount: findRequisiteIdentifier(input.identifiers, "corr_account"),
    iban: findRequisiteIdentifier(input.identifiers, "iban"),
    network: findRequisiteIdentifier(input.identifiers, "network"),
    assetCode: findRequisiteIdentifier(input.identifiers, "asset_code"),
    address: findRequisiteIdentifier(input.identifiers, "wallet_address"),
    memoTag: findRequisiteIdentifier(input.identifiers, "memo_tag"),
    accountRef: findRequisiteIdentifier(input.identifiers, "account_ref"),
    subaccountRef: findRequisiteIdentifier(input.identifiers, "subaccount_ref"),
    contact: findRequisiteIdentifier(input.identifiers, "contact"),
    notes: input.notes ?? "",
  };
}

export function resolveLegacyRequisiteIdentity(input: {
  kind: RequisiteKind;
  label: string;
  beneficiaryName?: string | null;
  identifiers?: RequisiteIdentifier[];
}) {
  if (!input.identifiers?.length) {
    return input.beneficiaryName?.trim() || input.label;
  }

  switch (input.kind) {
    case "bank":
      return (
        findRequisiteIdentifier(input.identifiers, "local_account_number") ||
        findRequisiteIdentifier(input.identifiers, "iban") ||
        input.beneficiaryName?.trim() ||
        input.label
      );
    case "blockchain":
      return (
        findRequisiteIdentifier(input.identifiers, "wallet_address") ||
        input.label
      );
    case "exchange":
    case "custodian":
      return (
        findRequisiteIdentifier(input.identifiers, "account_ref") ||
        findRequisiteIdentifier(input.identifiers, "subaccount_ref") ||
        input.label
      );
  }
}
