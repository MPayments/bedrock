import type { Client } from "@bedrock/api-client";

type ClientWithAccounting = Client & {
  v1: Client["v1"] & {
    accounting: any;
  };
};

export function getAccountingApi(client: Client) {
  return (client as ClientWithAccounting).v1.accounting;
}
