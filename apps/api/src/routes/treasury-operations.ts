import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import {
  paginateInMemory,
  sortInMemory,
} from "@bedrock/shared/core/pagination";
import { minorToAmountString } from "@bedrock/shared/money";
import { resolveRequisiteIdentity } from "@bedrock/shared/requisites";
import {
  findRequisiteIdentifier,
  resolveRequisiteProviderDisplayName,
} from "@bedrock/parties";
import {
  ListTreasuryOperationsQuerySchema,
  RecordTreasuryInstructionOutcomeInputSchema,
  RequestTreasuryReturnInputSchema,
  RetryTreasuryInstructionInputSchema,
  SubmitTreasuryInstructionInputSchema,
  TreasuryOperationKindSchema,
  TreasuryOperationViewSchema,
  TreasuryOperationWorkspaceDetailSchema,
  TreasuryOperationWorkspaceListResponseSchema,
  type TreasuryInstruction,
  type TreasuryOperationView,
  type TreasuryOperationWorkspaceDetail,
  type TreasuryOperationWorkspaceDetail as TreasuryOperationListRow,
} from "@bedrock/treasury/contracts";

import { ErrorSchema } from "../common";
import { handleRouteError } from "../common/errors";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withRequiredIdempotency } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

const OperationIdParamsSchema = z.object({
  operationId: z.uuid(),
});
const InstructionIdParamsSchema = z.object({
  instructionId: z.uuid(),
});
const TreasuryInstructionMutationBodySchema = SubmitTreasuryInstructionInputSchema.pick(
  {
    providerRef: true,
    providerSnapshot: true,
  },
);
const TreasuryInstructionOutcomeBodySchema =
  RecordTreasuryInstructionOutcomeInputSchema.pick({
    outcome: true,
    providerRef: true,
    providerSnapshot: true,
  });

const DOWNSTREAM_POSITION_KINDS = new Set([
  "exporter_expected_receivable",
  "in_transit",
  "provider_payable",
]);

const DOWNSTREAM_LEG_KINDS = new Set([
  "payout",
  "settle_exporter",
  "transit_hold",
]);

type TreasuryOperationRecord = Awaited<
  ReturnType<AppContext["treasuryModule"]["operations"]["queries"]["list"]>
>["data"][number];
type TreasuryOperationDetailRecord = NonNullable<
  Awaited<ReturnType<AppContext["treasuryModule"]["operations"]["queries"]["findById"]>>
>;
type TreasuryOperationProjection = TreasuryOperationWorkspaceDetail;
type DealWorkflowRecord = Awaited<
  ReturnType<AppContext["dealsModule"]["deals"]["queries"]["findWorkflowsByIds"]>
>[number];
type AgreementRecord = Awaited<
  ReturnType<AppContext["agreementsModule"]["agreements"]["queries"]["findById"]>
>;
type QuoteDetailsRecord = Awaited<
  ReturnType<AppContext["treasuryModule"]["quotes"]["queries"]["getQuoteDetails"]>
>;
type RequisiteRecord = Awaited<
  ReturnType<AppContext["partiesReadRuntime"]["requisitesQueries"]["findById"]>
>;
type RequisiteProviderRecord = Awaited<
  ReturnType<AppContext["partiesReadRuntime"]["requisitesQueries"]["providers"]["findById"]>
>;

interface ProjectionContext {
  agreementById: Map<string, AgreementRecord>;
  currencyCodeById: Map<string, string>;
  latestInstructionByOperationId: Map<string, TreasuryInstruction>;
  organizationNameById: Map<string, string>;
  providerById: Map<string, RequisiteProviderRecord>;
  quoteDetailsById: Map<string, QuoteDetailsRecord>;
  requisiteById: Map<string, RequisiteRecord>;
  workflowByDealId: Map<string, DealWorkflowRecord>;
}

function uniqueIds(ids: readonly (string | null | undefined)[]): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

async function loadMapById<TValue>(input: {
  ids: readonly (string | null | undefined)[];
  load: (id: string) => Promise<TValue | null | undefined>;
}) {
  const map = new Map<string, TValue>();

  const loaded = await Promise.allSettled(
    uniqueIds(input.ids).map(async (id) => [id, await input.load(id)] as const),
  );

  for (const entry of loaded) {
    if (entry.status !== "fulfilled") {
      continue;
    }

    const [id, value] = entry.value;
    if (value !== null && value !== undefined) {
      map.set(id, value);
    }
  }

  return map;
}

