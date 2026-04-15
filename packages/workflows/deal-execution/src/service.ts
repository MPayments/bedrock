import { randomUUID } from "node:crypto";

import type { AgreementsModule } from "@bedrock/agreements";
import type { CurrenciesService } from "@bedrock/currencies";
import {
  DealNotFoundError,
  DealTransitionBlockedError,
  type DealsModule,
} from "@bedrock/deals";
import type {
  DealRouteVersion,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import type { ReconciliationService } from "@bedrock/reconciliation";
import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";
import { toMinorAmountString } from "@bedrock/shared/money";
import type { TreasuryModule } from "@bedrock/treasury";
import type {
  TreasuryInstructionOutcome,
  TreasuryOperationKind,
} from "@bedrock/treasury/contracts";
import { deriveFinanceDealReadiness } from "@bedrock/workflow-deal-projections";

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
const TREASURY_INSTRUCTION_OUTCOMES_RECONCILIATION_SOURCE =
  "treasury_instruction_outcomes";

const EXECUTION_REQUESTABLE_STATUSES = new Set([
  "approved_for_execution",
  "executing",
  "partially_executed",
]);
type ExecutionLifecycleEventType =
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

export type DealExecutionAmountRef =
  | "accepted_calculation_source"
  | "accepted_calculation_target"
  | "incoming_receipt_expected"
  | "money_request_source";

export interface CompiledDealExecutionOperation {
  amountCurrencyId: string | null;
  amountMinor: bigint | null;
  amountRef: DealExecutionAmountRef | null;
  counterAmountMinor: bigint | null;
  counterCurrencyId: string | null;
  counterAmountRef: DealExecutionAmountRef | null;
  legId: string;
  legIdx: number;
  legKind: DealWorkflowProjection["executionPlan"][number]["kind"];
  operationKind: TreasuryOperationKind;
  quoteId: string | null;
  routeLegId: string | null;
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
  reconciliation: Pick<ReconciliationService, "links" | "records">;
  treasuryModule: Pick<TreasuryModule, "instructions" | "operations" | "quotes">;
}

type DealExecutionCalculationRecord = {
  currentSnapshot: {
    baseCurrencyId: string | null;
    calculationCurrencyId: string | null;
    fxQuoteId: string | null;
    originalAmountMinor: string | null;
    routeSnapshot: unknown;
    state: string | null;
    totalInBaseMinor: string | null;
  } | null;
};

type DealExecutionCalculationsDeps = {
  calculations: {
    queries: {
      findById(id: string): Promise<DealExecutionCalculationRecord | null>;
    };
  };
};

export interface DealExecutionWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  calculations?: DealExecutionCalculationsDeps;
  currencies: Pick<CurrenciesService, "findById">;
  db: Database;
  idempotency: IdempotencyPort;
  createDealStore(tx: Transaction): DealExecutionStore;
  createDealsModule(tx: Transaction): Pick<DealsModule, "deals">;
  createReconciliationService(
    tx: Transaction,
  ): Pick<ReconciliationService, "links" | "records">;
  createTreasuryModule(tx: Transaction): Pick<
    TreasuryModule,
    "instructions" | "operations" | "quotes"
  >;
}

type ExecutionRouteLegSnapshot = Pick<
  DealRouteVersion["legs"][number],
  | "code"
  | "expectedFromAmountMinor"
  | "expectedToAmountMinor"
  | "fromCurrencyId"
  | "id"
  | "idx"
  | "kind"
  | "toCurrencyId"
>;

type ExecutionRouteSnapshot = {
  id: string | null;
  legs: readonly ExecutionRouteLegSnapshot[];
  routeId: string | null;
  version: number | null;
};

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
    return "accepted_calculation_target";
  }

  return "money_request_source";
}

