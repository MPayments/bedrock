import { randomUUID } from "node:crypto";

import type { AgreementsModule } from "@bedrock/agreements";
import type { CurrenciesService } from "@bedrock/currencies";
import {
  DealNotFoundError,
  DealTransitionBlockedError,
  type DealsModule,
} from "@bedrock/deals";
import type {
  DealCapabilityKind,
  DealTransitionBlocker,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import { ValidationError } from "@bedrock/shared/core/errors";
import { toMinorAmountString } from "@bedrock/shared/money";
import type { TreasuryModule } from "@bedrock/treasury";
import type {
  QuoteDetailsRecord,
  TreasuryInstruction,
  TreasuryInstructionOutcome,
  TreasuryOperationKind,
} from "@bedrock/treasury/contracts";

const DEAL_EXECUTION_REQUEST_SCOPE = "workflow-deal-execution.request";
const DEAL_EXECUTION_CREATE_LEG_OPERATION_SCOPE =
  "workflow-deal-execution.create-leg-operation";
const DEAL_EXECUTION_RESOLVE_BLOCKER_SCOPE =
  "workflow-deal-execution.resolve-blocker";
const DEAL_EXECUTION_CLOSE_SCOPE = "workflow-deal-execution.close";
const DEAL_EXECUTION_PREPARE_INSTRUCTION_SCOPE =
  "workflow-deal-execution.prepare-instruction";
const DEAL_EXECUTION_SUBMIT_INSTRUCTION_SCOPE =
  "workflow-deal-execution.submit-instruction";
const DEAL_EXECUTION_RETRY_INSTRUCTION_SCOPE =
  "workflow-deal-execution.retry-instruction";
const DEAL_EXECUTION_VOID_INSTRUCTION_SCOPE =
  "workflow-deal-execution.void-instruction";
const DEAL_EXECUTION_REQUEST_RETURN_SCOPE =
  "workflow-deal-execution.request-return";
const DEAL_EXECUTION_RECORD_OUTCOME_SCOPE =
  "workflow-deal-execution.record-outcome";

const EXECUTION_REQUESTABLE_STATUSES = new Set([
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
]);
const CLOSE_TERMINAL_INSTRUCTION_STATES = new Set([
  "returned",
  "settled",
  "voided",
]);

type ExecutionLifecycleEventType =
  | "deal_closed"
  | "execution_blocker_resolved"
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

export type DealExecutionAmountRef =
  | "accepted_quote_from"
  | "accepted_quote_to"
  | "incoming_receipt_expected"
  | "money_request_source";

export interface CompiledDealExecutionOperation {
  amountRef: DealExecutionAmountRef | null;
  counterAmountRef: DealExecutionAmountRef | null;
  legId: string;
  legIdx: number;
  legKind: DealWorkflowProjection["executionPlan"][number]["kind"];
  operationKind: TreasuryOperationKind;
  quoteId: string | null;
  sourceRef: string;
}

interface DealExecutionStore {
  createDealLegOperationLinks(input: {
    dealLegId: string;
    id: string;
    operationKind: TreasuryOperationKind;
    sourceRef: string;
    treasuryOperationId: string;
  }[]): Promise<void>;
  createDealTimelineEvents(input: {
    actorLabel: string | null;
    actorUserId: string | null;
    dealId: string;
    id: string;
    occurredAt: Date;
    payload: Record<string, unknown>;
    sourceRef: string | null;
    type: ExecutionLifecycleEventType;
    visibility: "internal";
  }[]): Promise<void>;
}

interface OperationMutationResult {
  dealId: string;
  instructionId: string | null;
  operationId: string;
}

interface DealExecutionTxDeps {
  dealStore: DealExecutionStore;
  dealsModule: Pick<DealsModule, "deals">;
  treasuryModule: Pick<TreasuryModule, "instructions" | "operations" | "quotes">;
}

export interface DealExecutionWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  currencies: Pick<CurrenciesService, "findById">;
  db: Database;
  idempotency: IdempotencyPort;
  createDealStore(tx: Transaction): DealExecutionStore;
  createDealsModule(tx: Transaction): Pick<DealsModule, "deals">;
  createTreasuryModule(tx: Transaction): Pick<
    TreasuryModule,
    "instructions" | "operations" | "quotes"
  >;
}

function resolveFundingOperationKind(input: {
  agreementOrganizationId: string | null;
  internalEntityOrganizationId: string | null;
}): TreasuryOperationKind {
  if (
    input.agreementOrganizationId &&
    input.internalEntityOrganizationId &&
    input.agreementOrganizationId !== input.internalEntityOrganizationId
  ) {
    return "intercompany_funding";
  }

  return "intracompany_transfer";
}

function resolvePayoutAmountRef(
  workflow: DealWorkflowProjection,
): DealExecutionAmountRef {
  const hasConvert = workflow.executionPlan.some((leg) => leg.kind === "convert");

  if (hasConvert && workflow.summary.type !== "exporter_settlement") {
    return "accepted_quote_to";
  }

  return "money_request_source";
}