function getApplicantParticipant(workflow: DealWorkflowRecord) {
  return workflow.participants.find((participant) => participant.role === "applicant");
}

function getInternalEntityParticipant(workflow: DealWorkflowRecord) {
  return workflow.participants.find(
    (participant) => participant.role === "internal_entity",
  );
}

function getPositionByKind(workflow: DealWorkflowRecord, kind: string) {
  return workflow.operationalState.positions.find((position) => position.kind === kind) ?? null;
}

function summarizeExecutionPlan(workflow: DealWorkflowRecord) {
  return {
    blockedLegCount: workflow.executionPlan.filter((leg) => leg.state === "blocked")
      .length,
  };
}

function collectBlockingReasons(workflow: DealWorkflowRecord) {
  const reasons = new Set<string>();

  for (const readiness of workflow.transitionReadiness) {
    for (const blocker of readiness.blockers) {
      reasons.add(blocker.message);
    }
  }

  return Array.from(reasons);
}

function classifyFinanceQueue(workflow: DealWorkflowRecord) {
  const downstreamBlocked =
    workflow.executionPlan.some(
      (leg) => DOWNSTREAM_LEG_KINDS.has(leg.kind) && leg.state === "blocked",
    ) ||
    workflow.operationalState.positions.some(
      (position) =>
        DOWNSTREAM_POSITION_KINDS.has(position.kind) &&
        position.state === "blocked",
    );

  if (downstreamBlocked) {
    return {
      blockers: collectBlockingReasons(workflow),
      queue: "failed_instruction" as const,
      queueReason: "Сделка заблокирована на этапе исполнения",
    };
  }

  const customerReceivable = getPositionByKind(workflow, "customer_receivable");
  const downstreamReady = workflow.operationalState.positions.some(
    (position) =>
      DOWNSTREAM_POSITION_KINDS.has(position.kind) &&
      (position.state === "in_progress" || position.state === "ready"),
  );

  if (
    workflow.summary.status === "awaiting_payment" ||
    workflow.summary.status === "closing_documents" ||
    downstreamReady
  ) {
    return {
      blockers: [] as string[],
      queue: "execution" as const,
      queueReason: "Сделка ожидает исполнения",
    };
  }

  if (
    workflow.summary.status === "preparing_documents" ||
    workflow.summary.status === "awaiting_funds" ||
    customerReceivable?.state === "ready" ||
    customerReceivable?.state === "in_progress"
  ) {
    return {
      blockers: [] as string[],
      queue: "funding" as const,
      queueReason: "Сделка находится на этапе фондирования",
    };
  }

  return {
    blockers: collectBlockingReasons(workflow),
    queue: "funding" as const,
    queueReason: "Сделка ожидает следующий шаг на этапе фондирования",
  };
}

function buildMoneySummary(input: {
  amountMinor: string | null;
  currencyCode: string | null;
  currencyId: string | null;
}) {
  if (!input.amountMinor) {
    return {
      amountMinor: null,
      currency: input.currencyCode,
      currencyId: input.currencyId,
      formatted: "—",
    };
  }

  const formattedAmount = input.currencyCode
    ? minorToAmountString(input.amountMinor, { currency: input.currencyCode })
    : minorToAmountString(input.amountMinor);

  return {
    amountMinor: input.amountMinor,
    currency: input.currencyCode,
    currencyId: input.currencyId,
    formatted: input.currencyCode
      ? `${formattedAmount} ${input.currencyCode}`
      : formattedAmount,
  };
}

function buildEmptyAccountSummary() {
  return {
    identity: null,
    label: "—",
  };
}

function buildOrganizationAccountSummary(input: {
  organizationId: string | null;
  organizationNameById: ReadonlyMap<string, string>;
}) {
  if (!input.organizationId) {
    return null;
  }

  const label = input.organizationNameById.get(input.organizationId) ?? input.organizationId;

  return {
    identity: null,
    label,
  };
}

