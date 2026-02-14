import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@bedrock/db/schema";
import { createLedgerEngine } from "@bedrock/ledger";
import { createFeesService } from "@bedrock/fees";
import { createTreasuryService } from "../../src/service";
import { createTreasuryWorker } from "../../src/worker";
import {
    db,
    createTestScenario,
    getPaymentOrder,
    randomRailRef,
} from "./helpers";

describe("Treasury Worker Integration Tests", () => {
    const ledger = createLedgerEngine({ db });
    const feesService = createFeesService({ db });

    it("returns only finalized count when fetched set includes pending journals", async () => {
        const scenarioPosted = await createTestScenario();
        const scenarioPending = await createTestScenario();

        const servicePosted = createTreasuryService({
            db,
            ledger,
            feesService
        });
        const servicePending = createTreasuryService({
            db,
            ledger,
            feesService
        });

        const postedEntryId = await servicePosted.fundingSettled({
            orderId: scenarioPosted.order.id,
            branchOrgId: scenarioPosted.branchOrg.id,
            branchBankStableKey: scenarioPosted.branchBankAccount.stableKey,
            customerId: scenarioPosted.customer.id,
            currency: "USD",
            amountMinor: 100000n,
            railRef: randomRailRef(),
            occurredAt: new Date(),
        });

        await servicePending.fundingSettled({
            orderId: scenarioPending.order.id,
            branchOrgId: scenarioPending.branchOrg.id,
            branchBankStableKey: scenarioPending.branchBankAccount.stableKey,
            customerId: scenarioPending.customer.id,
            currency: "USD",
            amountMinor: 100000n,
            railRef: randomRailRef(),
            occurredAt: new Date(),
        });

        await db
            .update(schema.journalEntries)
            .set({ status: "posted" })
            .where(eq(schema.journalEntries.id, postedEntryId));

        const worker = createTreasuryWorker({ db });
        const processed = await worker.processOnce({ batchSize: 50 });
        expect(processed).toBe(1);

        const postedOrder = await getPaymentOrder(scenarioPosted.order.id);
        const pendingOrder = await getPaymentOrder(scenarioPending.order.id);
        expect(postedOrder!.status).toBe("funding_settled");
        expect(pendingOrder!.status).toBe("funding_settled_pending_posting");
    });

    it("moves pending-posting order to failed when journal is failed", async () => {
        const scenario = await createTestScenario();
        const service = createTreasuryService({
            db,
            ledger,
            feesService
        });

        const entryId = await service.fundingSettled({
            orderId: scenario.order.id,
            branchOrgId: scenario.branchOrg.id,
            branchBankStableKey: scenario.branchBankAccount.stableKey,
            customerId: scenario.customer.id,
            currency: "USD",
            amountMinor: 100000n,
            railRef: randomRailRef(),
            occurredAt: new Date(),
        });

        await db
            .update(schema.journalEntries)
            .set({ status: "failed" })
            .where(eq(schema.journalEntries.id, entryId));

        const worker = createTreasuryWorker({ db });
        const processed = await worker.processOnce({ batchSize: 10 });
        expect(processed).toBe(1);

        const order = await getPaymentOrder(scenario.order.id);
        expect(order!.status).toBe("failed");
    });
});
