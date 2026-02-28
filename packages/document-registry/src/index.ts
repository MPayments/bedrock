import {
  createFeePayoutInitiateDocumentModule,
  createFeePayoutSettleDocumentModule,
  createFeePayoutVoidDocumentModule,
  createFxExecuteDocumentModule,
  createPaymentCaseDocumentModule,
  createPayinFundingDocumentModule,
  createPayoutInitiateDocumentModule,
  createPayoutSettleDocumentModule,
  createPayoutVoidDocumentModule,
} from "@bedrock/doc-payments";
import {
  createTransferDocumentModule,
  createTransferSettleDocumentModule,
  createTransferVoidDocumentModule,
} from "@bedrock/doc-transfers";
import { createExternalFundingDocumentModule } from "@bedrock/doc-treasury";
import type { DocumentModule, DocumentRegistry } from "@bedrock/documents";

export interface DocumentRegistryDeps {
  currenciesService: {
    findById: (id: string) => Promise<{ code: string }>;
    findByCode: (code: string) => Promise<{ id: string; code: string }>;
  };
  feesService: {
    getComponentDefaults: (kind: string) => {
      bucket: string;
      transferCode: number;
      memo: string;
    };
    getQuoteFeeComponents: (
      input: { quoteId: string },
      tx?: unknown,
    ) => Promise<
      {
        id: string;
        kind: string;
        currency: string;
        amountMinor: bigint;
        source: "rule" | "manual";
        settlementMode?: "in_ledger" | "separate_payment_order";
        accountingTreatment?: "income" | "pass_through" | "expense";
        memo?: string;
        metadata?: Record<string, string>;
      }[]
    >;
    mergeFeeComponents: (input: {
      computed?: {
        id: string;
        kind: string;
        currency: string;
        amountMinor: bigint;
        source: "rule" | "manual";
        settlementMode?: "in_ledger" | "separate_payment_order";
        accountingTreatment?: "income" | "pass_through" | "expense";
        memo?: string;
        metadata?: Record<string, string>;
      }[];
      manual?: {
        id: string;
        kind: string;
        currency: string;
        amountMinor: bigint;
        source: "rule" | "manual";
        settlementMode?: "in_ledger" | "separate_payment_order";
        accountingTreatment?: "income" | "pass_through" | "expense";
        memo?: string;
        metadata?: Record<string, string>;
      }[];
      aggregate?: boolean;
    }) => {
      id: string;
      kind: string;
      currency: string;
      amountMinor: bigint;
      source: "rule" | "manual";
      settlementMode?: "in_ledger" | "separate_payment_order";
      accountingTreatment?: "income" | "pass_through" | "expense";
      memo?: string;
      metadata?: Record<string, string>;
    }[];
    mergeAdjustmentComponents: (input: {
      manual?: {
        id: string;
        kind: string;
        effect: "increase_charge" | "decrease_charge";
        currency: string;
        amountMinor: bigint;
        source: "manual" | "rule";
        settlementMode?: "in_ledger" | "separate_payment_order";
        memo?: string;
        metadata?: Record<string, string>;
      }[];
      aggregate?: boolean;
    }) => {
      id: string;
      kind: string;
      effect: "increase_charge" | "decrease_charge";
      currency: string;
      amountMinor: bigint;
      source: "manual" | "rule";
      settlementMode?: "in_ledger" | "separate_payment_order";
      memo?: string;
      metadata?: Record<string, string>;
    }[];
    partitionAdjustmentComponents: (
      components: {
        id: string;
        kind: string;
        effect: "increase_charge" | "decrease_charge";
        currency: string;
        amountMinor: bigint;
        source: "manual" | "rule";
        settlementMode?: "in_ledger" | "separate_payment_order";
        memo?: string;
        metadata?: Record<string, string>;
      }[],
    ) => {
      inLedger: {
        id: string;
        kind: string;
        effect: "increase_charge" | "decrease_charge";
        currency: string;
        amountMinor: bigint;
        source: "manual" | "rule";
        settlementMode?: "in_ledger" | "separate_payment_order";
        memo?: string;
        metadata?: Record<string, string>;
      }[];
      separatePaymentOrder: {
        id: string;
        kind: string;
        effect: "increase_charge" | "decrease_charge";
        currency: string;
        amountMinor: bigint;
        source: "manual" | "rule";
        settlementMode?: "in_ledger" | "separate_payment_order";
        memo?: string;
        metadata?: Record<string, string>;
      }[];
    };
  };
  operationalAccountsService: {
    resolveTransferBindings: (input: { accountIds: string[] }) => Promise<
      {
        accountId: string;
        counterpartyId: string;
        currencyId: string;
        currencyCode: string;
        stableKey: string;
      }[]
    >;
  };
}

export function createDocumentRegistry(
  deps: DocumentRegistryDeps,
): DocumentRegistry {
  const modules: DocumentModule[] = [
    createPaymentCaseDocumentModule(),
    createPayinFundingDocumentModule({
      currenciesService: deps.currenciesService,
    }),
    createFxExecuteDocumentModule({
      currenciesService: deps.currenciesService,
      feesService: deps.feesService,
    }),
    createPayoutInitiateDocumentModule({
      currenciesService: deps.currenciesService,
    }),
    createPayoutSettleDocumentModule(),
    createPayoutVoidDocumentModule(),
    createFeePayoutInitiateDocumentModule({
      currenciesService: deps.currenciesService,
      feesService: deps.feesService,
    }),
    createFeePayoutSettleDocumentModule(),
    createFeePayoutVoidDocumentModule(),
    createExternalFundingDocumentModule({
      currenciesService: deps.currenciesService,
    }),
    createTransferDocumentModule({
      operationalAccountsService: deps.operationalAccountsService,
    }),
    createTransferSettleDocumentModule(),
    createTransferVoidDocumentModule(),
  ];

  const byType = new Map(modules.map((module) => [module.docType, module]));

  return {
    getDocumentModules() {
      return modules;
    },
    getDocumentModule(docType: string) {
      const module = byType.get(docType);
      if (!module) {
        throw new Error(`Unknown document module: ${docType}`);
      }

      return module;
    },
  };
}

export type { DocumentRegistry, DocumentModule };
