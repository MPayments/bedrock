import type { AgreementsModule } from "@bedrock/agreements";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DealsModule } from "@bedrock/deals";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import type { ReconciliationService } from "@bedrock/reconciliation";
import type { TreasuryModule } from "@bedrock/treasury";

export type ExecutionLifecycleEventType =
  | "deal_closed"
  | "execution_requested"
  | "leg_operation_created";

export interface DealExecutionStore {
  createDealTimelineEvents(
    input: {
      actorLabel: string | null;
      actorUserId: string | null;
      dealId: string;
      id: string;
      occurredAt: Date;
      payload: Record<string, unknown>;
      sourceRef: string | null;
      type: ExecutionLifecycleEventType;
      visibility: "internal";
    }[],
  ): Promise<void>;
}

export type DealExecutionTreasuryModule = Pick<
  TreasuryModule,
  "paymentSteps" | "quoteExecutions" | "quotes"
>;

export interface DealExecutionTxDeps {
  dealStore: DealExecutionStore;
  dealsModule: Pick<DealsModule, "deals">;
  reconciliation: Pick<ReconciliationService, "links" | "records">;
  treasuryModule: DealExecutionTreasuryModule;
}

export interface DealExecutionWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  currencies: Pick<CurrenciesService, "findById">;
  db: Database;
  idempotency: IdempotencyPort;
  createDealStore(tx: Transaction): DealExecutionStore;
  createDealsModule(tx: Transaction): Pick<DealsModule, "deals">;
  createReconciliationService(
    tx: Transaction,
  ): Pick<ReconciliationService, "links" | "records">;
  createTreasuryModule(tx: Transaction): DealExecutionTreasuryModule;
}