function normalizeRouteSnapshotLeg(
  value: unknown,
): ExecutionRouteLegSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.id !== "string" ||
    typeof row.code !== "string" ||
    typeof row.idx !== "number" ||
    typeof row.kind !== "string" ||
    typeof row.fromCurrencyId !== "string" ||
    typeof row.toCurrencyId !== "string"
  ) {
    return null;
  }

  if (
    row.kind !== "collection" &&
    row.kind !== "intracompany_transfer" &&
    row.kind !== "intercompany_funding" &&
    row.kind !== "fx_conversion" &&
    row.kind !== "payout" &&
    row.kind !== "return" &&
    row.kind !== "adjustment"
  ) {
    return null;
  }

  return {
    code: row.code,
    expectedFromAmountMinor:
      typeof row.expectedFromAmountMinor === "string"
        ? row.expectedFromAmountMinor
        : null,
    expectedToAmountMinor:
      typeof row.expectedToAmountMinor === "string"
        ? row.expectedToAmountMinor
        : null,
    fromCurrencyId: row.fromCurrencyId,
    id: row.id,
    idx: row.idx,
    kind: row.kind,
    toCurrencyId: row.toCurrencyId,
  };
}

function normalizeExecutionRouteSnapshot(
  value: unknown,
): ExecutionRouteSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const legs = Array.isArray(row.legs)
    ? row.legs
        .map((leg) => normalizeRouteSnapshotLeg(leg))
        .filter((leg): leg is ExecutionRouteLegSnapshot => leg !== null)
    : [];

  if (legs.length === 0) {
    return null;
  }

  return {
    id: typeof row.id === "string" ? row.id : null,
    legs: legs.sort((left, right) => left.idx - right.idx),
    routeId: typeof row.routeId === "string" ? row.routeId : null,
    version: typeof row.version === "number" ? row.version : null,
  };
}

function routeSnapshotFromDealRoute(
  route: DealRouteVersion | null,
): ExecutionRouteSnapshot | null {
  if (!route) {
    return null;
  }

  return {
    id: route.id,
    legs: [...route.legs].sort((left, right) => left.idx - right.idx),
    routeId: route.routeId,
    version: route.version,
  };
}

function hasRouteFxLeg(route: ExecutionRouteSnapshot) {
  return route.legs.some((leg) => leg.kind === "fx_conversion");
}

function resolveLegacyLinkTargetForRouteLeg(input: {
  routeLeg: ExecutionRouteLegSnapshot;
  workflow: DealWorkflowProjection;
}): DealWorkflowProjection["executionPlan"][number] {
  const findByKind = (
    kind: DealWorkflowProjection["executionPlan"][number]["kind"],
  ) => input.workflow.executionPlan.find((leg) => leg.kind === kind) ?? null;

  switch (input.routeLeg.kind) {
    case "collection": {
      const target = findByKind("collect");

      if (!target) {
        throw new ValidationError(
          `Deal ${input.workflow.summary.id} is missing a collect execution leg for route leg ${input.routeLeg.id}`,
        );
      }

      return target;
    }
    case "fx_conversion": {
      const target = findByKind("convert");

      if (!target) {
        throw new ValidationError(
          `Deal ${input.workflow.summary.id} is missing a convert execution leg for route leg ${input.routeLeg.id}`,
        );
      }

      return target;
    }
    case "payout": {
      const target = findByKind("payout");

      if (!target) {
        throw new ValidationError(
          `Deal ${input.workflow.summary.id} is missing a payout execution leg for route leg ${input.routeLeg.id}`,
        );
      }

      return target;
    }
    case "intracompany_transfer":
    case "intercompany_funding": {
      const target =
        findByKind("transit_hold") ??
        findByKind("settle_exporter") ??
        findByKind("payout");

      if (!target) {
        throw new ValidationError(
          `Deal ${input.workflow.summary.id} has no compatible execution leg bucket for route leg ${input.routeLeg.id}`,
        );
      }

      return target;
    }
    case "return":
    case "adjustment":
      throw new ValidationError(
        `Route leg kind ${input.routeLeg.kind} is not yet supported by execution materialization`,
      );
  }
}