export function compileDealExecutionRecipe(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  agreementOrganizationId: string | null;
  internalEntityOrganizationId: string | null;
  workflow: DealWorkflowProjection;
}): CompiledDealExecutionOperation[] {
  const hasConvert = input.workflow.executionPlan.some(
    (leg) => leg.kind === "convert",
  );

  if (hasConvert && !input.acceptedQuote) {
    throw new ValidationError(
      `Deal ${input.workflow.summary.id} requires accepted quote details for execution`,
    );
  }

  return input.workflow.executionPlan.map((leg) => {
    if (!leg.id) {
      throw new ValidationError(
        `Deal ${input.workflow.summary.id} leg ${leg.idx}:${leg.kind} is missing an id`,
      );
    }

    let amountRef: DealExecutionAmountRef | null = null;
    let counterAmountRef: DealExecutionAmountRef | null = null;
    let operationKind: TreasuryOperationKind;
    let quoteId: string | null = null;

    switch (leg.kind) {
      case "collect":
        operationKind = "payin";
        amountRef =
          input.workflow.summary.type === "exporter_settlement"
            ? "incoming_receipt_expected"
            : "money_request_source";
        break;
      case "convert":
        operationKind = "fx_conversion";
        amountRef = "accepted_quote_from";
        counterAmountRef = "accepted_quote_to";
        quoteId = input.acceptedQuote?.quote.id ?? null;
        break;
      case "payout":
        operationKind = "payout";
        amountRef = resolvePayoutAmountRef(input.workflow);
        break;
      case "transit_hold":
      case "settle_exporter":
        operationKind = resolveFundingOperationKind({
          agreementOrganizationId: input.agreementOrganizationId,
          internalEntityOrganizationId: input.internalEntityOrganizationId,
        });
        amountRef =
          leg.kind === "settle_exporter"
            ? hasConvert
              ? "accepted_quote_to"
              : "incoming_receipt_expected"
            : hasConvert
              ? "accepted_quote_to"
              : "money_request_source";
        break;
    }

    return {
      amountRef,
      counterAmountRef,
      legId: leg.id,
      legIdx: leg.idx,
      legKind: leg.kind,
      operationKind,
      quoteId,
      sourceRef: `deal:${input.workflow.summary.id}:leg:${leg.idx}:${operationKind}:1`,
    };
  });
}

async function resolveAmountRef(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  amountRef: DealExecutionAmountRef | null;
  currencyCodeById: Map<string, string>;
  currencies: DealExecutionWorkflowDeps["currencies"];
  workflow: DealWorkflowProjection;
}): Promise<{ amountMinor: bigint | null; currencyId: string | null }> {
  if (!input.amountRef) {
    return {
      amountMinor: null,
      currencyId: null,
    };
  }

  if (input.amountRef === "accepted_quote_from") {
    if (!input.acceptedQuote) {
      throw new ValidationError("Accepted quote details are required");
    }

    return {
      amountMinor: input.acceptedQuote.quote.fromAmountMinor,
      currencyId: input.acceptedQuote.quote.fromCurrencyId,
    };
  }

  if (input.amountRef === "accepted_quote_to") {
    if (!input.acceptedQuote) {
      throw new ValidationError("Accepted quote details are required");
    }

    return {
      amountMinor: input.acceptedQuote.quote.toAmountMinor,
      currencyId: input.acceptedQuote.quote.toCurrencyId,
    };
  }

  const rawAmount =
    input.amountRef === "money_request_source"
      ? input.workflow.intake.moneyRequest.sourceAmount
      : input.workflow.intake.incomingReceipt.expectedAmount;
  const currencyId =
    input.amountRef === "money_request_source"
      ? input.workflow.intake.moneyRequest.sourceCurrencyId
      : input.workflow.intake.incomingReceipt.expectedCurrencyId;

  if (!rawAmount || !currencyId) {
    return {
      amountMinor: null,
      currencyId: currencyId ?? null,
    };
  }

  let currencyCode = input.currencyCodeById.get(currencyId) ?? null;

  if (!currencyCode) {
    currencyCode = (await input.currencies.findById(currencyId)).code;
    input.currencyCodeById.set(currencyId, currencyCode);
  }

  return {
    amountMinor: BigInt(toMinorAmountString(rawAmount, currencyCode)),
    currencyId,
  };
}

function assertExecutionRequestAllowed(workflow: DealWorkflowProjection) {
  if (EXECUTION_REQUESTABLE_STATUSES.has(workflow.summary.status)) {
    return;
  }

  const readiness = workflow.transitionReadiness.find(
    (item) => item.targetStatus === "awaiting_funds",
  );

  if (readiness?.allowed) {
    return;
  }

  throw new DealTransitionBlockedError(
    "awaiting_funds",
    readiness?.blockers ?? [],
  );
}

function getCustomerId(workflow: DealWorkflowProjection) {
  return (
    workflow.participants.find((participant) => participant.role === "customer")
      ?.customerId ?? null
  );
}

function getInternalEntityOrganizationId(workflow: DealWorkflowProjection) {
  return (
    workflow.participants.find(
      (participant) => participant.role === "internal_entity",
    )?.organizationId ?? null
  );
}

function findLegById(workflow: DealWorkflowProjection, legId: string) {
  return workflow.executionPlan.find((leg) => leg.id === legId) ?? null;
}

function getAllLinkedOperationIds(workflow: DealWorkflowProjection) {
  return workflow.executionPlan.flatMap((leg) =>
    leg.operationRefs.map((ref) => ref.operationId),
  );
}

function buildTimelineEvent(input: {
  actorUserId: string;
  dealId: string;
  payload: Record<string, unknown>;
  sourceRef: string;
  type: ExecutionLifecycleEventType;
}) {
  return {
    actorLabel: null,
    actorUserId: input.actorUserId,
    dealId: input.dealId,
    id: randomUUID(),
    occurredAt: new Date(),
    payload: input.payload,
    sourceRef: input.sourceRef,
    type: input.type,
    visibility: "internal" as const,
  };
}

