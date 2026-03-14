import { eq } from "drizzle-orm";

import {
  aggregateFinancialLines,
  normalizeFinancialLine,
  type FinancialLine,
  type FinancialLineBucket,
} from "@bedrock/documents/financial-lines";
import type { FeeComponent } from "@bedrock/fees";
import { schema } from "@bedrock/fx/schema";
import type { Transaction } from "@bedrock/platform/persistence";

import type { FxServiceContext } from "./context";

function resolveBucket(component: Pick<FeeComponent, "accountingTreatment" | "kind">): FinancialLineBucket {
  if (component.accountingTreatment === "expense") {
    return "provider_fee_expense";
  }

  if (component.accountingTreatment === "pass_through") {
    return "pass_through";
  }

  return component.kind === "fx_spread" ? "spread_revenue" : "fee_revenue";
}

export function financialLineFromFeeComponent(component: FeeComponent): FinancialLine {
  const normalized = normalizeFinancialLine({
    id: component.id,
    bucket: resolveBucket(component),
    currency: component.currency,
    amountMinor: component.amountMinor,
    source: component.source,
    settlementMode: component.settlementMode,
    memo: component.memo,
    metadata: {
      ...(component.metadata ?? {}),
      ...(component.ruleId ? { ruleId: component.ruleId } : {}),
      feeKind: component.kind,
    },
  });

  return normalized;
}

export async function saveQuoteFinancialLines(input: {
  context: FxServiceContext;
  quoteId: string;
  financialLines: FinancialLine[];
  tx?: Transaction;
}): Promise<void> {
  const { context, quoteId, financialLines, tx } = input;
  const executor = tx ?? context.db;

  await executor
    .delete(schema.fxQuoteFinancialLines)
    .where(eq(schema.fxQuoteFinancialLines.quoteId, quoteId));

  if (financialLines.length === 0) {
    return;
  }

  const normalized = aggregateFinancialLines(financialLines);
  const currencyCodes = [...new Set(normalized.map((line) => line.currency))];
  const currencyIdByCode = new Map<string, string>();

  await Promise.all(
    currencyCodes.map(async (code) => {
      const currency = await context.currenciesService.findByCode(code);
      currencyIdByCode.set(currency.code, currency.id);
    }),
  );

  await executor.insert(schema.fxQuoteFinancialLines).values(
    normalized.map((line, index) => ({
      quoteId,
      idx: index + 1,
      bucket: line.bucket,
      currencyId: currencyIdByCode.get(line.currency)!,
      amountMinor: line.amountMinor,
      source: line.source,
      settlementMode: line.settlementMode ?? "in_ledger",
      memo: line.memo,
      metadata: line.metadata,
    })),
  );
}

export async function getQuoteFinancialLines(input: {
  context: FxServiceContext;
  quoteId: string;
  tx?: Transaction;
}): Promise<FinancialLine[]> {
  const { context, quoteId, tx } = input;
  const executor = tx ?? context.db;

  const rows = await executor
    .select()
    .from(schema.fxQuoteFinancialLines)
    .where(eq(schema.fxQuoteFinancialLines.quoteId, quoteId))
    .limit(2048);
  const uniqueCurrencyIds = [...new Set(rows.map((row) => row.currencyId))];
  const currencyCodeById = new Map<string, string>();

  await Promise.all(
    uniqueCurrencyIds.map(async (id) => {
      const currency = await context.currenciesService.findById(id);
      currencyCodeById.set(id, currency.code);
    }),
  );

  return rows
    .slice()
    .sort((left, right) => left.idx - right.idx)
    .map((row) =>
      normalizeFinancialLine({
        id: `quote_financial_line:${row.quoteId}:${row.idx}`,
        bucket: row.bucket as FinancialLineBucket,
        currency: currencyCodeById.get(row.currencyId)!,
        amountMinor: row.amountMinor,
        source: row.source as FinancialLine["source"],
        settlementMode: row.settlementMode as FinancialLine["settlementMode"],
        memo: row.memo ?? undefined,
        metadata: row.metadata ?? undefined,
      }),
    );
}