function buildBankInstructionAccountSummary(
  snapshot: DealWorkflowRecord["intake"]["externalBeneficiary"]["bankInstructionSnapshot"] | DealWorkflowRecord["intake"]["settlementDestination"]["bankInstructionSnapshot"] | null,
) {
  if (!snapshot) {
    return null;
  }

  const label =
    snapshot.label?.trim() ||
    snapshot.beneficiaryName?.trim() ||
    snapshot.bankName?.trim() ||
    "";
  const identity =
    resolveRequisiteIdentity({
      accountNo: snapshot.accountNo,
      beneficiaryName: snapshot.beneficiaryName,
      bic: snapshot.bic,
      corrAccount: snapshot.corrAccount,
      iban: snapshot.iban,
      kind: "bank",
      swift: snapshot.swift,
    }) || null;

  if (!label && !identity) {
    return null;
  }

  return {
    identity,
    label: label || identity || "—",
  };
}

function buildRequisiteAccountSummary(requisite: RequisiteRecord | null | undefined) {
  if (!requisite) {
    return null;
  }

  const identity =
    resolveRequisiteIdentity({
      accountNo:
        findRequisiteIdentifier(requisite, "local_account_number")?.value ??
        null,
      accountRef:
        findRequisiteIdentifier(requisite, "account_ref")?.value ?? null,
      address:
        findRequisiteIdentifier(requisite, "wallet_address")?.value ?? null,
      assetCode: null,
      beneficiaryName: requisite.beneficiaryName,
      bic: null,
      contact: null,
      corrAccount:
        findRequisiteIdentifier(requisite, "corr_account")?.value ?? null,
      iban: findRequisiteIdentifier(requisite, "iban")?.value ?? null,
      kind: requisite.kind,
      memoTag:
        findRequisiteIdentifier(requisite, "memo_tag")?.value ?? null,
      network: null,
      notes: requisite.notes,
      subaccountRef:
        findRequisiteIdentifier(requisite, "subaccount_ref")?.value ?? null,
    }) || null;

  return {
    identity,
    label: requisite.label,
  };
}

function formatPricingMode(pricingMode: string | null | undefined) {
  return pricingMode === "explicit_route" ? "Explicit route" : "Auto cross";
}

function resolveProviderName(
  requisite: RequisiteRecord | null | undefined,
  providerById: ReadonlyMap<string, RequisiteProviderRecord>,
) {
  if (!requisite?.providerId) {
    return null;
  }

  const provider = providerById.get(requisite.providerId);
  return provider
    ? resolveRequisiteProviderDisplayName({
        provider,
        branchId: requisite.providerBranchId,
      })
    : null;
}

function resolveInternalEntityOrganizationId(
  operation: TreasuryOperationRecord | TreasuryOperationDetailRecord,
  workflow: DealWorkflowRecord | null,
) {
  if (operation.internalEntityOrganizationId) {
    return operation.internalEntityOrganizationId;
  }

  if (!workflow) {
    return null;
  }

  return getInternalEntityParticipant(workflow)?.organizationId ?? null;
}

function resolveInternalEntityAccount(input: {
  agreement: AgreementRecord | null;
  agreementRequisite: RequisiteRecord | null;
  internalEntityOrganizationId: string | null;
  organizationNameById: ReadonlyMap<string, string>;
}) {
  if (
    input.internalEntityOrganizationId &&
    input.agreement?.organizationId === input.internalEntityOrganizationId
  ) {
    const requisiteSummary = buildRequisiteAccountSummary(input.agreementRequisite);
    if (requisiteSummary) {
      return requisiteSummary;
    }
  }

  return (
    buildOrganizationAccountSummary({
      organizationId: input.internalEntityOrganizationId,
      organizationNameById: input.organizationNameById,
    }) ?? buildEmptyAccountSummary()
  );
}

function resolveAgreementOrganizationAccount(input: {
  agreement: AgreementRecord | null;
  agreementRequisite: RequisiteRecord | null;
  organizationNameById: ReadonlyMap<string, string>;
}) {
  return (
    buildRequisiteAccountSummary(input.agreementRequisite) ??
    buildOrganizationAccountSummary({
      organizationId: input.agreement?.organizationId ?? null,
      organizationNameById: input.organizationNameById,
    }) ??
    buildEmptyAccountSummary()
  );
}

function resolvePayoutDestinationAccount(input: {
  settlementDestinationRequisite: RequisiteRecord | null;
  workflow: DealWorkflowRecord;
}) {
  if (
    input.workflow.summary.type === "currency_exchange" ||
    input.workflow.summary.type === "exporter_settlement"
  ) {
    return (
      buildRequisiteAccountSummary(input.settlementDestinationRequisite) ??
      buildBankInstructionAccountSummary(
        input.workflow.intake.settlementDestination.bankInstructionSnapshot,
      ) ??
      buildEmptyAccountSummary()
    );
  }

  return (
    buildBankInstructionAccountSummary(
      input.workflow.intake.externalBeneficiary.bankInstructionSnapshot,
    ) ?? buildEmptyAccountSummary()
  );
}