async function requireWorkflow(
  dealsModule: Pick<DealsModule, "deals">,
  dealId: string,
) {
  const workflow = await dealsModule.deals.queries.findWorkflowById(dealId);

  if (!workflow) {
    throw new DealNotFoundError(dealId);
  }

  return workflow;
}

async function requireDealForOperation(
  treasuryModule: Pick<TreasuryModule, "instructions" | "operations" | "quotes">,
  dealsModule: Pick<DealsModule, "deals">,
  operationId: string,
) {
  const operation = await treasuryModule.operations.queries.findById(operationId);

  if (!operation) {
    throw new ValidationError(`Treasury operation ${operationId} not found`);
  }

  if (!operation.dealId) {
    throw new ValidationError(
      `Treasury operation ${operationId} is not linked to a deal`,
    );
  }

  const workflow = await requireWorkflow(dealsModule, operation.dealId);

  return {
    operation,
    workflow,
  };
}

async function requireInstructionForMutation(
  treasuryModule: Pick<TreasuryModule, "instructions" | "operations" | "quotes">,
  dealsModule: Pick<DealsModule, "deals">,
  instructionId: string,
) {
  const instruction = await treasuryModule.instructions.queries.findById(
    instructionId,
  );

  if (!instruction) {
    throw new ValidationError(`Treasury instruction ${instructionId} not found`);
  }

  const operation = await treasuryModule.operations.queries.findById(
    instruction.operationId,
  );

  if (!operation) {
    throw new ValidationError(
      `Treasury instruction ${instructionId} references missing operation ${instruction.operationId}`,
    );
  }

  if (!operation.dealId) {
    throw new ValidationError(
      `Treasury operation ${operation.id} is not linked to a deal`,
    );
  }

  const workflow = await requireWorkflow(dealsModule, operation.dealId);

  return {
    instruction,
    operation,
    workflow,
  };
}

async function resolveRecipeContext(
  deps: DealExecutionWorkflowDeps,
  treasuryModule: Pick<TreasuryModule, "instructions" | "operations" | "quotes">,
  workflow: DealWorkflowProjection,
) {
  const agreement = await deps.agreements.agreements.queries.findById(
    workflow.summary.agreementId,
  );
  const acceptedQuote =
    workflow.executionPlan.some((leg) => leg.kind === "convert") &&
    workflow.acceptedQuote?.quoteId
      ? await treasuryModule.quotes.queries.getQuoteDetails({
          quoteRef: workflow.acceptedQuote.quoteId,
        })
      : null;

  return {
    acceptedQuote,
    agreementOrganizationId: agreement?.organizationId ?? null,
    internalEntityOrganizationId: getInternalEntityOrganizationId(workflow),
    recipe: compileDealExecutionRecipe({
      acceptedQuote,
      agreementOrganizationId: agreement?.organizationId ?? null,
      internalEntityOrganizationId: getInternalEntityOrganizationId(workflow),
      workflow,
    }),
  };
}

async function materializeCompiledOperation(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  compiled: CompiledDealExecutionOperation;
  currencies: DealExecutionWorkflowDeps["currencies"];
  currencyCodeById: Map<string, string>;
  customerId: string | null;
  dealStore: DealExecutionStore;
  internalEntityOrganizationId: string | null;
  treasuryModule: Pick<TreasuryModule, "instructions" | "operations" | "quotes">;
  workflow: DealWorkflowProjection;
}) {
  const amount = await resolveAmountRef({
    acceptedQuote: input.acceptedQuote,
    amountRef: input.compiled.amountRef,
    currencies: input.currencies,
    currencyCodeById: input.currencyCodeById,
    workflow: input.workflow,
  });
  const counterAmount = await resolveAmountRef({
    acceptedQuote: input.acceptedQuote,
    amountRef: input.compiled.counterAmountRef,
    currencies: input.currencies,
    currencyCodeById: input.currencyCodeById,
    workflow: input.workflow,
  });
  const created = await input.treasuryModule.operations.commands.createOrGetPlanned(
    {
      amountMinor: amount.amountMinor,
      counterAmountMinor: counterAmount.amountMinor,
      counterCurrencyId: counterAmount.currencyId,
      currencyId: amount.currencyId,
      customerId: input.customerId,
      dealId: input.workflow.summary.id,
      id: randomUUID(),
      internalEntityOrganizationId: input.internalEntityOrganizationId,
      kind: input.compiled.operationKind,
      quoteId: input.compiled.quoteId,
      sourceRef: input.compiled.sourceRef,
    },
  );

  await input.dealStore.createDealLegOperationLinks([
    {
      dealLegId: input.compiled.legId,
      id: randomUUID(),
      operationKind: input.compiled.operationKind,
      sourceRef: input.compiled.sourceRef,
      treasuryOperationId: created.id,
    },
  ]);

  return created;
}

