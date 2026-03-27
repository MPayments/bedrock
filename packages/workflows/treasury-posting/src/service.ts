import type { AccountingModule } from "@bedrock/accounting";
import type { LedgerModule } from "@bedrock/ledger";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import type { TreasuryModule } from "@bedrock/treasury";
import type { RecordExecutionEventInput } from "@bedrock/treasury/executions";
import type { OpenObligationInput } from "@bedrock/treasury/obligations";
import type { SettlePositionInput } from "@bedrock/treasury/positions";

import {
  buildExecutionEventPostingPlans,
  buildObligationOpenPostingPlan,
  buildPositionOpenPostingPlan,
  buildPositionSettlePostingPlan,
  type TreasuryPostingPlanInput,
} from "./posting-plans";

type WorkflowTreasuryModule = Pick<
  TreasuryModule,
  "executions" | "obligations" | "operations" | "positions"
>;

type WorkflowAccountingModule = Pick<AccountingModule, "packs">;
type WorkflowLedgerModule = Pick<LedgerModule, "books" | "operations">;

export interface TreasuryPostingReadsPort {
  findTreasuryAccount(id: string): Promise<{
    id: string;
    ownerEntityId: string;
  } | null>;
  findInstruction(id: string): Promise<{
    id: string;
    operationId: string;
    sourceAccountId: string;
    destinationEndpointId: string | null;
    assetId: string;
    amountMinor: bigint;
    metadata: Record<string, unknown> | null;
  } | null>;
  listInstructionEvents(instructionId: string): Promise<
    {
      eventKind: string;
    }[]
  >;
}

export interface TreasuryPostingWorkflowDeps {
  db: Database;
  currencies: {
    findById(id: string): Promise<{
      code: string;
    }>;
  };
  createTreasuryModule(tx: Transaction): WorkflowTreasuryModule;
  createTreasuryReads(tx: Transaction): TreasuryPostingReadsPort;
  createAccountingModule(tx: Transaction): WorkflowAccountingModule;
  createLedgerModule(tx: Transaction): WorkflowLedgerModule;
}

export interface TreasuryPostingWorkflow {
  openObligation(
    input: OpenObligationInput,
  ): Promise<
    Awaited<ReturnType<WorkflowTreasuryModule["obligations"]["commands"]["openObligation"]>>
  >;
  recordExecutionEvent(
    input: RecordExecutionEventInput,
  ): Promise<
    Awaited<ReturnType<WorkflowTreasuryModule["executions"]["commands"]["recordExecutionEvent"]>>
  >;
  settlePosition(
    input: SettlePositionInput,
  ): Promise<
    Awaited<ReturnType<WorkflowTreasuryModule["positions"]["commands"]["settlePosition"]>>
  >;
}

