import type { DocumentModule } from "@bedrock/core/documents";

export interface CounterpartyAccountBinding {
  accountId: string;
  bookId: string;
  counterpartyId: string;
  currencyCode: string;
  stableKey: string;
}

export interface CounterpartyAccountsService {
  resolveTransferBindings(input: {
    accountIds: string[];
  }): Promise<CounterpartyAccountBinding[]>;
}

export interface IfrsModuleDeps {
  counterpartyAccountsService: CounterpartyAccountsService;
}

export type IfrsDocumentDb = Parameters<DocumentModule["canPost"]>[0]["db"];