function buildCloseBlockers(input: {
  instructionByOperationId: ReadonlyMap<string, TreasuryInstruction>;
  workflow: DealWorkflowProjection;
}): DealTransitionBlocker[] {
  const blockers: DealTransitionBlocker[] = [];

  for (const leg of input.workflow.executionPlan) {
    if (leg.operationRefs.length === 0) {
      blockers.push({
        code: "execution_leg_not_done",
        message: `Execution leg ${leg.idx} does not have a linked treasury operation`,
      });
      continue;
    }

    for (const operationRef of leg.operationRefs) {
      const latestInstruction =
        input.instructionByOperationId.get(operationRef.operationId) ?? null;
      if (!latestInstruction) {
        blockers.push({
          code: "execution_leg_not_done",
          message: `Treasury instruction for leg ${leg.idx} is not prepared`,
        });
        continue;
      }

      if (!CLOSE_TERMINAL_INSTRUCTION_STATES.has(latestInstruction.state)) {
        blockers.push({
          code: "execution_leg_not_done",
          message: `Treasury instruction for leg ${leg.idx} is not in a terminal state`,
        });
      }
    }
  }

  return blockers;
}

function buildInstructionPrepareSourceRef(operationId: string) {
  return `operation:${operationId}:instruction:1`;
}

function buildInstructionRetrySourceRef(operationId: string, attempt: number) {
  return `operation:${operationId}:instruction:${attempt}`;
}

async function runIdempotent<TResult, TStoredResult extends Record<string, unknown>>(
  deps: DealExecutionWorkflowDeps,
  input: {
    actorUserId: string;
    handler: (txDeps: DealExecutionTxDeps) => Promise<TResult>;
    idempotencyKey: string;
    loadReplayResult: (txDeps: DealExecutionTxDeps, storedResult: TStoredResult | null) => Promise<TResult>;
    request: Record<string, unknown>;
    scope: string;
    serializeResult: (result: TResult) => TStoredResult;
  },
): Promise<TResult> {
  return deps.db.transaction(async (tx) => {
    const txDeps: DealExecutionTxDeps = {
      dealStore: deps.createDealStore(tx),
      dealsModule: deps.createDealsModule(tx),
      treasuryModule: deps.createTreasuryModule(tx),
    };

    return deps.idempotency.withIdempotencyTx({
      tx,
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      request: input.request,
      actorId: input.actorUserId,
      serializeResult: (result) => input.serializeResult(result as TResult),
      loadReplayResult: async ({ storedResult }) =>
        input.loadReplayResult(
          txDeps,
          (storedResult as TStoredResult | null | undefined) ?? null,
        ),
      handler: async () => input.handler(txDeps),
    });
  });
}

