import { eq } from "drizzle-orm";
import { describe, it, expect } from "vitest";

import { createCurrenciesService } from "@bedrock/currencies";
import { schema } from "@bedrock/db/schema";
import { createFeesService } from "@bedrock/fees";
import { createLedgerEngine } from "@bedrock/ledger";

import {
  db,
  createTestScenario,
  getPaymentOrder,
  randomRailRef,
} from "./helpers";
import { createTreasuryService } from "../../src/service";
import { createTreasuryWorker } from "../../src/worker";

describe("Treasury Worker Integration Tests", () => {
  const ledger = createLedgerEngine({ db });
  const currenciesService = createCurrenciesService({ db });
  const feesService = createFeesService({ db, currenciesService });

  it("returns only finalized count when fetched set includes pending journals", async () => {
    const scenarioPosted = await createTestScenario();
    const scenarioPending = await createTestScenario();

    const servicePosted = createTreasuryService({
      db,
      ledger,
      feesService,
      currenciesService,
    });
    const servicePending = createTreasuryService({
      db,
      ledger,
      feesService,
      currenciesService,
    });

    const postedEntryId = await servicePosted.fundingSettled({
      orderId: scenarioPosted.order.id,
      branchCounterpartyId: scenarioPosted.branchCounterparty.id,
      branchBankStableKey: scenarioPosted.branchAccount.stableKey,
      customerId: scenarioPosted.customer.id,
      currency: "USD",
      amountMinor: 100000n,
      railRef: randomRailRef(),
      occurredAt: new Date(),
    });

    await servicePending.fundingSettled({
      orderId: scenarioPending.order.id,
      branchCounterpartyId: scenarioPending.branchCounterparty.id,
      branchBankStableKey: scenarioPending.branchAccount.stableKey,
      customerId: scenarioPending.customer.id,
      currency: "USD",
      amountMinor: 100000n,
      railRef: randomRailRef(),
      occurredAt: new Date(),
    });

    await db
      .update(schema.ledgerOperations)
      .set({ status: "posted" })
      .where(eq(schema.ledgerOperations.id, postedEntryId));

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
      feesService,
      currenciesService,
    });

    const entryId = await service.fundingSettled({
      orderId: scenario.order.id,
      branchCounterpartyId: scenario.branchCounterparty.id,
      branchBankStableKey: scenario.branchAccount.stableKey,
      customerId: scenario.customer.id,
      currency: "USD",
      amountMinor: 100000n,
      railRef: randomRailRef(),
      occurredAt: new Date(),
    });

    await db
      .update(schema.ledgerOperations)
      .set({ status: "failed" })
      .where(eq(schema.ledgerOperations.id, entryId));

    const worker = createTreasuryWorker({ db });
    const processed = await worker.processOnce({ batchSize: 10 });
    expect(processed).toBe(1);

    const order = await getPaymentOrder(scenario.order.id);
    expect(order!.status).toBe("failed");
  });
});