function resolveProviderRoute(input: {
  agreementRequisite: RequisiteRecord | null;
  operation: TreasuryOperationRecord | TreasuryOperationDetailRecord;
  providerById: ReadonlyMap<string, RequisiteProviderRecord>;
  quoteDetails: QuoteDetailsRecord | null;
  settlementDestinationRequisite: RequisiteRecord | null;
}) {
  const pricingSummary = input.quoteDetails?.pricingTrace.summary;

  if (typeof pricingSummary === "string" && pricingSummary.trim().length > 0) {
    return pricingSummary.trim();
  }

  if (input.operation.kind === "fx_conversion" && input.quoteDetails?.quote.pricingMode) {
    return formatPricingMode(input.quoteDetails.quote.pricingMode);
  }

  const preferredRequisite =
    input.operation.kind === "payout"
      ? input.settlementDestinationRequisite
      : input.agreementRequisite;
  const providerName = resolveProviderName(preferredRequisite, input.providerById);

  return providerName ?? "—";
}

function findOperationLeg(
  workflow: DealWorkflowRecord,
  operation: TreasuryOperationRecord | TreasuryOperationDetailRecord,
) {
  return (
    workflow.executionPlan.find((leg) =>
      leg.operationRefs.some(
        (ref) =>
          ref.operationId === operation.id || ref.sourceRef === operation.sourceRef,
      ),
    ) ?? null
  );
}

function buildAccounts(input: {
  agreement: AgreementRecord | null;
  agreementRequisite: RequisiteRecord | null;
  internalEntityOrganizationId: string | null;
  operation: TreasuryOperationRecord | TreasuryOperationDetailRecord;
  organizationNameById: ReadonlyMap<string, string>;
  settlementDestinationRequisite: RequisiteRecord | null;
  workflow: DealWorkflowRecord | null;
}) {
  if (!input.workflow) {
    return {
      destinationAccount: buildEmptyAccountSummary(),
      sourceAccount: buildEmptyAccountSummary(),
    };
  }

  const internalEntityAccount = resolveInternalEntityAccount({
    agreement: input.agreement,
    agreementRequisite: input.agreementRequisite,
    internalEntityOrganizationId: input.internalEntityOrganizationId,
    organizationNameById: input.organizationNameById,
  });
  const agreementOrganizationAccount = resolveAgreementOrganizationAccount({
    agreement: input.agreement,
    agreementRequisite: input.agreementRequisite,
    organizationNameById: input.organizationNameById,
  });

  switch (input.operation.kind) {
    case "payin":
      return {
        destinationAccount: internalEntityAccount,
        sourceAccount: buildEmptyAccountSummary(),
      };
    case "payout":
      return {
        destinationAccount: resolvePayoutDestinationAccount({
          settlementDestinationRequisite: input.settlementDestinationRequisite,
          workflow: input.workflow,
        }),
        sourceAccount: internalEntityAccount,
      };
    case "intracompany_transfer":
    case "intercompany_funding":
      return {
        destinationAccount: internalEntityAccount,
        sourceAccount: agreementOrganizationAccount,
      };
    case "fx_conversion":
      return {
        destinationAccount: internalEntityAccount,
        sourceAccount: internalEntityAccount,
      };
  }
}

function getInstructionStatus(input: {
  latestInstruction: TreasuryInstruction | null;
  workflow: DealWorkflowRecord | null;
}) {
  if (input.latestInstruction) {
    return input.latestInstruction.state;
  }

  if (!input.workflow) {
    return "planned" as const;
  }

  const queueContext = classifyFinanceQueue(input.workflow);
  const executionSummary = summarizeExecutionPlan(input.workflow);
  if (queueContext.blockers.length > 0 || executionSummary.blockedLegCount > 0) {
    return "blocked" as const;
  }

  return "planned" as const;
}

