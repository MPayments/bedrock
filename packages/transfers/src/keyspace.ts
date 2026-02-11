import { defineKeyspace } from "@bedrock/ledger";

export const transfersKeyspace = defineKeyspace("tr", {
    customerWallet: (customerId: string, currency: string) => `CustomerWallet:${customerId}:${currency}`,
    internal: (orgId: string, name: string, currency: string) => `Internal:${orgId}:${name}:${currency}`
});