export function createTreasuryPostingWorkflow(
  deps: TreasuryPostingWorkflowDeps,
): TreasuryPostingWorkflow {
  function getRemainingPositionAmountMinor(input: {
    position: Awaited<
      ReturnType<WorkflowTreasuryModule["positions"]["queries"]["listTreasuryPositions"]>
    >[number];
  }) {
    const amountMinor = BigInt(input.position.amountMinor);
    const settledMinor = BigInt(input.position.settledMinor);

    return amountMinor > settledMinor ? amountMinor - settledMinor : 0n;
  }

  function shouldPostOpenedPosition(input: {
    operation: Awaited<
      ReturnType<WorkflowTreasuryModule["executions"]["commands"]["recordExecutionEvent"]>
    >["operation"];
    position: Awaited<
      ReturnType<WorkflowTreasuryModule["positions"]["queries"]["listTreasuryPositions"]>
    >[number];
  }) {
    if (
      input.operation.operationKind === "collection" &&
      input.operation.beneficialOwnerType === "customer"
    ) {
      return input.position.positionKind === "customer_liability";
    }

    return true;
  }

  function shouldAutoSettleReturnedPosition(input: {
    operation: Awaited<
      ReturnType<WorkflowTreasuryModule["executions"]["commands"]["recordExecutionEvent"]>
    >["operation"];
    position: Awaited<
      ReturnType<WorkflowTreasuryModule["positions"]["queries"]["listTreasuryPositions"]>
    >[number];
  }) {
    if (input.operation.operationKind !== "collection") {
      return false;
    }

    return shouldPostOpenedPosition(input);
  }

  async function resolveCurrencyCode(assetId: string) {
    const currency = await deps.currencies.findById(assetId);
    return currency.code;
  }

  async function commitPostingPlans(input: {
    plans: TreasuryPostingPlanInput[];
    accountingModule: WorkflowAccountingModule;
    ledgerModule: WorkflowLedgerModule;
  }) {
    for (const plan of input.plans) {
      const resolved = await input.accountingModule.packs.queries.resolvePostingPlan(
        {
          accountingSourceId: plan.accountingSourceId,
          source: plan.source,
          idempotencyKey: plan.idempotencyKey,
          postingDate: plan.postingDate,
          bookIdContext: plan.bookId,
          plan: plan.plan,
        },
      );

      await input.ledgerModule.operations.commands.commit(resolved.intent);
    }
  }

  async function ensureDefaultBookId(
    ledgerModule: WorkflowLedgerModule,
    organizationId: string,
    cache: Map<string, string>,
  ) {
    const cached = cache.get(organizationId);
    if (cached) {
      return cached;
    }

    const ensured = await ledgerModule.books.commands.ensureDefaultOrganizationBook(
      {
        organizationId,
      },
    );
    cache.set(organizationId, ensured.bookId);

    return ensured.bookId;
  }

  return {
    async openObligation(input: OpenObligationInput) {
      return deps.db.transaction(async (tx) => {
        const treasuryModule = deps.createTreasuryModule(tx);
        const accountingModule = deps.createAccountingModule(tx);
        const ledgerModule = deps.createLedgerModule(tx);
        const bookCache = new Map<string, string>();

        const obligation =
          await treasuryModule.obligations.commands.openObligation(input);
        const bookOwnerEntityId =
          obligation.obligationKind === "ap_invoice"
            ? obligation.debtorEntityId
            : obligation.creditorEntityId;
        const bookId = await ensureDefaultBookId(
          ledgerModule,
          bookOwnerEntityId,
          bookCache,
        );
        const currency = await resolveCurrencyCode(obligation.assetId);
        const plans = buildObligationOpenPostingPlan({
          obligation,
          currency,
          bookId,
        });

        await commitPostingPlans({
          plans,
          accountingModule,
          ledgerModule,
        });

        return obligation;
      });
    },

    async recordExecutionEvent(input: RecordExecutionEventInput) {
      return deps.db.transaction(async (tx) => {
        const treasuryModule = deps.createTreasuryModule(tx);
        const treasuryReads = deps.createTreasuryReads(tx);
        const accountingModule = deps.createAccountingModule(tx);
        const ledgerModule = deps.createLedgerModule(tx);
        const bookCache = new Map<string, string>();

        const instruction = await treasuryReads.findInstruction(input.instructionId);
        const previousEvents = instruction
          ? await treasuryReads.listInstructionEvents(input.instructionId)
          : [];
        const positionsBefore = instruction
          ? await treasuryModule.positions.queries.listTreasuryPositions({
              originOperationId: instruction.operationId,
            })
          : [];

        const recorded =
          await treasuryModule.executions.commands.recordExecutionEvent(input);
        const sourceAccountId =
          instruction?.sourceAccountId ?? recorded.operation.sourceAccountId;
        const sourceAccount = sourceAccountId
          ? await treasuryReads.findTreasuryAccount(sourceAccountId)
          : null;
        const destinationAccount = recorded.operation.destinationAccountId
          ? await treasuryReads.findTreasuryAccount(
              recorded.operation.destinationAccountId,
            )
          : null;
        const sourceCurrency = recorded.operation.sourceAssetId
          ? await resolveCurrencyCode(recorded.operation.sourceAssetId)
          : null;
        const destinationCurrency = recorded.operation.destinationAssetId
          ? await resolveCurrencyCode(recorded.operation.destinationAssetId)
          : null;
        const sourceBookId = sourceAccount
          ? await ensureDefaultBookId(
              ledgerModule,
              sourceAccount.ownerEntityId,
              bookCache,
            )
          : null;
        const destinationBookId = destinationAccount
          ? await ensureDefaultBookId(
              ledgerModule,
              destinationAccount.ownerEntityId,
              bookCache,
            )
          : null;
        const timeline =
          await treasuryModule.operations.queries.getOperationTimeline({
            operationId: recorded.operation.id,
          });
        const positionsAfter =
          await treasuryModule.positions.queries.listTreasuryPositions({
            originOperationId: recorded.operation.id,
          });

        const plans: TreasuryPostingPlanInput[] = [];

        if (instruction) {
          plans.push(
            ...buildExecutionEventPostingPlans({
              event: recorded.event,
              operation: recorded.operation,
              instruction,
              previousEventKinds: previousEvents.map((event) => event.eventKind),
              timeline,
              sourceAccount,
              destinationAccount,
              sourceCurrency,
              destinationCurrency,
              sourceBookId,
              destinationBookId,
              recordInput: input,
            }),
          );
        }

        if (recorded.event.eventKind === "settled") {
          const previousPositionIds = new Set(
            positionsBefore.map((position) => position.id),
          );
          const newPositions = positionsAfter.filter(
            (position) =>
              !previousPositionIds.has(position.id) &&
              shouldPostOpenedPosition({
                operation: recorded.operation,
                position,
              }),
          );

          for (const position of newPositions) {
            const positionBookId = await ensureDefaultBookId(
              ledgerModule,
              position.ownerEntityId,
              bookCache,
            );
            const positionCurrency = await resolveCurrencyCode(position.assetId);
            plans.push(
              ...buildPositionOpenPostingPlan({
                position,
                currency: positionCurrency,
                bookId: positionBookId,
              }),
            );
          }
        }

        if (
          recorded.event.eventKind === "returned" &&
          previousEvents.some((event) => event.eventKind === "settled")
        ) {
          const positionsToSettle = positionsAfter.filter((position) => {
            const remainingAmountMinor = getRemainingPositionAmountMinor({
              position,
            });

            return (
              remainingAmountMinor > 0n &&
              shouldAutoSettleReturnedPosition({
                operation: recorded.operation,
                position,
              })
            );
          });

          for (const position of positionsToSettle) {
            const settledAmountMinor = getRemainingPositionAmountMinor({
              position,
            });
            const settledPosition =
              await treasuryModule.positions.commands.settlePosition({
                positionId: position.id,
                amountMinor: settledAmountMinor.toString(),
              });
            const positionBookId = await ensureDefaultBookId(
              ledgerModule,
              settledPosition.ownerEntityId,
              bookCache,
            );
            const positionCurrency = await resolveCurrencyCode(
              settledPosition.assetId,
            );

            plans.push(
              ...buildPositionSettlePostingPlan({
                position: settledPosition,
                settledAmountMinor,
                currency: positionCurrency,
                bookId: positionBookId,
              }),
            );
          }
        }

        await commitPostingPlans({
          plans,
          accountingModule,
          ledgerModule,
        });

        return recorded;
      });
    },

    async settlePosition(input: SettlePositionInput) {
      return deps.db.transaction(async (tx) => {
        const treasuryModule = deps.createTreasuryModule(tx);
        const accountingModule = deps.createAccountingModule(tx);
        const ledgerModule = deps.createLedgerModule(tx);
        const bookCache = new Map<string, string>();
        const settledAmountMinor = BigInt(input.amountMinor);

        const position = await treasuryModule.positions.commands.settlePosition(
          input,
        );
        const bookId = await ensureDefaultBookId(
          ledgerModule,
          position.ownerEntityId,
          bookCache,
        );
        const currency = await resolveCurrencyCode(position.assetId);
        const plans = buildPositionSettlePostingPlan({
          position,
          settledAmountMinor,
          currency,
          bookId,
        });

        await commitPostingPlans({
          plans,
          accountingModule,
          ledgerModule,
        });

        return position;
      });
    },
  };
}
