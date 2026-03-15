import type { FinancialLine } from "@bedrock/documents/contracts";

import type { FeeComponent } from "@bedrock/fees/contracts";

import type { FxDbExecutor } from "../shared/external-ports";
export type { FxDbExecutor } from "../shared/external-ports";

export type FxQuoteStatus = "active" | "used" | "expired" | "cancelled";
export type FxQuotePricingMode = "auto_cross" | "explicit_route";
export type FxQuoteLegSourceKind =
  | "cb"
  | "bank"
  | "manual"
  | "derived"
  | "market";

export interface FxQuoteRecord {
  id: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  pricingMode: FxQuotePricingMode;
  pricingTrace: Record<string, unknown> | null;
  dealDirection: string | null;
  dealForm: string | null;
  rateNum: bigint;
  rateDen: bigint;
  status: FxQuoteStatus;
  usedByRef: string | null;
  usedAt: Date | null;
  expiresAt: Date;
  idempotencyKey: string;
  createdAt: Date;
  fromCurrency?: string;
  toCurrency?: string;
}

export interface FxQuoteLegRecord {
  id: string;
  quoteId: string;
  idx: number;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: FxQuoteLegSourceKind;
  sourceRef: string | null;
  asOf: Date;
  executionCounterpartyId: string | null;
  createdAt: Date;
  fromCurrency?: string;
  toCurrency?: string;
}

export interface FxQuoteDetailsRecord {
  quote: FxQuoteRecord;
  legs: FxQuoteLegRecord[];
  feeComponents: FeeComponent[];
  financialLines: FinancialLine[];
  pricingTrace: Record<string, unknown>;
}

export interface ComputedLeg {
  idx: number;
  fromCurrency: string;
  toCurrency: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: FxQuoteLegSourceKind;
  sourceRef: string | null;
  asOf: Date;
  executionCounterpartyId: string | null;
}

export interface FxQuoteWriteModel {
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  pricingMode: FxQuotePricingMode;
  pricingTrace: Record<string, unknown>;
  dealDirection: string | null;
  dealForm: string | null;
  rateNum: bigint;
  rateDen: bigint;
  expiresAt: Date;
  status: FxQuoteStatus;
  idempotencyKey: string;
}

export interface FxQuoteLegWriteModel {
  quoteId: string;
  idx: number;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: FxQuoteLegSourceKind;
  sourceRef: string | null;
  asOf: Date;
  executionCounterpartyId: string | null;
}

export interface FxQuoteFinancialLineWriteModel {
  quoteId: string;
  idx: number;
  bucket: FinancialLine["bucket"];
  currencyId: string;
  amountMinor: bigint;
  source: FinancialLine["source"];
  settlementMode: NonNullable<FinancialLine["settlementMode"]>;
  memo: string | null;
  metadata: Record<string, string> | null;
}

export interface FxQuotesRepository {
  insertQuote(
    input: FxQuoteWriteModel,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteRecord | null>;
  insertQuoteLegs(
    input: FxQuoteLegWriteModel[],
    executor?: FxDbExecutor,
  ): Promise<void>;
  listQuotes(input: {
    limit: number;
    offset: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
    idempotencyKey?: string;
    status?: string[];
    pricingMode?: string[];
  }): Promise<{ rows: FxQuoteRecord[]; total: number }>;
  findQuoteById(
    id: string,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteRecord | undefined>;
  findQuoteByIdempotencyKey(
    idempotencyKey: string,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteRecord | undefined>;
  listQuoteLegs(
    quoteId: string,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteLegRecord[]>;
  markQuoteUsedIfActive(input: {
    quoteId: string;
    usedByRef: string;
    at: Date;
  }): Promise<FxQuoteRecord | undefined>;
  expireOldQuotes(now: Date): Promise<void>;
}

export interface FxQuoteFinancialLinesRepository {
  replaceQuoteFinancialLines(
    input: {
      quoteId: string;
      financialLines: FxQuoteFinancialLineWriteModel[];
    },
    executor?: FxDbExecutor,
  ): Promise<void>;
  listQuoteFinancialLines(
    quoteId: string,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteFinancialLineWriteModel[]>;
}