function getInstructionActions(input: {
  latestInstruction: TreasuryInstruction | null;
  workflow: DealWorkflowRecord | null;
}) {
  const latestInstruction = input.latestInstruction;
  const blockedWithoutInstruction =
    !latestInstruction &&
    Boolean(
      input.workflow &&
        (classifyFinanceQueue(input.workflow).blockers.length > 0 ||
          summarizeExecutionPlan(input.workflow).blockedLegCount > 0),
    );

  return {
    canPrepareInstruction: !latestInstruction && !blockedWithoutInstruction,
    canRequestReturn: latestInstruction?.state === "settled",
    canRetryInstruction:
      latestInstruction?.state === "failed" ||
      latestInstruction?.state === "returned",
    canSubmitInstruction: latestInstruction?.state === "prepared",
    canVoidInstruction:
      latestInstruction?.state === "prepared" ||
      latestInstruction?.state === "submitted",
  };
}

function getAvailableOutcomeTransitions(
  latestInstruction: TreasuryInstruction | null,
): ("failed" | "returned" | "settled")[] {
  const submitTransitions: ("failed" | "returned" | "settled")[] = [
    "settled",
    "failed",
  ];
  const returnTransitions: ("failed" | "returned" | "settled")[] = [
    "returned",
  ];

  if (!latestInstruction) {
    return [];
  }

  if (latestInstruction.state === "submitted") {
    return submitTransitions;
  }

  if (latestInstruction.state === "return_requested") {
    return returnTransitions;
  }

  return [];
}

function matchesView(
  item: TreasuryOperationListRow,
  view: TreasuryOperationView | undefined,
) {
  if (!view) {
    return true;
  }

  switch (view) {
    case "incoming":
      return item.kind === "payin";
    case "outgoing":
      return item.kind === "payout";
    case "intracompany":
      return item.kind === "intracompany_transfer";
    case "intercompany":
      return item.kind === "intercompany_funding";
    case "fx":
      return item.kind === "fx_conversion";
    case "exceptions":
      return (
        item.queueContext?.queue === "failed_instruction" ||
        (item.queueContext?.blockers.length ?? 0) > 0 ||
        item.instructionStatus === "failed" ||
        item.instructionStatus === "blocked"
      );
  }
}

function buildViewCounts(items: TreasuryOperationListRow[]) {
  return {
    all: items.length,
    exceptions: items.filter((item) => matchesView(item, "exceptions")).length,
    fx: items.filter((item) => matchesView(item, "fx")).length,
    incoming: items.filter((item) => matchesView(item, "incoming")).length,
    intercompany: items.filter((item) => matchesView(item, "intercompany")).length,
    intracompany: items.filter((item) => matchesView(item, "intracompany")).length,
    outgoing: items.filter((item) => matchesView(item, "outgoing")).length,
  };
}

function resolveOperationListSort(
  items: TreasuryOperationListRow[],
  query: z.infer<typeof ListTreasuryOperationsQuerySchema>,
) {
  return sortInMemory(items, {
    sortBy: query.sortBy,
    sortMap: {
      createdAt: (item) => item.createdAt,
      kind: (item) => item.kind,
    },
    sortOrder: query.sortOrder,
  });
}

