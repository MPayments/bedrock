import type { z } from "zod";

import type { LedgerOperationDetails } from "@bedrock/ledger/contracts";

import type {
  financialLineBucketSchema,
  financialLineSettlementModeSchema,
  financialLineSourceSchema} from "./zod";
import {
  FINANCIAL_LINE_BUCKETS,
  financialLineSchema
} from "./zod";
import type { DocumentAction } from "../../../lifecycle/domain/document-workflow";
import type {
  DocumentEvent,
  DocumentLink,
  DocumentOperation,
  DocumentSnapshot,
  DocumentPostingSnapshot,
} from "../../domain/document";

export const FINANCIAL_LINE_BUCKET_OPTIONS = [
  { value: "fee_revenue", label: "Комиссионный доход" },
  { value: "spread_revenue", label: "Спред" },
  { value: "provider_fee_expense", label: "Расход провайдера" },
  { value: "pass_through", label: "Транзитная комиссия" },
  { value: "adjustment", label: "Корректировка" },
] as const;

export type FinancialLineBucket = z.infer<typeof financialLineBucketSchema>;
export type FinancialLineSource = z.infer<typeof financialLineSourceSchema>;
export type FinancialLineSettlementMode = z.infer<
  typeof financialLineSettlementModeSchema
>;
export type FinancialLine = z.infer<typeof financialLineSchema>;

function resolveSettlementMode(
  input: Pick<FinancialLine, "bucket" | "settlementMode">,
): FinancialLineSettlementMode {
  if (input.settlementMode) {
    return input.settlementMode;
  }

  return input.bucket === "pass_through"
    ? "separate_payment_order"
    : "in_ledger";
}

export function normalizeFinancialLine(input: FinancialLine): FinancialLine {
  const validated = financialLineSchema.parse(input);

  return {
    ...validated,
    settlementMode: resolveSettlementMode(validated),
  };
}

function financialLineAggregateKey(line: FinancialLine): string {
  return [
    line.bucket,
    line.currency,
    line.source,
    line.settlementMode ?? "in_ledger",
    line.memo ?? "",
  ].join("|");
}

export function aggregateFinancialLines(
  lines: FinancialLine[],
): FinancialLine[] {
  const grouped = new Map<string, FinancialLine>();

  for (const raw of lines) {
    const line = normalizeFinancialLine(raw);
    const key = financialLineAggregateKey(line);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, line);
      continue;
    }

    const amountMinor = existing.amountMinor + line.amountMinor;
    if (amountMinor === 0n) {
      grouped.delete(key);
      continue;
    }

    grouped.set(key, {
      ...existing,
      amountMinor,
    });
  }

  return [...grouped.values()];
}

export interface DocumentWithOperationId {
  document: DocumentSnapshot;
  postingOperationId: string | null;
  allowedActions: DocumentAction[];
}

export interface DocumentDetails {
  document: DocumentSnapshot;
  postingOperationId: string | null;
  allowedActions: DocumentAction[];
  links: DocumentLink[];
  events: DocumentEvent[];
  snapshot: DocumentPostingSnapshot | null;
  parent: DocumentSnapshot | null;
  children: DocumentSnapshot[];
  dependsOn: DocumentSnapshot[];
  compensates: DocumentSnapshot[];
  documentOperations: DocumentOperation[];
  ledgerOperations: (LedgerOperationDetails | null)[];
  computed?: unknown;
  extra?: unknown;
}

export { FINANCIAL_LINE_BUCKETS };