export function createDealExecutionWorkflow(deps: DealExecutionWorkflowDeps) {
  return {
    async requestExecution(input: {
      actorUserId: string;
      comment?: string | null;
      dealId: string;
      idempotencyKey: string;
    }): Promise<DealWorkflowProjection> {
      return runIdempotent(deps, {
        actorUserId: input.actorUserId,
        handler: async ({ dealStore, dealsModule, treasuryModule }) => {
          const workflow = await requireWorkflow(dealsModule, input.dealId);

          if (workflow.executionPlan.some((leg) => leg.operationRefs.length > 0)) {
            return workflow;
          }

          assertExecutionRequestAllowed(workflow);

          const recipeContext = await resolveRecipeContext(
            deps,
            treasuryModule,
            workflow,
          );
          const currencyCodeById = new Map<string, string>();
          const customerId = getCustomerId(workflow);
          const linkCountBefore = workflow.executionPlan.flatMap((leg) => leg.operationRefs)
            .length;

          for (const operation of recipeContext.recipe) {
            await materializeCompiledOperation({
              acceptedQuote: recipeContext.acceptedQuote,
              compiled: operation,
              currencies: deps.currencies,
              currencyCodeById,
              customerId,
              dealStore,
              internalEntityOrganizationId:
                recipeContext.internalEntityOrganizationId,
              treasuryModule,
              workflow,
            });
          }

          if (linkCountBefore === 0) {
            await dealStore.createDealTimelineEvents([
              buildTimelineEvent({
                actorUserId: input.actorUserId,
                dealId: workflow.summary.id,
                payload: {
                  comment: input.comment ?? null,
                  operationCount: recipeContext.recipe.length,
                },
                sourceRef: `execution:${workflow.summary.id}:request:${input.idempotencyKey}`,
                type: "execution_requested",
              }),
            ]);
          }

          return requireWorkflow(dealsModule, input.dealId);
        },
        idempotencyKey: input.idempotencyKey,
        loadReplayResult: async ({ dealsModule }, storedResult) => {
          const dealId = String(storedResult?.dealId ?? input.dealId);
          return requireWorkflow(dealsModule, dealId);
        },
        request: {
          comment: input.comment ?? null,
          dealId: input.dealId,
        },
        scope: DEAL_EXECUTION_REQUEST_SCOPE,
        serializeResult: (result) => ({ dealId: result.summary.id }),
      });
    },

    async createLegOperation(input: {
      actorUserId: string;
      comment?: string | null;
      dealId: string;
      idempotencyKey: string;
      legId: string;
    }): Promise<DealWorkflowProjection> {
      return runIdempotent(deps, {
        actorUserId: input.actorUserId,
        handler: async ({ dealStore, dealsModule, treasuryModule }) => {
          const workflow = await requireWorkflow(dealsModule, input.dealId);
          const leg = findLegById(workflow, input.legId);

          if (!leg) {
            throw new ValidationError(
              `Deal ${input.dealId} does not have execution leg ${input.legId}`,
            );
          }

          if (leg.operationRefs.length > 0) {
            return workflow;
          }

          assertExecutionRequestAllowed(workflow);

          const recipeContext = await resolveRecipeContext(
            deps,
            treasuryModule,
            workflow,
          );
          const compiled = recipeContext.recipe.find(
            (item) => item.legId === input.legId,
          );

          if (!compiled) {
            throw new ValidationError(
              `Deal ${input.dealId} does not have a materializable recipe for leg ${input.legId}`,
            );
          }

          const operation = await materializeCompiledOperation({
            acceptedQuote: recipeContext.acceptedQuote,
            compiled,
            currencies: deps.currencies,
            currencyCodeById: new Map<string, string>(),
            customerId: getCustomerId(workflow),
            dealStore,
            internalEntityOrganizationId:
              recipeContext.internalEntityOrganizationId,
            treasuryModule,
            workflow,
          });

          await dealStore.createDealTimelineEvents([
            buildTimelineEvent({
              actorUserId: input.actorUserId,
              dealId: workflow.summary.id,
              payload: {
                comment: input.comment ?? null,
                legId: compiled.legId,
                legIdx: compiled.legIdx,
                operationId: operation.id,
                operationKind: compiled.operationKind,
              },
              sourceRef: `execution:${workflow.summary.id}:leg:${compiled.legId}:operation:${input.idempotencyKey}`,
              type: "leg_operation_created",
            }),
          ]);

          return requireWorkflow(dealsModule, input.dealId);
        },
        idempotencyKey: input.idempotencyKey,
        loadReplayResult: async ({ dealsModule }, storedResult) => {
          const dealId = String(storedResult?.dealId ?? input.dealId);
          return requireWorkflow(dealsModule, dealId);
        },
        request: {
          comment: input.comment ?? null,
          dealId: input.dealId,
          legId: input.legId,
        },
        scope: DEAL_EXECUTION_CREATE_LEG_OPERATION_SCOPE,
        serializeResult: (result) => ({ dealId: result.summary.id }),
      });
    },

    async resolveExecutionBlocker(input: {
      actorUserId: string;
      capabilityKind?: DealCapabilityKind;
      comment?: string | null;
      dealId: string;
      idempotencyKey: string;
      legId?: string;
      target: "capability" | "leg";
    }): Promise<DealWorkflowProjection> {
      return runIdempotent(deps, {
        actorUserId: input.actorUserId,
        handler: async ({ dealStore, dealsModule }) => {
          const workflow = await requireWorkflow(dealsModule, input.dealId);

          if (input.target === "leg") {
            if (!input.legId) {
              throw new ValidationError("legId is required");
            }

            const leg = findLegById(workflow, input.legId);
            if (!leg) {
              throw new ValidationError(
                `Deal ${input.dealId} does not have execution leg ${input.legId}`,
              );
            }

            if (leg.state !== "blocked") {
              return workflow;
            }

            const updated = await dealsModule.deals.commands.updateLegState({
              actorUserId: input.actorUserId,
              comment: input.comment ?? null,
              dealId: input.dealId,
              idx: leg.idx,
              state: "ready",
            });

            await dealStore.createDealTimelineEvents([
              buildTimelineEvent({
                actorUserId: input.actorUserId,
                dealId: input.dealId,
                payload: {
                  comment: input.comment ?? null,
                  legId: leg.id,
                  legIdx: leg.idx,
                  target: "leg",
                },
                sourceRef: `execution:${input.dealId}:blocker:leg:${leg.id}:resolve:${input.idempotencyKey}`,
                type: "execution_blocker_resolved",
              }),
            ]);

            return updated;
          }

          if (!input.capabilityKind) {
            throw new ValidationError("capabilityKind is required");
          }

          const capability = workflow.operationalState.capabilities.find(
            (item) => item.kind === input.capabilityKind,
          );

          if (!capability) {
            throw new ValidationError(
              `Deal ${input.dealId} does not expose capability ${input.capabilityKind}`,
            );
          }

          if (capability.status === "enabled") {
            return workflow;
          }

          if (
            !capability.applicantCounterpartyId ||
            !capability.internalEntityOrganizationId
          ) {
            throw new ValidationError(
              `Capability ${capability.kind} is missing applicant or internal entity context`,
            );
          }

          await dealsModule.deals.commands.upsertCapabilityState({
            actorUserId: input.actorUserId,
            applicantCounterpartyId: capability.applicantCounterpartyId,
            capabilityKind: capability.kind,
            dealType: capability.dealType ?? workflow.summary.type,
            internalEntityOrganizationId:
              capability.internalEntityOrganizationId,
            note: input.comment ?? capability.note ?? null,
            reasonCode: null,
            status: "enabled",
          });

          await dealStore.createDealTimelineEvents([
            buildTimelineEvent({
              actorUserId: input.actorUserId,
              dealId: input.dealId,
              payload: {
                capabilityKind: capability.kind,
                comment: input.comment ?? null,
                target: "capability",
              },
              sourceRef: `execution:${input.dealId}:blocker:capability:${capability.kind}:resolve:${input.idempotencyKey}`,
              type: "execution_blocker_resolved",
            }),
          ]);

          return requireWorkflow(dealsModule, input.dealId);
        },
        idempotencyKey: input.idempotencyKey,
        loadReplayResult: async ({ dealsModule }, storedResult) => {
          const dealId = String(storedResult?.dealId ?? input.dealId);
          return requireWorkflow(dealsModule, dealId);
        },
        request: {
          capabilityKind: input.capabilityKind ?? null,
          comment: input.comment ?? null,
          dealId: input.dealId,
          legId: input.legId ?? null,
          target: input.target,
        },
        scope: DEAL_EXECUTION_RESOLVE_BLOCKER_SCOPE,
        serializeResult: (result) => ({ dealId: result.summary.id }),
      });
    },

    async prepareInstruction(input: {
      actorUserId: string;
      idempotencyKey: string;
      operationId: string;
      providerRef?: string | null;
      providerSnapshot?: Record<string, unknown> | null;
    }): Promise<OperationMutationResult> {
      return runIdempotent(deps, {
        actorUserId: input.actorUserId,
        handler: async ({ dealStore, dealsModule, treasuryModule }) => {
          const { operation, workflow } = await requireDealForOperation(
            treasuryModule,
            dealsModule,
            input.operationId,
          );
          const latestBefore =
            await treasuryModule.instructions.queries.findLatestByOperationId(
              input.operationId,
            );
          const instruction = await treasuryModule.instructions.commands.prepare({
            id: randomUUID(),
            operationId: input.operationId,
            providerRef: input.providerRef ?? null,
            providerSnapshot: input.providerSnapshot ?? null,
            sourceRef: buildInstructionPrepareSourceRef(input.operationId),
          });

          if (!latestBefore) {
            await dealStore.createDealTimelineEvents([
              buildTimelineEvent({
                actorUserId: input.actorUserId,
                dealId: workflow.summary.id,
                payload: {
                  attempt: instruction.attempt,
                  instructionId: instruction.id,
                  operationId: operation.id,
                },
                sourceRef: `execution:${workflow.summary.id}:instruction:${instruction.id}:prepared`,
                type: "instruction_prepared",
              }),
            ]);
          }

          return {
            dealId: workflow.summary.id,
            instructionId: instruction.id,
            operationId: operation.id,
          };
        },
        idempotencyKey: input.idempotencyKey,
        loadReplayResult: async ({ dealsModule, treasuryModule }, storedResult) => {
          const operationId = String(storedResult?.operationId ?? input.operationId);
          const operation = await treasuryModule.operations.queries.findById(
            operationId,
          );
          if (!operation?.dealId) {
            throw new ValidationError(
              `Treasury operation ${operationId} is not linked to a deal`,
            );
          }

          await requireWorkflow(dealsModule, operation.dealId);

          return {
            dealId: operation.dealId,
            instructionId:
              typeof storedResult?.instructionId === "string"
                ? storedResult.instructionId
                : null,
            operationId: operation.id,
          };
        },
        request: {
          operationId: input.operationId,
          providerRef: input.providerRef ?? null,
          providerSnapshot: input.providerSnapshot ?? null,
        },
        scope: DEAL_EXECUTION_PREPARE_INSTRUCTION_SCOPE,
        serializeResult: (result) => result,
      });
    },

    async submitInstruction(input: {
      actorUserId: string;
      idempotencyKey: string;
      instructionId: string;
      providerRef?: string | null;
      providerSnapshot?: Record<string, unknown> | null;
    }): Promise<OperationMutationResult> {
      return runIdempotent(deps, {
        actorUserId: input.actorUserId,
        handler: async ({ dealStore, dealsModule, treasuryModule }) => {
          const { instruction: existing, operation, workflow } =
            await requireInstructionForMutation(
              treasuryModule,
              dealsModule,
              input.instructionId,
            );
          const updated = await treasuryModule.instructions.commands.submit({
            instructionId: input.instructionId,
            providerRef: input.providerRef ?? null,
            providerSnapshot: input.providerSnapshot ?? null,
          });

          if (existing.state !== "submitted") {
            await dealStore.createDealTimelineEvents([
              buildTimelineEvent({
                actorUserId: input.actorUserId,
                dealId: workflow.summary.id,
                payload: {
                  attempt: updated.attempt,
                  instructionId: updated.id,
                  operationId: operation.id,
                },
                sourceRef: `execution:${workflow.summary.id}:instruction:${updated.id}:submitted`,
                type: "instruction_submitted",
              }),
            ]);
          }

          return {
            dealId: workflow.summary.id,
            instructionId: updated.id,
            operationId: operation.id,
          };
        },
        idempotencyKey: input.idempotencyKey,
        loadReplayResult: async ({ dealsModule, treasuryModule }, storedResult) => {
          const instructionId = String(
            storedResult?.instructionId ?? input.instructionId,
          );
          const { instruction, operation, workflow } =
            await requireInstructionForMutation(
              treasuryModule,
              dealsModule,
              instructionId,
            );

          return {
            dealId: workflow.summary.id,
            instructionId: instruction.id,
            operationId: operation.id,
          };
        },
        request: {
          instructionId: input.instructionId,
          providerRef: input.providerRef ?? null,
          providerSnapshot: input.providerSnapshot ?? null,
        },
        scope: DEAL_EXECUTION_SUBMIT_INSTRUCTION_SCOPE,
        serializeResult: (result) => result,
      });
    },

    async retryInstruction(input: {
      actorUserId: string;
      idempotencyKey: string;
      instructionId: string;
      providerRef?: string | null;
      providerSnapshot?: Record<string, unknown> | null;
    }): Promise<OperationMutationResult> {
      return runIdempotent(deps, {
        actorUserId: input.actorUserId,
        handler: async ({ dealStore, dealsModule, treasuryModule }) => {
          const { instruction: existing, operation, workflow } =
            await requireInstructionForMutation(
              treasuryModule,
              dealsModule,
              input.instructionId,
            );
          const retried = await treasuryModule.instructions.commands.retry({
            id: randomUUID(),
            operationId: operation.id,
            providerRef: input.providerRef ?? null,
            providerSnapshot: input.providerSnapshot ?? null,
            sourceRef: buildInstructionRetrySourceRef(
              operation.id,
              existing.attempt + 1,
            ),
          });

          if (retried.id !== existing.id) {
            await dealStore.createDealTimelineEvents([
              buildTimelineEvent({
                actorUserId: input.actorUserId,
                dealId: workflow.summary.id,
                payload: {
                  attempt: retried.attempt,
                  instructionId: retried.id,
                  operationId: operation.id,
                  previousInstructionId: existing.id,
                },
                sourceRef: `execution:${workflow.summary.id}:instruction:${retried.id}:retried`,
                type: "instruction_retried",
              }),
            ]);
          }

          return {
            dealId: workflow.summary.id,
            instructionId: retried.id,
            operationId: operation.id,
          };
        },
        idempotencyKey: input.idempotencyKey,
        loadReplayResult: async ({ dealsModule, treasuryModule }, storedResult) => {
          const instructionId = String(
            storedResult?.instructionId ?? input.instructionId,
          );
          const { instruction, operation, workflow } =
            await requireInstructionForMutation(
              treasuryModule,
              dealsModule,
              instructionId,
            );

          return {
            dealId: workflow.summary.id,
            instructionId: instruction.id,
            operationId: operation.id,
          };
        },
        request: {
          instructionId: input.instructionId,
          providerRef: input.providerRef ?? null,
          providerSnapshot: input.providerSnapshot ?? null,
        },
        scope: DEAL_EXECUTION_RETRY_INSTRUCTION_SCOPE,
        serializeResult: (result) => result,
      });
    },

    async voidInstruction(input: {
      actorUserId: string;
      idempotencyKey: string;
      instructionId: string;
      providerRef?: string | null;
      providerSnapshot?: Record<string, unknown> | null;
    }): Promise<OperationMutationResult> {
      return runIdempotent(deps, {
        actorUserId: input.actorUserId,
        handler: async ({ dealStore, dealsModule, treasuryModule }) => {
          const { instruction: existing, operation, workflow } =
            await requireInstructionForMutation(
              treasuryModule,
              dealsModule,
              input.instructionId,
            );
          const updated = await treasuryModule.instructions.commands.void({
            instructionId: input.instructionId,
            providerRef: input.providerRef ?? null,
            providerSnapshot: input.providerSnapshot ?? null,
          });

          if (existing.state !== "voided") {
            await dealStore.createDealTimelineEvents([
              buildTimelineEvent({
                actorUserId: input.actorUserId,
                dealId: workflow.summary.id,
                payload: {
                  attempt: updated.attempt,
                  instructionId: updated.id,
                  operationId: operation.id,
                },
                sourceRef: `execution:${workflow.summary.id}:instruction:${updated.id}:voided`,
                type: "instruction_voided",
              }),
            ]);
          }

          return {
            dealId: workflow.summary.id,
            instructionId: updated.id,
            operationId: operation.id,
          };
        },
        idempotencyKey: input.idempotencyKey,
        loadReplayResult: async ({ dealsModule, treasuryModule }, storedResult) => {
          const instructionId = String(
            storedResult?.instructionId ?? input.instructionId,
          );
          const { instruction, operation, workflow } =
            await requireInstructionForMutation(
              treasuryModule,
              dealsModule,
              instructionId,
            );

          return {
            dealId: workflow.summary.id,
            instructionId: instruction.id,
            operationId: operation.id,
          };
        },
        request: {
          instructionId: input.instructionId,
          providerRef: input.providerRef ?? null,
          providerSnapshot: input.providerSnapshot ?? null,
        },
        scope: DEAL_EXECUTION_VOID_INSTRUCTION_SCOPE,
        serializeResult: (result) => result,
      });
    },

    async requestReturn(input: {
      actorUserId: string;
      idempotencyKey: string;
      instructionId: string;
      providerRef?: string | null;
      providerSnapshot?: Record<string, unknown> | null;
    }): Promise<OperationMutationResult> {
      return runIdempotent(deps, {
        actorUserId: input.actorUserId,
        handler: async ({ dealStore, dealsModule, treasuryModule }) => {
          const { instruction: existing, operation, workflow } =
            await requireInstructionForMutation(
              treasuryModule,
              dealsModule,
              input.instructionId,
            );
          const updated = await treasuryModule.instructions.commands.requestReturn({
            instructionId: input.instructionId,
            providerRef: input.providerRef ?? null,
            providerSnapshot: input.providerSnapshot ?? null,
          });

          if (existing.state !== "return_requested") {
            await dealStore.createDealTimelineEvents([
              buildTimelineEvent({
                actorUserId: input.actorUserId,
                dealId: workflow.summary.id,
                payload: {
                  attempt: updated.attempt,
                  instructionId: updated.id,
                  operationId: operation.id,
                },
                sourceRef: `execution:${workflow.summary.id}:instruction:${updated.id}:return-requested`,
                type: "return_requested",
              }),
            ]);
          }

          return {
            dealId: workflow.summary.id,
            instructionId: updated.id,
            operationId: operation.id,
          };
        },
        idempotencyKey: input.idempotencyKey,
        loadReplayResult: async ({ dealsModule, treasuryModule }, storedResult) => {
          const instructionId = String(
            storedResult?.instructionId ?? input.instructionId,
          );
          const { instruction, operation, workflow } =
            await requireInstructionForMutation(
              treasuryModule,
              dealsModule,
              instructionId,
            );

          return {
            dealId: workflow.summary.id,
            instructionId: instruction.id,
            operationId: operation.id,
          };
        },
        request: {
          instructionId: input.instructionId,
          providerRef: input.providerRef ?? null,
          providerSnapshot: input.providerSnapshot ?? null,
        },
        scope: DEAL_EXECUTION_REQUEST_RETURN_SCOPE,
        serializeResult: (result) => result,
      });
    },

    async recordInstructionOutcome(input: {
      actorUserId: string;
      idempotencyKey: string;
      instructionId: string;
      outcome: TreasuryInstructionOutcome;
      providerRef?: string | null;
      providerSnapshot?: Record<string, unknown> | null;
    }): Promise<OperationMutationResult> {
      return runIdempotent(deps, {
        actorUserId: input.actorUserId,
        handler: async ({ dealStore, dealsModule, treasuryModule }) => {
          const { instruction: existing, operation, workflow } =
            await requireInstructionForMutation(
              treasuryModule,
              dealsModule,
              input.instructionId,
            );
          const updated = await treasuryModule.instructions.commands.recordOutcome({
            instructionId: input.instructionId,
            outcome: input.outcome,
            providerRef: input.providerRef ?? null,
            providerSnapshot: input.providerSnapshot ?? null,
          });

          if (existing.state !== updated.state) {
            const typeByOutcome: Record<
              TreasuryInstructionOutcome,
              ExecutionLifecycleEventType
            > = {
              failed: "instruction_failed",
              returned: "instruction_returned",
              settled: "instruction_settled",
            };

            await dealStore.createDealTimelineEvents([
              buildTimelineEvent({
                actorUserId: input.actorUserId,
                dealId: workflow.summary.id,
                payload: {
                  attempt: updated.attempt,
                  instructionId: updated.id,
                  operationId: operation.id,
                  outcome: updated.state,
                },
                sourceRef: `execution:${workflow.summary.id}:instruction:${updated.id}:outcome:${updated.state}`,
                type: typeByOutcome[input.outcome],
              }),
            ]);
          }

          return {
            dealId: workflow.summary.id,
            instructionId: updated.id,
            operationId: operation.id,
          };
        },
        idempotencyKey: input.idempotencyKey,
        loadReplayResult: async ({ dealsModule, treasuryModule }, storedResult) => {
          const instructionId = String(
            storedResult?.instructionId ?? input.instructionId,
          );
          const { instruction, operation, workflow } =
            await requireInstructionForMutation(
              treasuryModule,
              dealsModule,
              instructionId,
            );

          return {
            dealId: workflow.summary.id,
            instructionId: instruction.id,
            operationId: operation.id,
          };
        },
        request: {
          instructionId: input.instructionId,
          outcome: input.outcome,
          providerRef: input.providerRef ?? null,
          providerSnapshot: input.providerSnapshot ?? null,
        },
        scope: DEAL_EXECUTION_RECORD_OUTCOME_SCOPE,
        serializeResult: (result) => result,
      });
    },

    async closeDeal(input: {
      actorUserId: string;
      comment?: string | null;
      dealId: string;
      idempotencyKey: string;
    }): Promise<DealWorkflowProjection> {
      return runIdempotent(deps, {
        actorUserId: input.actorUserId,
        handler: async ({ dealStore, dealsModule, treasuryModule }) => {
          const workflow = await requireWorkflow(dealsModule, input.dealId);

          if (workflow.summary.status === "done") {
            return workflow;
          }

          const linkedOperationIds = getAllLinkedOperationIds(workflow);
          const latestInstructions =
            await treasuryModule.instructions.queries.listLatestByOperationIds(
              linkedOperationIds,
            );
          const instructionByOperationId = new Map(
            latestInstructions.map((instruction) => [
              instruction.operationId,
              instruction,
            ] as const),
          );
          const lifecycleBlockers = buildCloseBlockers({
            instructionByOperationId,
            workflow,
          });

          if (lifecycleBlockers.length > 0) {
            throw new DealTransitionBlockedError("done", lifecycleBlockers);
          }

          const readiness = workflow.transitionReadiness.find(
            (item) => item.targetStatus === "done",
          );
          if (readiness && !readiness.allowed) {
            throw new DealTransitionBlockedError("done", readiness.blockers);
          }

          const updated = await dealsModule.deals.commands.transitionStatus({
            actorUserId: input.actorUserId,
            comment: input.comment ?? null,
            dealId: input.dealId,
            status: "done",
          });

          await dealStore.createDealTimelineEvents([
            buildTimelineEvent({
              actorUserId: input.actorUserId,
              dealId: input.dealId,
              payload: {
                comment: input.comment ?? null,
                instructionCount: latestInstructions.length,
              },
              sourceRef: `execution:${input.dealId}:close:${input.idempotencyKey}`,
              type: "deal_closed",
            }),
          ]);

          return updated.summary.status === "done"
            ? updated
            : requireWorkflow(dealsModule, input.dealId);
        },
        idempotencyKey: input.idempotencyKey,
        loadReplayResult: async ({ dealsModule }, storedResult) => {
          const dealId = String(storedResult?.dealId ?? input.dealId);
          return requireWorkflow(dealsModule, dealId);
        },
        request: {
          comment: input.comment ?? null,
          dealId: input.dealId,
        },
        scope: DEAL_EXECUTION_CLOSE_SCOPE,
        serializeResult: (result) => ({ dealId: result.summary.id }),
      });
    },
  };
}

export type DealExecutionWorkflow = ReturnType<
  typeof createDealExecutionWorkflow
>;
