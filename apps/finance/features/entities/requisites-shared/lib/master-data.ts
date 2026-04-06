import type { RequisiteFormValues, RequisiteKind } from "./constants";

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

  const push = (
    scheme: string,
    value: string,
    isPrimary = false,
  ) => {
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
  paymentPurposeTemplate: string | null;
  notes: string | null;
  identifiers: RequisiteIdentifier[];
}) {
  return {
    description: input.paymentPurposeTemplate ?? "",
    beneficiaryName: input.beneficiaryName ?? "",
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
