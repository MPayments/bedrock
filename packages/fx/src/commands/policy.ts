import { eq, sql } from "drizzle-orm";
import { schema } from "@bedrock/db/schema";

import { type FxServiceContext } from "../internal/context";
import { type SetManualRateInput, type UpsertPolicyInput, validateSetManualRateInput, validateUpsertPolicyInput } from "../validation";

export function createPolicyHandlers(context: FxServiceContext) {
    const { db } = context;

    async function upsertPolicy(input: UpsertPolicyInput) {
        const validated = validateUpsertPolicyInput(input);

        const upserted = await db
            .insert(schema.fxPolicies)
            .values({
                name: validated.name,
                marginBps: validated.marginBps,
                feeBps: validated.feeBps,
                ttlSeconds: validated.ttlSeconds,
            })
            .onConflictDoUpdate({
                target: schema.fxPolicies.name,
                set: {
                    marginBps: validated.marginBps,
                    feeBps: validated.feeBps,
                    ttlSeconds: validated.ttlSeconds,
                    isActive: true,
                },
            })
            .returning({ id: schema.fxPolicies.id });

        return upserted[0]!.id;
    }

    async function setManualRate(input: SetManualRateInput) {
        const validated = validateSetManualRateInput(input);

        await db.insert(schema.fxRates).values({
            base: validated.base,
            quote: validated.quote,
            rateNum: validated.rateNum,
            rateDen: validated.rateDen,
            asOf: validated.asOf,
            source: validated.source ?? "manual",
        });
    }

    async function expireOldQuotes(now: Date) {
        await db.execute(sql`
      UPDATE ${schema.fxQuotes}
      SET status = 'expired'
      WHERE status = 'active'
        AND expires_at <= ${now}
    `);
    }

    return {
        upsertPolicy,
        setManualRate,
        expireOldQuotes,
    };
}
