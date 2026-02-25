import { defineKeyspace } from "@bedrock/ledger";

export const transfersKeyspace = defineKeyspace("tr2", {
  account: (counterpartyId: string, stableKey: string, currency: string) =>
    `Account:${counterpartyId}:${stableKey}:${currency}`,
});
