import { eq } from "drizzle-orm";
import { schema } from "@bedrock/db/schema";

import { validateGetQuoteFeeComponentsInput, validateSaveQuoteFeeComponentsInput } from "../validation";
import type { FeeComponent, GetQuoteFeeComponentsInput, SaveQuoteFeeComponentsInput } from "../types";
import { type FeesServiceContext } from "../internal/context";
import { normalizeComponent } from "../internal/normalize";

export function createQuoteSnapshotHandlers(context: FeesServiceContext) {
    const { db } = context;

    async function saveQuoteFeeComponents(input: SaveQuoteFeeComponentsInput, tx?: any): Promise<void> {
        const validated = validateSaveQuoteFeeComponentsInput(input);
        const executor = tx ?? db;

        await executor.delete(schema.fxQuoteFeeComponents).where(eq(schema.fxQuoteFeeComponents.quoteId, validated.quoteId));

        if (!validated.components.length) return;

        const rows = validated.components.map((raw, idx) => {
            const component = normalizeComponent(raw);
            return {
                quoteId: validated.quoteId,
                idx: idx + 1,
                ruleId: component.ruleId,
                kind: component.kind,
                currency: component.currency,
                amountMinor: component.amountMinor,
                source: component.source,
                settlementMode: component.settlementMode ?? "in_ledger",
                debitAccountKey: component.debitAccountKey,
                creditAccountKey: component.creditAccountKey,
                transferCode: component.transferCode,
                memo: component.memo,
                metadata: component.metadata,
            };
        });

        await executor.insert(schema.fxQuoteFeeComponents).values(rows);
    }

    async function getQuoteFeeComponents(input: GetQuoteFeeComponentsInput, tx?: any): Promise<FeeComponent[]> {
        const validated = validateGetQuoteFeeComponentsInput(input);
        const executor = tx ?? db;

        const rows = await executor
            .select()
            .from(schema.fxQuoteFeeComponents)
            .where(eq(schema.fxQuoteFeeComponents.quoteId, validated.quoteId))
            .limit(2048);

        rows.sort((a: (typeof rows)[number], b: (typeof rows)[number]) => a.idx - b.idx);

        return rows.map((row: (typeof rows)[number]) => ({
            id: `quote_component:${row.quoteId}:${row.idx}`,
            ruleId: row.ruleId ?? undefined,
            kind: row.kind,
            currency: row.currency,
            amountMinor: row.amountMinor,
            source: row.source,
            settlementMode: row.settlementMode,
            debitAccountKey: row.debitAccountKey ?? undefined,
            creditAccountKey: row.creditAccountKey ?? undefined,
            transferCode: row.transferCode ?? undefined,
            memo: row.memo ?? undefined,
            metadata: row.metadata ?? undefined,
        }));
    }

    return {
        saveQuoteFeeComponents,
        getQuoteFeeComponents,
    };
}
