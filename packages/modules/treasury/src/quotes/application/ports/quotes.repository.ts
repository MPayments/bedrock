import type { FinancialLine } from "@bedrock/documents/contracts";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type { FeeComponent } from "../../../fees/application/contracts";
import type { QuoteLegSnapshot } from "../../domain/quote-leg";
import type {
  QuoteLegSourceKind,
  QuotePricingMode,
  QuoteStatus,
} from "../../domain/quote-types";

export type {
  QuoteLegSourceKind,
  QuotePricingMode,
  QuoteStatus,
};
export type { QuoteLegSnapshot } from "../../domain/quote-leg";

export interface QuoteRecord {
  id: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  pricingMode: QuotePricingMode;
  pricingTrace: Record<string, unknown> | null;
  commercialTerms: QuoteCommercialTermsRecord | null;
  dealDirection: string | null;
  dealForm: string | null;
  rateNum: bigint;
  rateDen: bigint;
  status: QuoteStatus;
  dealId: string | null;
  usedByRef: string | null;
  usedDocumentId: string | null;
  usedAt: Date | null;
  expiresAt: Date;
  idempotencyKey: string;
  pricingFingerprint: string | null;
  createdAt: Date;
  fromCurrency?: string;
  toCurrency?: string;
}

export interface QuoteLegRecord {
  id: string;
  quoteId: string;
  idx: number;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: QuoteLegSourceKind;
  sourceRef: string | null;
  asOf: Date;
  executionCounterpartyId: string | null;
  createdAt: Date;
  fromCurrency?: string;
  toCurrency?: string;
}

export interface QuoteDetailsRecord {
  quote: QuoteRecord;
  legs: QuoteLegRecord[];
  feeComponents: FeeComponent[];
  financialLines: FinancialLine[];
  pricingTrace: Record<string, unknown>;
}

export interface QuotePreviewRecord {
  fromCurrency: string;
  toCurrency: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  pricingMode: QuotePricingMode;
  pricingTrace: Record<string, unknown>;
  commercialTerms: QuoteCommercialTermsRecord | null;
  dealDirection: string | null;
  dealForm: string | null;
  rateNum: bigint;
  rateDen: bigint;
  expiresAt: Date;
  legs: QuoteLegSnapshot[];
  feeComponents: FeeComponent[];
  financialLines: FinancialLine[];
}

export interface QuoteWriteModel {
  id: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  pricingMode: QuotePricingMode;
  pricingTrace: Record<string, unknown> | null;
  commercialTerms: QuoteCommercialTermsRecord | null;
  dealDirection: string | null;
  dealForm: string | null;
  rateNum: bigint;
  rateDen: bigint;
  expiresAt: Date;
  status: QuoteStatus;
  dealId: string | null;
  idempotencyKey: string;
  pricingFingerprint: string | null;
  createdAt: Date;
}

export interface QuoteLegWriteModel {
  quoteId: string;
  idx: number;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: QuoteLegSourceKind;
  sourceRef: string | null;
  asOf: Date;
  executionCounterpartyId: string | null;
}

export interface QuoteCommercialTermsRecord {
  agreementVersionId: string | null;
  agreementFeeBps: bigint;
  quoteMarkupBps: bigint;
  totalFeeBps: bigint;
  fixedFeeAmountMinor: bigint | null;
  fixedFeeCurrency: string | null;
}

export interface QuotesListQuery {
  dealId?: string;
  limit: number;
  offset: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  idempotencyKey?: string;
  status?: string[];
  pricingMode?: string[];
}

export interface MarkQuoteUsedInput {
  dealId?: string | null;
  quoteId: string;
  usedByRef: string;
  usedDocumentId?: string | null;
  at: Date;
}

export interface QuotesRepository {
  insertQuote(
    input: QuoteWriteModel,
    tx?: PersistenceSession,
  ): Promise<QuoteRecord | null>;
  insertQuoteLegs(
    input: QuoteLegWriteModel[],
    tx?: PersistenceSession,
  ): Promise<void>;
  listQuotes(input: QuotesListQuery): Promise<{ rows: QuoteRecord[]; total: number }>;
  findQuoteById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<QuoteRecord | undefined>;
  findQuoteByIdempotencyKey(
    idempotencyKey: string,
    tx?: PersistenceSession,
  ): Promise<QuoteRecord | undefined>;
  listQuoteLegs(
    quoteId: string,
    tx?: PersistenceSession,
  ): Promise<QuoteLegRecord[]>;
  markQuoteUsedIfActive(input: MarkQuoteUsedInput): Promise<QuoteRecord | undefined>;
  expireOldQuotes(now: Date): Promise<QuoteRecord[]>;
}
