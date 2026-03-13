import type { Client } from "@bedrock/api-client";

import type { HttpResponseLike } from "@/lib/api/response";

type ReportQuery = Record<string, string | string[]>;
type ClientRequest<Input> = (
  input: Input,
  options?: unknown,
) => Promise<HttpResponseLike>;

type ReplaceCorrespondenceRulesInput = {
  json: {
    rules: Array<{
      postingCode: string;
      debitAccountNo: string;
      creditAccountNo: string;
      enabled: boolean;
    }>;
  };
};

// The API accounting sub-router is intentionally typed as `any` today because
// its composed helper routes erase the accumulated Hono schema. Keep a narrow
// handwritten client surface here until the API side preserves accounting route
// typing end-to-end.
export type AccountingApi = {
  template?: {
    accounts?: {
      $get: ClientRequest<Record<string, never>>;
    };
  };
  ["correspondence-rules"]?: {
    $get: ClientRequest<Record<string, never>>;
    $put: ClientRequest<ReplaceCorrespondenceRulesInput>;
  };
  reports?: {
    ["trial-balance"]?: { $get: ClientRequest<{ query: ReportQuery }> };
    ["general-ledger"]?: { $get: ClientRequest<{ query: ReportQuery }> };
    ["balance-sheet"]?: { $get: ClientRequest<{ query: ReportQuery }> };
    ["income-statement"]?: { $get: ClientRequest<{ query: ReportQuery }> };
    ["cash-flow"]?: { $get: ClientRequest<{ query: ReportQuery }> };
    liquidity?: { $get: ClientRequest<{ query: ReportQuery }> };
    ["fx-revaluation"]?: { $get: ClientRequest<{ query: ReportQuery }> };
    ["fee-revenue"]?: { $get: ClientRequest<{ query: ReportQuery }> };
    ["close-package"]?: { $get: ClientRequest<{ query: ReportQuery }> };
  };
};

type ClientWithAccounting = Client & {
  v1: Client["v1"] & {
    accounting: AccountingApi;
  };
};

export function getAccountingApi(client: Client): AccountingApi {
  return (client as ClientWithAccounting).v1.accounting;
}