function resolveRouteFallbackAmountRef(input: {
  route: ExecutionRouteSnapshot;
  routeLeg: ExecutionRouteLegSnapshot;
  workflow: DealWorkflowProjection;
}): DealExecutionAmountRef | null {
  switch (input.routeLeg.kind) {
    case "collection":
      return input.workflow.summary.type === "exporter_settlement"
        ? "incoming_receipt_expected"
        : "money_request_source";
    case "fx_conversion":
      return "accepted_calculation_source";
    case "payout":
      return resolvePayoutAmountRef(input.workflow);
    case "intracompany_transfer":
    case "intercompany_funding":
      return input.workflow.summary.type === "exporter_settlement"
        ? hasRouteFxLeg(input.route)
          ? "accepted_calculation_target"
          : "incoming_receipt_expected"
        : hasRouteFxLeg(input.route)
          ? "accepted_calculation_target"
          : "money_request_source";
    case "return":
    case "adjustment":
      return null;
  }
}

function resolveRouteOperationKind(
  routeLeg: ExecutionRouteLegSnapshot,
): TreasuryOperationKind {
  switch (routeLeg.kind) {
    case "collection":
      return "payin";
    case "fx_conversion":
      return "fx_conversion";
    case "payout":
      return "payout";
    case "intracompany_transfer":
      return "intracompany_transfer";
    case "intercompany_funding":
      return "intercompany_funding";
    case "return":
    case "adjustment":
      throw new ValidationError(
        `Route leg kind ${routeLeg.kind} is not supported by treasury operations`,
      );
  }
}

export function compileRouteExecutionRecipe(input: {
  currentCalculation: DealExecutionCalculationRecord | null;
  route: ExecutionRouteSnapshot;
  workflow: DealWorkflowProjection;
}): CompiledDealExecutionOperation[] {
  return input.route.legs.map((routeLeg) => {
    const linkTarget = resolveLegacyLinkTargetForRouteLeg({
      routeLeg,
      workflow: input.workflow,
    });
    const operationKind = resolveRouteOperationKind(routeLeg);
    const amountMinor =
      routeLeg.expectedFromAmountMinor !== null
        ? BigInt(routeLeg.expectedFromAmountMinor)
        : null;
    const counterAmountMinor =
      routeLeg.kind === "fx_conversion" && routeLeg.expectedToAmountMinor !== null
        ? BigInt(routeLeg.expectedToAmountMinor)
        : null;

    return {
      amountCurrencyId: routeLeg.fromCurrencyId,
      amountMinor,
      amountRef:
        amountMinor !== null
          ? null
          : resolveRouteFallbackAmountRef({
              route: input.route,
              routeLeg,
              workflow: input.workflow,
            }),
      counterAmountMinor,
      counterAmountRef:
        routeLeg.kind === "fx_conversion" && counterAmountMinor === null
          ? "accepted_calculation_target"
          : null,
      counterCurrencyId:
        routeLeg.kind === "fx_conversion" ? routeLeg.toCurrencyId : null,
      legId: linkTarget.id ?? routeLeg.id,
      legIdx: linkTarget.idx,
      legKind: linkTarget.kind,
      operationKind,
      quoteId:
        routeLeg.kind === "fx_conversion"
          ? (input.currentCalculation?.currentSnapshot?.fxQuoteId ?? null)
          : null,
      routeLegId: routeLeg.id,
      sourceRef: `deal:${input.workflow.summary.id}:route-leg:${routeLeg.id}:${operationKind}:1`,
    };
  });
}

export function compileDealExecutionRecipe(input: {
  currentCalculation: DealExecutionCalculationRecord | null;
  agreementOrganizationId: string | null;
  internalEntityOrganizationId: string | null;
  workflow: DealWorkflowProjection;
}): CompiledDealExecutionOperation[] {
  const hasConvert = input.workflow.executionPlan.some(
    (leg) => leg.kind === "convert",
  );

  if (hasConvert && input.currentCalculation?.currentSnapshot?.state !== "accepted") {
    throw new ValidationError(
      `Deal ${input.workflow.summary.id} requires an accepted calculation for execution`,
    );
  }

  return input.workflow.executionPlan
    .filter((leg) => leg.state !== "skipped")
    .map((leg) => {
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
        amountRef = "accepted_calculation_source";
        counterAmountRef = "accepted_calculation_target";
        quoteId = input.currentCalculation?.currentSnapshot?.fxQuoteId ?? null;
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
              ? "accepted_calculation_target"
              : "incoming_receipt_expected"
            : hasConvert
              ? "accepted_calculation_target"
              : "money_request_source";
        break;
    }

    return {
      amountCurrencyId: null,
      amountMinor: null,
      amountRef,
      counterAmountMinor: null,
      counterCurrencyId: null,
      counterAmountRef,
      legId: leg.id,
      legIdx: leg.idx,
      legKind: leg.kind,
      operationKind,
      quoteId,
      routeLegId: null,
      sourceRef: `deal:${input.workflow.summary.id}:leg:${leg.idx}:${operationKind}:1`,
    };
    });
}