async function buildProjectionContext(
  ctx: AppContext,
  operations: readonly (TreasuryOperationRecord | TreasuryOperationDetailRecord)[],
): Promise<ProjectionContext> {
  const workflowByDealId = new Map(
    (
      await ctx.dealsModule.deals.queries.findWorkflowsByIds(
        uniqueIds(operations.map((operation) => operation.dealId)),
      )
    ).map((workflow) => [workflow.summary.id, workflow] as const),
  );

  const agreementById = await loadMapById({
    ids: Array.from(workflowByDealId.values()).map(
      (workflow) => workflow.summary.agreementId,
    ),
    load: async (id) => {
      try {
        return await ctx.agreementsModule.agreements.queries.findById(id);
      } catch {
        return null;
      }
    },
  });

  const agreementRequisiteIds = Array.from(agreementById.values()).map(
    (agreement) => agreement.organizationRequisiteId,
  );
  const settlementDestinationRequisiteIds = Array.from(workflowByDealId.values()).map(
    (workflow) => workflow.intake.settlementDestination.requisiteId,
  );

  const requisiteById = await loadMapById({
    ids: [...agreementRequisiteIds, ...settlementDestinationRequisiteIds],
    load: (id) => ctx.partiesReadRuntime.requisitesQueries.findById(id),
  });

  const providerById = await loadMapById({
    ids: Array.from(requisiteById.values()).map((requisite) => requisite.providerId),
    load: (id) => ctx.partiesReadRuntime.requisitesQueries.providers.findById(id),
  });

  const quoteDetailsById = await loadMapById({
    ids: operations.map((operation) => operation.quoteId),
    load: async (id) => {
      try {
        return await ctx.treasuryModule.quotes.queries.getQuoteDetails({
          quoteRef: id,
        });
      } catch {
        return null;
      }
    },
  });
  const latestInstructionByOperationId = new Map(
    (
      await ctx.treasuryModule.instructions.queries.listLatestByOperationIds(
        operations.map((operation) => operation.id),
      )
    ).map((instruction) => [instruction.operationId, instruction] as const),
  );

  const currencyCodeById = await loadMapById({
    ids: [
      ...operations.map((operation) => operation.currencyId),
      ...operations.map((operation) => operation.counterCurrencyId),
    ],
    load: async (id) => {
      try {
        return (await ctx.currenciesService.findById(id)).code;
      } catch {
        return null;
      }
    },
  });

  const organizationIds = uniqueIds([
    ...operations.map((operation) => operation.internalEntityOrganizationId),
    ...Array.from(workflowByDealId.values()).map(
      (workflow) => getInternalEntityParticipant(workflow)?.organizationId,
    ),
    ...Array.from(agreementById.values()).map((agreement) => agreement.organizationId),
  ]);

  const organizationNameById =
    organizationIds.length > 0
      ? await ctx.partiesReadRuntime.organizationsQueries.listShortNamesById(
          organizationIds,
        )
      : new Map<string, string>();

  return {
    agreementById,
    currencyCodeById,
    latestInstructionByOperationId,
    organizationNameById,
    providerById,
    quoteDetailsById,
    requisiteById,
    workflowByDealId,
  };
}

function buildOperationProjection(input: {
  context: ProjectionContext;
  operation: TreasuryOperationRecord | TreasuryOperationDetailRecord;
}): TreasuryOperationProjection {
  const workflow = input.operation.dealId
    ? input.context.workflowByDealId.get(input.operation.dealId) ?? null
    : null;
  const agreement = workflow
    ? input.context.agreementById.get(workflow.summary.agreementId) ?? null
    : null;
  const agreementRequisite = agreement
    ? input.context.requisiteById.get(agreement.organizationRequisiteId) ?? null
    : null;
  const settlementDestinationRequisite =
    workflow?.intake.settlementDestination.requisiteId
      ? input.context.requisiteById.get(
          workflow.intake.settlementDestination.requisiteId,
        ) ?? null
      : null;
  const quoteDetails = input.operation.quoteId
    ? input.context.quoteDetailsById.get(input.operation.quoteId) ?? null
    : null;
  const internalEntityOrganizationId = resolveInternalEntityOrganizationId(
    input.operation,
    workflow,
  );
  const internalEntityName =
    (workflow ? getInternalEntityParticipant(workflow)?.displayName : null) ??
    (internalEntityOrganizationId
      ? input.context.organizationNameById.get(internalEntityOrganizationId) ?? null
      : null);
  const accounts = buildAccounts({
    agreement,
    agreementRequisite,
    internalEntityOrganizationId,
    operation: input.operation,
    organizationNameById: input.context.organizationNameById,
    settlementDestinationRequisite,
    workflow,
  });
  const leg = workflow ? findOperationLeg(workflow, input.operation) : null;
  const queueContext = workflow ? classifyFinanceQueue(workflow) : null;
  const latestInstruction =
    input.context.latestInstructionByOperationId.get(input.operation.id) ?? null;
  const instructionStatus = getInstructionStatus({
    latestInstruction,
    workflow,
  });

  return {
    actions: getInstructionActions({
      latestInstruction,
      workflow,
    }),
    amount: buildMoneySummary({
      amountMinor: input.operation.amountMinor,
      currencyCode: input.operation.currencyId
        ? input.context.currencyCodeById.get(input.operation.currencyId) ?? null
        : null,
      currencyId: input.operation.currencyId,
    }),
    availableOutcomeTransitions: getAvailableOutcomeTransitions(latestInstruction),
    counterAmount: input.operation.counterAmountMinor
      ? buildMoneySummary({
          amountMinor: input.operation.counterAmountMinor,
          currencyCode: input.operation.counterCurrencyId
            ? input.context.currencyCodeById.get(input.operation.counterCurrencyId) ??
              null
            : null,
          currencyId: input.operation.counterCurrencyId,
        })
      : null,
    createdAt: input.operation.createdAt.toISOString(),
    dealRef: workflow
      ? {
          applicantName: getApplicantParticipant(workflow)?.displayName ?? null,
          dealId: workflow.summary.id,
          status: workflow.summary.status,
          type: workflow.summary.type,
        }
      : null,
    dealWorkbenchHref: input.operation.dealId
      ? `/treasury/deals/${input.operation.dealId}`
      : null,
    destinationAccount: accounts.destinationAccount,
    id: input.operation.id,
    instructionStatus,
    internalEntity: {
      name: internalEntityName,
      organizationId: internalEntityOrganizationId,
    },
    kind: input.operation.kind,
    legRef: leg?.id
      ? {
          idx: leg.idx,
          kind: leg.kind,
          legId: leg.id,
        }
      : null,
    latestInstruction,
    nextAction: workflow?.nextAction ?? "—",
    providerRoute: resolveProviderRoute({
      agreementRequisite,
      operation: input.operation,
      providerById: input.context.providerById,
      quoteDetails,
      settlementDestinationRequisite,
    }),
    queueContext,
    sourceAccount: accounts.sourceAccount,
    sourceRef: input.operation.sourceRef,
    state: input.operation.state,
  };
}

