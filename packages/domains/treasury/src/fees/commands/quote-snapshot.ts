import { eq } from "drizzle-orm";

import { schema } from "@multihansa/treasury/fees/schema";

import { type FeesServiceContext } from "../context";
import { normalizeComponent } from "../normalize";
import type {
  FeeComponent,
  GetQuoteFeeComponentsInput,
  SaveQuoteFeeComponentsInput,
} from "../types";
import {
  validateGetQuoteFeeComponentsInput,
  validateSaveQuoteFeeComponentsInput,
} from "../validation";

export function createQuoteSnapshotHandlers(context: FeesServiceContext) {
  const { db, currenciesService } = context;

  async function saveQuoteFeeComponents(
    input: SaveQuoteFeeComponentsInput,
    tx?: any,
  ): Promise<void> {
    const validated = validateSaveQuoteFeeComponentsInput(input);
    const executor = tx ?? db;

    await executor
      .delete(schema.fxQuoteFeeComponents)
      .where(eq(schema.fxQuoteFeeComponents.quoteId, validated.quoteId));

    if (!validated.components.length) return;
    const currencyCodes = [
      ...new Set(validated.components.map((component) => component.currency)),
    ];
    const currencyIdByCode = new Map<string, string>();
    await Promise.all(
      currencyCodes.map(async (code) => {
        const currency = await currenciesService.findByCode(code);
        currencyIdByCode.set(currency.code, currency.id);
      }),
    );

    const rows = validated.components.map((raw, idx) => {
      const component = normalizeComponent(raw);
      return {
        quoteId: validated.quoteId,
        idx: idx + 1,
        ruleId: component.ruleId,
        kind: component.kind,
        currencyId: currencyIdByCode.get(component.currency)!,
        amountMinor: component.amountMinor,
        source: component.source,
        settlementMode: component.settlementMode ?? "in_ledger",
        debitAccountKey: null,
        creditAccountKey: null,
        transferCode: null,
        memo: component.memo,
        metadata: component.metadata,
      };
    });

    await executor.insert(schema.fxQuoteFeeComponents).values(rows);
  }

  async function getQuoteFeeComponents(
    input: GetQuoteFeeComponentsInput,
    tx?: any,
  ): Promise<FeeComponent[]> {
    const validated = validateGetQuoteFeeComponentsInput(input);
    const executor = tx ?? db;

    const rows = (await executor
      .select()
      .from(schema.fxQuoteFeeComponents)
      .where(eq(schema.fxQuoteFeeComponents.quoteId, validated.quoteId))
      .limit(2048)) as (typeof schema.fxQuoteFeeComponents.$inferSelect)[];
    const uniqueCurrencyIds = [...new Set(rows.map((row) => row.currencyId))];
    const currencyCodeById = new Map<string, string>();
    await Promise.all(
      uniqueCurrencyIds.map(async (id) => {
        const currency = await currenciesService.findById(id);
        currencyCodeById.set(id, currency.code);
      }),
    );

    rows.sort(
      (a: (typeof rows)[number], b: (typeof rows)[number]) => a.idx - b.idx,
    );

    return rows.map((row: (typeof rows)[number]) => ({
      id: `quote_component:${row.quoteId}:${row.idx}`,
      ruleId: row.ruleId ?? undefined,
      kind: row.kind,
      currency: currencyCodeById.get(row.currencyId)!,
      amountMinor: row.amountMinor,
      source: row.source,
      settlementMode: row.settlementMode,
      memo: row.memo ?? undefined,
      metadata: row.metadata ?? undefined,
    }));
  }

  return {
    saveQuoteFeeComponents,
    getQuoteFeeComponents,
  };
}
