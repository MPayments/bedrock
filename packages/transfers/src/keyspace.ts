import { defineKeyspace } from "@bedrock/ledger";

export const transfersKeyspace = defineKeyspace("tr", {
    customerWallet: (customerId: string, currency: string) => `CustomerWallet:${customerId}:${currency}`,
    internal: (counterpartyId: string, name: string, currency: string) => `Internal:${counterpartyId}:${name}:${currency}`
});