async function resolveAmountRef(input: {
  amountRef: DealExecutionAmountRef | null;
  currentCalculation: DealExecutionCalculationRecord | null;
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

  if (input.amountRef === "accepted_calculation_source") {
    if (input.currentCalculation?.currentSnapshot?.state !== "accepted") {
      throw new ValidationError("Accepted calculation snapshot is required");
    }

    return {
      amountMinor: input.currentCalculation.currentSnapshot.originalAmountMinor
        ? BigInt(input.currentCalculation.currentSnapshot.originalAmountMinor)
        : null,
      currencyId: input.currentCalculation.currentSnapshot.calculationCurrencyId,
    };
  }

  if (input.amountRef === "accepted_calculation_target") {
    if (input.currentCalculation?.currentSnapshot?.state !== "accepted") {
      throw new ValidationError("Accepted calculation snapshot is required");
    }

    return {
      amountMinor: input.currentCalculation.currentSnapshot.totalInBaseMinor
        ? BigInt(input.currentCalculation.currentSnapshot.totalInBaseMinor)
        : null,
      currencyId: input.currentCalculation.currentSnapshot.baseCurrencyId,
    };
  }

  const rawAmount =
    input.amountRef === "money_request_source"
      ? input.workflow.header.moneyRequest.sourceAmount
      : input.workflow.header.incomingReceipt.expectedAmount;
  const currencyId =
    input.amountRef === "money_request_source"
      ? input.workflow.header.moneyRequest.sourceCurrencyId
      : input.workflow.header.incomingReceipt.expectedCurrencyId;

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
    (item) => item.targetStatus === "approved_for_execution",
  );

  if (readiness?.allowed) {
    return;
  }

  throw new DealTransitionBlockedError(
    "approved_for_execution",
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
  dealsModule: Pick<DealsModule, "deals">,
  workflow: DealWorkflowProjection,
) {
  const currentCalculationId =
    workflow.acceptedCalculation?.calculationId ?? workflow.summary.calculationId;
  const currentCalculation =
    deps.calculations &&
    currentCalculationId
      ? await deps.calculations.calculations.queries.findById(
          currentCalculationId,
        )
      : null;
  const acceptedRoute =
    currentCalculation?.currentSnapshot?.state === "accepted"
      ? normalizeExecutionRouteSnapshot(
          currentCalculation.currentSnapshot?.routeSnapshot,
        )
      : null;
  const currentRoute =
    acceptedRoute ??
    routeSnapshotFromDealRoute(
      (await dealsModule.deals.queries.findCurrentRouteByDealId?.(
        workflow.summary.id,
      )) ?? null,
    );

  if (currentRoute) {
    return {
      currentCalculation,
      internalEntityOrganizationId: getInternalEntityOrganizationId(workflow),
      recipe: compileRouteExecutionRecipe({
        currentCalculation,
        route: currentRoute,
        workflow,
      }),
    };
  }

  const agreement = await deps.agreements.agreements.queries.findById(
    workflow.summary.agreementId,
  );

  return {
    currentCalculation,
    internalEntityOrganizationId: getInternalEntityOrganizationId(workflow),
    recipe: compileDealExecutionRecipe({
      currentCalculation,
      agreementOrganizationId: agreement?.organizationId ?? null,
      internalEntityOrganizationId: getInternalEntityOrganizationId(workflow),
      workflow,
    }),
  };
}

async function materializeCompiledOperation(input: {
  compiled: CompiledDealExecutionOperation;
  currentCalculation: DealExecutionCalculationRecord | null;
  currencies: DealExecutionWorkflowDeps["currencies"];
  currencyCodeById: Map<string, string>;
  customerId: string | null;
  dealStore: DealExecutionStore;
  internalEntityOrganizationId: string | null;
  treasuryModule: Pick<TreasuryModule, "instructions" | "operations" | "quotes">;
  workflow: DealWorkflowProjection;
}) {
  const amount =
    input.compiled.amountMinor !== null || input.compiled.amountCurrencyId !== null
      ? {
          amountMinor: input.compiled.amountMinor,
          currencyId: input.compiled.amountCurrencyId,
        }
      : await resolveAmountRef({
          amountRef: input.compiled.amountRef,
          currentCalculation: input.currentCalculation,
          currencies: input.currencies,
          currencyCodeById: input.currencyCodeById,
          workflow: input.workflow,
        });
  const counterAmount =
    input.compiled.counterAmountMinor !== null ||
    input.compiled.counterCurrencyId !== null
      ? {
          amountMinor: input.compiled.counterAmountMinor,
          currencyId: input.compiled.counterCurrencyId,
        }
      : await resolveAmountRef({
          amountRef: input.compiled.counterAmountRef,
          currentCalculation: input.currentCalculation,
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
      routeLegId: input.compiled.routeLegId,
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

function buildInstructionPrepareSourceRef(operationId: string) {
  return `operation:${operationId}:instruction:1`;
}

function buildInstructionRetrySourceRef(operationId: string, attempt: number) {
  return `operation:${operationId}:instruction:${attempt}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function findNestedValueByKeys(
  value: unknown,
  keys: readonly string[],
  seen = new Set<object>(),
): unknown | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findNestedValueByKeys(item, keys, seen);

      if (nested !== null && nested !== undefined) {
        return nested;
      }
    }

    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }

  seen.add(value);

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const candidate = record[key];

    if (candidate !== null && candidate !== undefined) {
      return candidate;
    }
  }

  for (const nested of Object.values(record)) {
    const candidate = findNestedValueByKeys(nested, keys, seen);

    if (candidate !== null && candidate !== undefined) {
      return candidate;
    }
  }

  return null;
}

function parseBigIntLike(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value);
  }

  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }

  return null;
}

function parseUuidLike(value: unknown): string | null {
  return typeof value === "string" && isUuid(value) ? value : null;
}

async function ingestTreasuryInstructionOutcomeFact(input: {
  instruction: Awaited<
    ReturnType<TreasuryModule["instructions"]["queries"]["findById"]>
  >;
  operation: Awaited<
    ReturnType<TreasuryModule["operations"]["queries"]["findById"]>
  >;
  treasuryModule: Pick<TreasuryModule, "operations">;
  workflow: DealWorkflowProjection;
}) {
  if (!input.instruction || !input.operation) {
    return;
  }

  if (
    input.instruction.state !== "settled" &&
    input.instruction.state !== "returned" &&
    input.instruction.state !== "failed"
  ) {
    return;
  }

  const snapshot = input.instruction.providerSnapshot;
  const amountMinor =
    parseBigIntLike(
      findNestedValueByKeys(snapshot, [
        "settledAmountMinor",
        "returnedAmountMinor",
        "executedAmountMinor",
        "amountMinor",
      ]),
    ) ?? null;
  const counterAmountMinor =
    parseBigIntLike(
      findNestedValueByKeys(snapshot, [
        "counterAmountMinor",
        "receivedAmountMinor",
        "convertedAmountMinor",
      ]),
    ) ?? null;
  const feeAmountMinor =
    parseBigIntLike(
      findNestedValueByKeys(snapshot, [
        "feeAmountMinor",
        "providerFeeMinor",
        "commissionMinor",
        "chargesMinor",
      ]),
    ) ?? null;
  const currencyId =
    parseUuidLike(
      findNestedValueByKeys(snapshot, [
        "currencyId",
        "amountCurrencyId",
        "settledCurrencyId",
      ]),
    ) ?? input.operation.currencyId;
  const counterCurrencyId =
    parseUuidLike(
      findNestedValueByKeys(snapshot, [
        "counterCurrencyId",
        "receivedCurrencyId",
      ]),
    ) ?? input.operation.counterCurrencyId;
  const feeCurrencyId =
    parseUuidLike(
      findNestedValueByKeys(snapshot, [
        "feeCurrencyId",
        "providerFeeCurrencyId",
        "commissionCurrencyId",
      ]),
    ) ?? input.operation.currencyId;
  const confirmedAt =
    input.instruction.settledAt ??
    input.instruction.returnedAt ??
    input.instruction.failedAt ??
    input.instruction.updatedAt;
  const sourceKind =
    input.instruction.providerSnapshot || input.instruction.providerRef
      ? "provider"
      : "system";
  const externalRecordId =
    (findNestedValueByKeys(snapshot, [
      "externalRecordId",
      "sourceRecordId",
      "recordId",
      "providerRecordId",
      "externalId",
    ]) as string | null) ?? null;
  const metadata = {
    instructionState: input.instruction.state,
    providerSnapshot: input.instruction.providerSnapshot,
  };
  const calculationSnapshotId = input.workflow.acceptedCalculation?.snapshotId ?? null;
  const routeVersionId = input.workflow.acceptedCalculation?.routeVersionId ?? null;
  const sourceRefBase = `treasury-instruction-outcome:${input.instruction.id}:${input.instruction.state}`;

  if (
    input.operation.kind === "fx_conversion" &&
    (amountMinor !== null || counterAmountMinor !== null)
  ) {
    await input.treasuryModule.operations.commands.recordExecutionFill({
      actualRateDen: amountMinor,
      actualRateNum: counterAmountMinor,
      boughtAmountMinor: counterAmountMinor,
      boughtCurrencyId: counterCurrencyId,
      calculationSnapshotId,
      confirmedAt,
      executedAt: confirmedAt,
      externalRecordId,
      fillSequence: null,
      instructionId: input.instruction.id,
      metadata,
      notes: `Instruction outcome: ${input.instruction.state}`,
      operationId: input.operation.id,
      providerCounterpartyId: null,
      providerRef: input.instruction.providerRef,
      routeLegId: input.operation.routeLegId,
      routeVersionId,
      soldAmountMinor: amountMinor,
      soldCurrencyId: currencyId,
      sourceKind,
      sourceRef: `${sourceRefBase}:fill`,
    });
  } else if (amountMinor !== null || currencyId) {
    await input.treasuryModule.operations.commands.recordCashMovement({
      accountRef: null,
      amountMinor,
      bookedAt: confirmedAt,
      calculationSnapshotId,
      confirmedAt,
      currencyId,
      direction: input.operation.kind === "payin" ? "credit" : "debit",
      externalRecordId,
      instructionId: input.instruction.id,
      metadata,
      notes: `Instruction outcome: ${input.instruction.state}`,
      operationId: input.operation.id,
      providerCounterpartyId: null,
      providerRef: input.instruction.providerRef,
      requisiteId: null,
      routeLegId: input.operation.routeLegId,
      routeVersionId,
      sourceKind,
      sourceRef: `${sourceRefBase}:cash`,
      statementRef: null,
      valueDate: confirmedAt,
    });
  }

  if (feeAmountMinor !== null) {
    await input.treasuryModule.operations.commands.recordExecutionFee({
      amountMinor: feeAmountMinor,
      calculationSnapshotId,
      chargedAt: confirmedAt,
      componentCode: null,
      confirmedAt,
      currencyId: feeCurrencyId,
      externalRecordId,
      feeFamily: "provider_fee",
      fillId: null,
      instructionId: input.instruction.id,
      metadata,
      notes: `Instruction outcome: ${input.instruction.state}`,
      operationId: input.operation.id,
      providerCounterpartyId: null,
      providerRef: input.instruction.providerRef,
      routeComponentId: null,
      routeLegId: input.operation.routeLegId,
      routeVersionId,
      sourceKind,
      sourceRef: `${sourceRefBase}:fee`,
    });
  }
}

async function ingestTreasuryOutcomeReconciliationRecord(input: {
  actorUserId: string;
  dealId: string;
  instruction: Awaited<
    ReturnType<TreasuryModule["instructions"]["queries"]["findById"]>
  >;
  operation: Awaited<
    ReturnType<TreasuryModule["operations"]["queries"]["findById"]>
  >;
  reconciliation: Pick<ReconciliationService, "records">;
}) {
  if (!input.instruction || !input.operation) {
    return;
  }

  if (
    input.instruction.state !== "settled" &&
    input.instruction.state !== "returned"
  ) {
    return;
  }

  await input.reconciliation.records.ingestExternalRecord({
    source: TREASURY_INSTRUCTION_OUTCOMES_RECONCILIATION_SOURCE,
    sourceRecordId: `${input.instruction.id}:${input.instruction.state}`,
    rawPayload: {
      dealId: input.dealId,
      instructionId: input.instruction.id,
      instructionState: input.instruction.state,
      operationId: input.operation.id,
      operationKind: input.operation.kind,
      providerRef: input.instruction.providerRef,
      providerSnapshot: input.instruction.providerSnapshot,
    },
    normalizedPayload: {
      dealId: input.dealId,
      instructionId: input.instruction.id,
      instructionState: input.instruction.state,
      operationId: input.operation.id,
      operationKind: "treasury",
      skipExecutionFactNormalization: true,
      treasuryOperationKind: input.operation.kind,
    },
    normalizationVersion: 1,
    actorUserId: input.actorUserId,
    idempotencyKey: `reconciliation:auto:${input.instruction.id}:${input.instruction.state}`,
  });
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
      reconciliation: deps.createReconciliationService(tx),
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
        handler: async ({
          dealStore,
          dealsModule,
          treasuryModule,
        }) => {
          const workflow = await requireWorkflow(dealsModule, input.dealId);
          assertExecutionRequestAllowed(workflow);

          const recipeContext = await resolveRecipeContext(
            deps,
            treasuryModule,
            dealsModule,
            workflow,
          );
          const currencyCodeById = new Map<string, string>();
          const customerId = getCustomerId(workflow);
          const linkCountBefore = workflow.executionPlan.flatMap((leg) => leg.operationRefs)
            .length;
          const existingSourceRefs = new Set(
            workflow.executionPlan.flatMap((leg) =>
              leg.operationRefs.map((ref) => ref.sourceRef),
            ),
          );
          const pendingOperations = recipeContext.recipe.filter(
            (operation) => !existingSourceRefs.has(operation.sourceRef),
          );

          if (pendingOperations.length === 0) {
            return workflow;
          }

          for (const operation of pendingOperations) {
            await materializeCompiledOperation({
              compiled: operation,
              currentCalculation: recipeContext.currentCalculation,
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
                  operationCount: pendingOperations.length,
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
        handler: async ({
          dealStore,
          dealsModule,
          treasuryModule,
        }) => {
          const workflow = await requireWorkflow(dealsModule, input.dealId);
          const leg = findLegById(workflow, input.legId);

          if (!leg) {
            throw new ValidationError(
              `Deal ${input.dealId} does not have execution leg ${input.legId}`,
            );
          }

          if (leg.state === "skipped") {
            throw new ValidationError(
              `Deal ${input.dealId} execution leg ${input.legId} is skipped and cannot materialize an operation`,
            );
          }

          assertExecutionRequestAllowed(workflow);

          const recipeContext = await resolveRecipeContext(
            deps,
            treasuryModule,
            dealsModule,
            workflow,
          );
          const existingSourceRefs = new Set(
            leg.operationRefs.map((ref) => ref.sourceRef),
          );
          const compiledForLeg = recipeContext.recipe.filter(
            (item) => item.legId === input.legId,
          );

          if (compiledForLeg.length === 0) {
            throw new ValidationError(
              `Deal ${input.dealId} does not have a materializable recipe for leg ${input.legId}`,
            );
          }

          const compiled = compiledForLeg.find(
            (item) => !existingSourceRefs.has(item.sourceRef),
          );

          if (!compiled) {
            return workflow;
          }

          const operation = await materializeCompiledOperation({
            compiled,
            currentCalculation: recipeContext.currentCalculation,
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
      comment?: string | null;
      dealId: string;
      idempotencyKey: string;
      legId: string;
    }): Promise<DealWorkflowProjection> {
      return runIdempotent(deps, {
        actorUserId: input.actorUserId,
        handler: async ({ dealsModule }) => {
          const workflow = await requireWorkflow(dealsModule, input.dealId);

          const leg = findLegById(workflow, input.legId);
          if (!leg) {
            throw new ValidationError(
              `Deal ${input.dealId} does not have execution leg ${input.legId}`,
            );
          }

          if (leg.state !== "blocked") {
            return workflow;
          }

          return dealsModule.deals.commands.updateLegState({
            actorUserId: input.actorUserId,
            comment: input.comment ?? null,
            dealId: input.dealId,
            idx: leg.idx,
            state: "ready",
          });
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
        handler: async ({
          dealStore,
          dealsModule,
          treasuryModule,
        }) => {
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
        handler: async ({
          dealStore,
          dealsModule,
          treasuryModule,
        }) => {
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
        handler: async ({
          dealStore,
          dealsModule,
          treasuryModule,
        }) => {
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
        handler: async ({
          dealStore,
          dealsModule,
          treasuryModule,
        }) => {
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
        handler: async ({
          dealStore,
          dealsModule,
          reconciliation,
          treasuryModule,
        }) => {
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

          await ingestTreasuryInstructionOutcomeFact({
            instruction: updated,
            operation,
            treasuryModule,
            workflow,
          });

          await ingestTreasuryOutcomeReconciliationRecord({
            actorUserId: input.actorUserId,
            dealId: workflow.summary.id,
            instruction: updated,
            operation,
            reconciliation,
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
        handler: async ({
          dealStore,
          dealsModule,
          reconciliation,
          treasuryModule,
        }) => {
          const workflow = await requireWorkflow(dealsModule, input.dealId);

          if (workflow.summary.status === "closed") {
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
          const reconciliationLinks =
            await reconciliation.links.listOperationLinks({
              operationIds: linkedOperationIds,
            });
          const [cashMovements, executionFees, executionFills] = await Promise.all([
            treasuryModule.operations.queries.listCashMovements({
              dealId: input.dealId,
              limit: MAX_QUERY_LIST_LIMIT,
              offset: 0,
              sortBy: "bookedAt",
              sortOrder: "desc",
            }),
            treasuryModule.operations.queries.listExecutionFees({
              dealId: input.dealId,
              limit: MAX_QUERY_LIST_LIMIT,
              offset: 0,
              sortBy: "chargedAt",
              sortOrder: "desc",
            }),
            treasuryModule.operations.queries.listExecutionFills({
              dealId: input.dealId,
              limit: MAX_QUERY_LIST_LIMIT,
              offset: 0,
              sortBy: "executedAt",
              sortOrder: "desc",
            }),
          ]);
          const operationIdsWithActuals = new Set(
            [
              ...cashMovements.data.map((movement) => movement.operationId),
              ...executionFees.data.map((fee) => fee.operationId),
              ...executionFills.data.map((fill) => fill.operationId),
            ].filter((operationId): operationId is string => Boolean(operationId)),
          );
          const reconciliationLinksByOperationId = new Map(
            reconciliationLinks.map(
              (link): readonly [string, ReconciliationOperationLinkDto] => [
                link.operationId,
                link,
              ],
            ),
          );
          const { closeReadiness } = deriveFinanceDealReadiness({
            latestInstructionByOperationId: instructionByOperationId,
            operationIdsWithFacts: operationIdsWithActuals,
            profitabilityCalculationId: workflow.summary.calculationId,
            reconciliationLinksByOperationId,
            workflow,
          });

          if (!closeReadiness.ready) {
            throw new DealTransitionBlockedError(
              "closed",
              closeReadiness.blockers.map((message: string) => ({
                code: "execution_leg_not_done",
                message,
              })),
            );
          }

          const updated = await dealsModule.deals.commands.transitionStatus({
            actorUserId: input.actorUserId,
            comment: input.comment ?? null,
            dealId: input.dealId,
            status: "closed",
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

          return updated.summary.status === "closed"
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
