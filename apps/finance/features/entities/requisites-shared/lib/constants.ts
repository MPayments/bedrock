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
  currencyId: string;
  kind: RequisiteKind;
  label: string;
  description: string;
  beneficiaryName: string;
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
