import type { AgreementsModule } from "@bedrock/agreements";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DealsModule } from "@bedrock/deals";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import type { ReconciliationService } from "@bedrock/reconciliation";
import type { TreasuryModule } from "@bedrock/treasury";
import type { TreasuryOperationKind } from "@bedrock/treasury/contracts";

export type ExecutionLifecycleEventType =
  | "deal_closed"
  | "execution_requested"
  | "instruction_failed"
  | "instruction_prepared"
  | "instruction_retried"
  | "instruction_returned"
  | "instruction_settled"
  | "instruction_submitted"
  | "instruction_voided"
  | "leg_operation_created"
  | "return_requested";

export interface DealExecutionStore {
  createDealLegOperationLinks(
    input: {
      dealLegId: string;
      id: string;
      operationKind: TreasuryOperationKind;
      sourceRef: string;
      treasuryOperationId: string;
    }[],
  ): Promise<void>;
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

export interface OperationMutationResult {
  dealId: string;
  instructionId: string | null;
  operationId: string;
}

export interface DealExecutionTxDeps {
  dealStore: DealExecutionStore;
  dealsModule: Pick<DealsModule, "deals">;
  reconciliation: Pick<ReconciliationService, "links" | "records">;
  treasuryModule: Pick<
    TreasuryModule,
    "instructions" | "operations" | "quotes"
  >;
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
  createTreasuryModule(
    tx: Transaction,
  ): Pick<TreasuryModule, "instructions" | "operations" | "quotes">;
}