async function loadOperationProjection(
  ctx: AppContext,
  operationId: string,
): Promise<TreasuryOperationProjection | null> {
  const operation = await ctx.treasuryModule.operations.queries.findById(operationId);

  if (!operation) {
    return null;
  }

  const context = await buildProjectionContext(ctx, [operation]);

  return buildOperationProjection({
    context,
    operation,
  });
}

export function treasuryOperationsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Treasury"],
    summary: "List finance treasury operations workspace rows",
    request: {
      query: ListTreasuryOperationsQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated treasury operations workspace rows",
        content: {
          "application/json": {
            schema: TreasuryOperationWorkspaceListResponseSchema,
          },
        },
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/{operationId}",
    tags: ["Treasury"],
    summary: "Get finance treasury operation workspace details",
    request: {
      params: OperationIdParamsSchema,
    },
    responses: {
      200: {
        description: "Treasury operation workspace details",
        content: {
          "application/json": {
            schema: TreasuryOperationWorkspaceDetailSchema,
          },
        },
      },
      404: {
        description: "Operation not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const prepareInstructionRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{operationId}/instructions/prepare",
    tags: ["Treasury"],
    summary: "Prepare treasury instruction for a materialized operation",
    request: {
      params: OperationIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: TreasuryInstructionMutationBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Treasury operation workspace details",
        content: {
          "application/json": {
            schema: TreasuryOperationWorkspaceDetailSchema,
          },
        },
      },
      400: {
        description: "Validation or idempotency header error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Operation not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const baseOperations = await ctx.treasuryModule.operations.queries.list({
          dealId: query.dealId,
          internalEntityOrganizationId: query.internalEntityOrganizationId,
          kind: query.kind?.map((value) => TreasuryOperationKindSchema.parse(value)),
          limit: MAX_QUERY_LIST_LIMIT,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        });
        const context = await buildProjectionContext(ctx, baseOperations.data);
        const projected = baseOperations.data.map((operation) =>
          buildOperationProjection({
            context,
            operation,
          }),
        );
        const view = query.view
          ? TreasuryOperationViewSchema.parse(query.view)
          : undefined;
        const filteredByView = view
          ? projected.filter((item) => matchesView(item, view))
          : projected;
        const sorted = resolveOperationListSort(filteredByView, query);
        const paginated = paginateInMemory(sorted, {
          limit: query.limit,
          offset: query.offset,
        });

        return c.json(
          {
            ...paginated,
            viewCounts: buildViewCounts(projected),
          },
          200,
        );
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getRoute, async (c) => {
      try {
        const { operationId } = c.req.valid("param");
        const projection = await loadOperationProjection(ctx, operationId);

        if (!projection) {
          return c.json({ error: "Treasury operation not found" }, 404);
        }

        return c.json(projection, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(prepareInstructionRoute, async (c) => {
      try {
        const { operationId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.dealExecutionWorkflow.prepareInstruction({
            actorUserId: c.get("user")!.id,
            idempotencyKey,
            operationId,
            providerRef: body.providerRef ?? null,
            providerSnapshot: body.providerSnapshot ?? null,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        const projection = await loadOperationProjection(ctx, result.operationId);

        if (!projection) {
          return c.json({ error: "Treasury operation not found" }, 404);
        }

        return c.json(projection, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}

export function treasuryInstructionRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const submitRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{instructionId}/submit",
    tags: ["Treasury"],
    summary: "Submit treasury instruction",
    request: {
      params: InstructionIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: TreasuryInstructionMutationBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Treasury operation workspace details",
        content: {
          "application/json": {
            schema: TreasuryOperationWorkspaceDetailSchema,
          },
        },
      },
    },
  });

  const retryRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{instructionId}/retry",
    tags: ["Treasury"],
    summary: "Retry treasury instruction",
    request: {
      params: InstructionIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: RetryTreasuryInstructionInputSchema.pick({
              providerRef: true,
              providerSnapshot: true,
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Treasury operation workspace details",
        content: {
          "application/json": {
            schema: TreasuryOperationWorkspaceDetailSchema,
          },
        },
      },
    },
  });

  const voidRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{instructionId}/void",
    tags: ["Treasury"],
    summary: "Void treasury instruction",
    request: {
      params: InstructionIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: TreasuryInstructionMutationBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Treasury operation workspace details",
        content: {
          "application/json": {
            schema: TreasuryOperationWorkspaceDetailSchema,
          },
        },
      },
    },
  });

  const requestReturnRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{instructionId}/return",
    tags: ["Treasury"],
    summary: "Request treasury instruction return",
    request: {
      params: InstructionIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: RequestTreasuryReturnInputSchema.pick({
              providerRef: true,
              providerSnapshot: true,
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Treasury operation workspace details",
        content: {
          "application/json": {
            schema: TreasuryOperationWorkspaceDetailSchema,
          },
        },
      },
    },
  });

  const outcomeRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "post",
    path: "/{instructionId}/outcome",
    tags: ["Treasury"],
    summary: "Record treasury instruction outcome",
    request: {
      params: InstructionIdParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: TreasuryInstructionOutcomeBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Treasury operation workspace details",
        content: {
          "application/json": {
            schema: TreasuryOperationWorkspaceDetailSchema,
          },
        },
      },
    },
  });

  async function respondWithProjection(input: {
    c: Context<{ Variables: AuthVariables }>;
    operationId: string;
  }) {
    const projection = await loadOperationProjection(ctx, input.operationId);

    if (!projection) {
      return input.c.json({ error: "Treasury operation not found" }, 404);
    }

    return input.c.json(projection, 200);
  }

  return app
    .openapi(submitRoute, async (c) => {
      try {
        const { instructionId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.dealExecutionWorkflow.submitInstruction({
            actorUserId: c.get("user")!.id,
            idempotencyKey,
            instructionId,
            providerRef: body.providerRef ?? null,
            providerSnapshot: body.providerSnapshot ?? null,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return respondWithProjection({ c, operationId: result.operationId });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(retryRoute, async (c) => {
      try {
        const { instructionId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.dealExecutionWorkflow.retryInstruction({
            actorUserId: c.get("user")!.id,
            idempotencyKey,
            instructionId,
            providerRef: body.providerRef ?? null,
            providerSnapshot: body.providerSnapshot ?? null,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return respondWithProjection({ c, operationId: result.operationId });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(voidRoute, async (c) => {
      try {
        const { instructionId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.dealExecutionWorkflow.voidInstruction({
            actorUserId: c.get("user")!.id,
            idempotencyKey,
            instructionId,
            providerRef: body.providerRef ?? null,
            providerSnapshot: body.providerSnapshot ?? null,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return respondWithProjection({ c, operationId: result.operationId });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(requestReturnRoute, async (c) => {
      try {
        const { instructionId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.dealExecutionWorkflow.requestReturn({
            actorUserId: c.get("user")!.id,
            idempotencyKey,
            instructionId,
            providerRef: body.providerRef ?? null,
            providerSnapshot: body.providerSnapshot ?? null,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return respondWithProjection({ c, operationId: result.operationId });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(outcomeRoute, async (c) => {
      try {
        const { instructionId } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.dealExecutionWorkflow.recordInstructionOutcome({
            actorUserId: c.get("user")!.id,
            idempotencyKey,
            instructionId,
            outcome: body.outcome,
            providerRef: body.providerRef ?? null,
            providerSnapshot: body.providerSnapshot ?? null,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return respondWithProjection({ c, operationId: result.operationId });
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}
