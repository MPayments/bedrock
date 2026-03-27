import type { TreasuryAccountListItem } from "./queries";

function readMetadataText(
  metadata: TreasuryAccountListItem["metadata"],
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function getTreasuryAccountDisplayLabel(
  account: TreasuryAccountListItem,
) {
  return (
    readMetadataText(account.metadata, "label") ??
    readMetadataText(account.metadata, "iban") ??
    readMetadataText(account.metadata, "accountNo") ??
    readMetadataText(account.metadata, "address") ??
    readMetadataText(account.metadata, "accountRef") ??
    readMetadataText(account.metadata, "subaccountRef") ??
    account.accountReference
  );
}

export function getTreasuryAccountProviderLabel(input: {
  account: TreasuryAccountListItem;
  providerLabels: Record<string, string>;
}) {
  if (input.account.provider) {
    return (
      input.providerLabels[input.account.provider] ??
      readMetadataText(input.account.metadata, "institutionName") ??
      input.account.provider
    );
  }

  return readMetadataText(input.account.metadata, "institutionName") ?? "—";
}
