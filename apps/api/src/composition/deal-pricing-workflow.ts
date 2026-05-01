import type { AgreementsModule } from "@bedrock/agreements";
import type { CurrenciesService } from "@bedrock/currencies";
import { canDealWriteTreasuryOrFormalDocuments } from "@bedrock/deals";
import { DealPricingContextRevisionConflictError } from "@bedrock/deals";
import type { DealsModule } from "@bedrock/deals";
import type {
  DealPricingCommercialDraft,
  DealFundingAdjustment,
  DealFundingPosition,
  DealPricingBenchmarks,
  DealPricingFormulaLine,
  DealPricingFormulaTrace,
  DealPricingProfitability,
  DealPricingRateSnapshot,
  DealWorkflowProjection as DealWorkflowProjectionRecord,
  UpdateDealPricingContextInput,
} from "@bedrock/deals/contracts";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@bedrock/shared/core/errors";
import {
  formatFractionDecimal,
  minorToAmountString,
  mulDivRoundHalfUp,
  toMinorAmountString,
} from "@bedrock/shared/money";
import type { TreasuryModule } from "@bedrock/treasury";
import {
  computePricingFingerprint,
  type CreateQuoteInput,
  type PaymentStep,
  type PaymentRouteCalculation,
  type PaymentRouteDraft,
  type PaymentRouteTemplateListItem,
  type PreviewQuoteInput,
  type QuotePreviewRecord,
  type QuoteRecord,
} from "@bedrock/treasury/contracts";
import { extractAgreementCommercialDefaults } from "@bedrock/workflow-deal-commercial";

type DealPricingContextRecord = Awaited<
  ReturnType<DealsModule["deals"]["queries"]["findPricingContextByDealId"]>
>;
type DealRecord = NonNullable<
  Awaited<ReturnType<DealsModule["deals"]["queries"]["findById"]>>
>;
type DealWorkflowRecord = NonNullable<
  Awaited<ReturnType<DealsModule["deals"]["queries"]["findWorkflowById"]>>
>;

interface PreparedDealPricingInput {
  context: DealPricingContextRecord;
  deal: DealRecord;
  workflow: DealWorkflowRecord;
}

interface QuotePayloadResult {
  quoteInput: PreviewQuoteInput;
  routePreview: PaymentRouteCalculation | null;
}

interface PricingArtifacts {
  benchmarks: DealPricingBenchmarks;
  formulaTrace: DealPricingFormulaTrace;
  profitability: DealPricingProfitability | null;
  crmPricingSnapshot: CrmPricingSnapshot;
}

interface DealPricingAmountSnapshot {
  amountSide: "source" | "target";
  commercialRevenueMinor: string;
  customerDebitMinor: string;
  customerReceivesMinor: string;
  fxPrincipalFromAmountMinor: string;
  passThroughMinor: string;
  requestedAmountMinor: string;
}

interface CurrencyPairRequirement {
  fromCurrency: string;
  toCurrency: string;
}

type PaymentStepsQueries = TreasuryModule["paymentSteps"]["queries"];
type PaymentStepsListInput = Parameters<PaymentStepsQueries["list"]>[0];

const PAYMENT_STEP_PAGE_LIMIT = 100;

type ExecutionSource =
  | { type: "route_execution" }
  | { inventoryPositionId: string; type: "treasury_inventory" };

interface ExecutionSideSnapshot {
  executionCostLines: PaymentRouteCalculation["executionCostLines"];
  executionRate: { rateDen: string; rateNum: string } | null;
  inventoryAllocationId?: string | null;
  inventoryPositionId?: string | null;
  routeCostMinor: string;
  routeFundingMinor: string;
  source: ExecutionSource["type"];
}

interface ClientSideSnapshot {
  beneficiaryAmountMinor: string;
  clientPrincipalMinor: string;
  clientRate: { rateDen: string; rateNum: string };
  commercialFeeMinor: string;
  customerTotalMinor: string;
  discountMinor: string;
  passThroughMinor: string;
  pricingMode: "client_rate" | "client_total";
}

interface PnlSnapshot {
  costMinor: string;
  grossProfitMinor: string;
  profitPercentOnCost: string;
  revenueMinor: string;
}

interface CrmPricingSnapshot {
  clientSide: ClientSideSnapshot;
  executionSide: ExecutionSideSnapshot;
  pnl: PnlSnapshot;
}

export interface DealPricingPreviewRecord {
  benchmarks: DealPricingBenchmarks;
  formulaTrace: DealPricingFormulaTrace;
  fundingSummary: {
    positions: DealFundingPosition[];
  };
  pricingFingerprint: string;
  pricingMode: "auto_cross" | "explicit_route";
  profitability: DealPricingProfitability | null;
  quotePreview: QuotePreviewRecord;
  routePreview: PaymentRouteCalculation | null;
}

export interface DealPricingWorkflow {
  attachRoute(input: {
    dealId: string;
    routeTemplateId: string;
  }): Promise<DealPricingContextRecord>;
  createQuote(input: {
    amountMinor: string;
    amountSide: "source" | "target";
    asOf: Date;
    clientPricing?: DealPricingCommercialDraft["clientPricing"];
    dealId: string;
    executionSource?: DealPricingCommercialDraft["executionSource"];
    expectedRevision: number;
    idempotencyKey: string;
  }): Promise<{
    benchmarks: DealPricingBenchmarks;
    formulaTrace: DealPricingFormulaTrace;
    pricingMode: "auto_cross" | "explicit_route";
    profitability: DealPricingProfitability | null;
    quote: QuoteRecord;
  }>;
  detachRoute(input: { dealId: string }): Promise<DealPricingContextRecord>;
  initializeDefaultRoute(input: {
    dealId: string;
  }): Promise<DealPricingContextRecord>;
  listRoutes(input: { dealId: string }): Promise<PaymentRouteTemplateListItem[]>;
  preview(input: {
    amountMinor: string;
    amountSide: "source" | "target";
    asOf: Date;
    clientPricing?: DealPricingCommercialDraft["clientPricing"];
    dealId: string;
    executionSource?: DealPricingCommercialDraft["executionSource"];
    expectedRevision: number;
  }): Promise<DealPricingPreviewRecord>;
  swapRouteTemplate(input: {
    actorUserId: string;
    dealId: string;
    memo?: string | null;
    newRouteTemplateId: string;
    reasonCode: string;
  }): Promise<DealWorkflowProjectionRecord>;
  updateContext(input: {
    dealId: string;
    patch: UpdateDealPricingContextInput;
  }): Promise<DealPricingContextRecord>;
}

export interface DealPricingWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  currencies: Pick<CurrenciesService, "findByCode" | "findById">;
  deals: Pick<DealsModule, "deals">;
  treasury: Pick<
    TreasuryModule,
    "paymentRoutes" | "paymentSteps" | "quotes" | "rates" | "treasuryOrders"
  >;
}

const FUNDING_ADJUSTMENT_KIND_LABELS: Record<
  DealFundingAdjustment["kind"],
  string
> = {
  already_funded: "Уже профинансировано",
  available_balance: "Доступный остаток",
  manual_offset: "Ручная корректировка",
  reconciliation_adjustment: "Корректировка по сверке",
};

const MARKET_RATE_SOURCE_LABELS: Record<string, string> = {
  cbr: "ЦБ РФ",
  grinex: "Grinex",
  investing: "Investing.com",
  manual: "Ручной курс",
  xe: "XE",
};

function describeMarketRateSource(source: string | null): string {
  if (!source) return "Рыночный курс";
  return MARKET_RATE_SOURCE_LABELS[source] ?? source;
}

function assertDealAllowsCommercialWrite(deal: DealRecord) {
  if (
    !canDealWriteTreasuryOrFormalDocuments({
      status: deal.status,
      type: deal.type,
    })
  ) {
    throw new ValidationError(
      `Deal ${deal.id} cannot start treasury quotes from status ${deal.status}`,
    );
  }
}

async function listAllPaymentSteps(
  queries: PaymentStepsQueries,
  input: Omit<PaymentStepsListInput, "limit" | "offset">,
): Promise<PaymentStep[]> {
  const rows: PaymentStep[] = [];
  let offset = 0;

  while (true) {
    const page = await queries.list({
      ...input,
      limit: PAYMENT_STEP_PAGE_LIMIT,
      offset,
    });
    rows.push(...page.data);
    offset += page.limit;
    if (offset >= page.total) {
      break;
    }
  }

  return rows;
}

async function requireDealRecord(
  deps: DealPricingWorkflowDeps,
  dealId: string,
): Promise<DealRecord> {
  const deal = await deps.deals.deals.queries.findById(dealId);

  if (!deal) {
    throw new NotFoundError("Deal", dealId);
  }

  return deal;
}

async function requireDealWorkflowRecord(
  deps: DealPricingWorkflowDeps,
  dealId: string,
): Promise<DealWorkflowRecord> {
  const workflow = await deps.deals.deals.queries.findWorkflowById(dealId);

  if (!workflow) {
    throw new NotFoundError("Deal workflow", dealId);
  }

  return workflow;
}

function compareRoutePriority(
  deal: DealRecord,
  left: PaymentRouteTemplateListItem,
  right: PaymentRouteTemplateListItem,
) {
  const leftExactCustomer =
    left.sourceEndpoint.binding === "bound" &&
    left.sourceEndpoint.entityId === deal.customerId;
  const rightExactCustomer =
    right.sourceEndpoint.binding === "bound" &&
    right.sourceEndpoint.entityId === deal.customerId;

  if (leftExactCustomer !== rightExactCustomer) {
    return leftExactCustomer ? -1 : 1;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

async function loadValidatedRouteTemplate(
  deps: DealPricingWorkflowDeps,
  input: { dealId: string; routeTemplateId: string },
) {
  const [deal, workflow, route] = await Promise.all([
    requireDealRecord(deps, input.dealId),
    requireDealWorkflowRecord(deps, input.dealId),
    deps.treasury.paymentRoutes.queries.findTemplateById(input.routeTemplateId),
  ]);

  if (!route) {
    throw new NotFoundError("Payment route template", input.routeTemplateId);
  }

  if (route.status !== "active") {
    throw new ValidationError(
      `Payment route template ${route.id} is not active`,
    );
  }

  if (
    route.draft.currencyInId !== workflow.intake.moneyRequest.sourceCurrencyId ||
    route.draft.currencyOutId !== workflow.intake.moneyRequest.targetCurrencyId
  ) {
    throw new ValidationError(
      `Payment route template ${route.id} does not match deal currency pair`,
    );
  }

  const sourceParticipant = route.draft.participants[0];
  if (
    sourceParticipant?.binding === "bound" &&
    sourceParticipant.entityId !== deal.customerId
  ) {
    throw new ValidationError(
      `Payment route template ${route.id} does not belong to deal customer ${deal.customerId}`,
    );
  }

  return { deal, route, workflow };
}

async function attachRouteByTemplateId(
  deps: DealPricingWorkflowDeps,
  input: { dealId: string; routeTemplateId: string },
): Promise<DealPricingContextRecord> {
  const { route } = await loadValidatedRouteTemplate(deps, input);

  return deps.deals.deals.commands.attachPricingRoute({
    dealId: input.dealId,
    snapshot: route.draft,
    templateId: route.id,
    templateName: route.name,
  });
}

async function listRecommendedRoutes(
  deps: DealPricingWorkflowDeps,
  input: {
    deal: DealRecord;
    workflow: DealWorkflowRecord;
  },
): Promise<PaymentRouteTemplateListItem[]> {
  const sourceCurrencyId = input.workflow.intake.moneyRequest.sourceCurrencyId;
  const targetCurrencyId = input.workflow.intake.moneyRequest.targetCurrencyId;

  if (!sourceCurrencyId || !targetCurrencyId) {
    return [];
  }

  const listed = await deps.treasury.paymentRoutes.queries.listTemplates({
    limit: 200,
    offset: 0,
    sortBy: "updatedAt",
    sortOrder: "desc",
    status: "active",
  });

  return listed.data
    .filter(
      (item: PaymentRouteTemplateListItem) => item.currencyInId === sourceCurrencyId,
    )
    .filter(
      (item: PaymentRouteTemplateListItem) =>
        item.currencyOutId === targetCurrencyId,
    )
    .filter(
      (item: PaymentRouteTemplateListItem) =>
        item.sourceEndpoint.binding === "abstract" ||
        item.sourceEndpoint.entityId === input.deal.customerId,
    )
    .sort(
      (left: PaymentRouteTemplateListItem, right: PaymentRouteTemplateListItem) =>
        compareRoutePriority(input.deal, left, right),
    );
}

async function resolveCurrencyCodes(
  deps: DealPricingWorkflowDeps,
  currencyIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(currencyIds.filter(Boolean)));
  const rows = await Promise.all(
    uniqueIds.map(
      async (currencyId): Promise<readonly [string, string]> => [
        currencyId,
        (await deps.currencies.findById(currencyId)).code,
      ],
    ),
  );

  return new Map(rows);
}

function buildRequestedRouteDraft(input: {
  amountMinor: string;
  amountSide: "source" | "target";
  snapshot: PaymentRouteDraft;
}): PaymentRouteDraft {
  return {
    ...structuredClone(input.snapshot),
    amountInMinor:
      input.amountSide === "source"
        ? input.amountMinor
        : input.snapshot.amountInMinor,
    amountOutMinor:
      input.amountSide === "target"
        ? input.amountMinor
        : input.snapshot.amountOutMinor,
    lockedSide: input.amountSide === "source" ? "currency_in" : "currency_out",
  };
}

function mapRouteRateSourceToQuoteSourceKind(rateSource: string) {
  return rateSource === "market" ? "market" : "derived";
}

function buildRoutePricingTrace(input: {
  context: DealPricingContextRecord;
  dealId: string;
  routePreview: PaymentRouteCalculation;
  templateId: string;
  templateName: string;
}): Record<string, unknown> {
  return {
    version: "v1",
    mode: "explicit_route",
    summary: "Deal pricing via attached payment route",
    metadata: {
      dealId: input.dealId,
      dealPricingRevision: String(input.context.revision),
      routeTemplateId: input.templateId,
      routeTemplateName: input.templateName,
    },
    steps: input.routePreview.legs.map((leg) => ({
      asOf: leg.asOf,
      effectiveRateDen: leg.inputAmountMinor,
      effectiveRateNum: leg.netOutputMinor,
      idx: leg.idx,
      rawRateDen: leg.rateDen,
      rawRateNum: leg.rateNum,
      rateSource: leg.rateSource,
    })),
  };
}

function buildRouteManualFinancialLines(input: {
  fromCurrency: string;
  routePreview: PaymentRouteCalculation;
}) {
  return input.routePreview.executionCostLines
    .filter(
      (line) =>
        line.treatment === "separate_expense" &&
        BigInt(line.routeInputImpactMinor) > 0n,
    )
    .map((line) => {
      return {
        amountMinor: BigInt(line.routeInputImpactMinor),
        bucket: "execution_expense" as const,
        currency: input.fromCurrency,
        id: `${line.location}:${line.id}`,
        memo: line.label ?? line.id,
        metadata: {
          paymentRouteCostApplication: line.application,
          paymentRouteCostTreatment: line.treatment,
          paymentRouteFeeId: line.id,
          paymentRouteFeeKind: line.kind,
          paymentRouteFeeLocation: line.location,
        },
        source: "manual" as const,
      };
    });
}

function resolveExecutionSource(
  context: DealPricingContextRecord,
  override?: ExecutionSource,
): ExecutionSource {
  return override ?? context.commercialDraft.executionSource ?? { type: "route_execution" };
}

function calculateInventoryCostMinor(input: {
  amountMinor: bigint;
  costAmountMinor: bigint;
  acquiredAmountMinor: bigint;
}) {
  if (input.acquiredAmountMinor <= 0n) return 0n;
  return mulDivRoundHalfUp(
    input.amountMinor,
    input.costAmountMinor,
    input.acquiredAmountMinor,
  );
}

async function resolveExecutionSide(input: {
  amountMinor: bigint;
  deps: DealPricingWorkflowDeps;
  executionSource: ExecutionSource;
  quotePreview: QuotePreviewRecord;
  routePreview: PaymentRouteCalculation | null;
}): Promise<ExecutionSideSnapshot> {
  if (input.executionSource.type === "treasury_inventory") {
    const position =
      await input.deps.treasury.treasuryOrders.queries.findInventoryPositionById(
        { positionId: input.executionSource.inventoryPositionId },
      );
    if (!position) {
      throw new ValidationError(
        `Treasury inventory position ${input.executionSource.inventoryPositionId} is not available`,
      );
    }
    const targetCurrency = await input.deps.currencies.findByCode(
      input.quotePreview.toCurrency,
    );
    if (position.currencyId !== targetCurrency.id) {
      throw new ValidationError(
        `Treasury inventory position ${position.id} does not match quote target currency`,
      );
    }
    const allocatedCostMinor = calculateInventoryCostMinor({
      acquiredAmountMinor: position.acquiredAmountMinor,
      amountMinor: input.amountMinor,
      costAmountMinor: position.costAmountMinor,
    });
    return {
      executionCostLines: [],
      executionRate: {
        rateDen: allocatedCostMinor.toString(),
        rateNum: input.amountMinor.toString(),
      },
      inventoryPositionId: position.id,
      routeCostMinor: allocatedCostMinor.toString(),
      routeFundingMinor: allocatedCostMinor.toString(),
      source: "treasury_inventory",
    };
  }

  const routeCostMinor = input.routePreview
    ? input.routePreview.costPriceInMinor
    : input.quotePreview.fromAmountMinor.toString();
  const routeFundingMinor = input.routePreview
    ? input.routePreview.amountInMinor
    : input.quotePreview.fromAmountMinor.toString();

  return {
    executionCostLines: input.routePreview?.executionCostLines ?? [],
    executionRate: {
      rateDen: routeCostMinor,
      rateNum: input.quotePreview.toAmountMinor.toString(),
    },
    routeCostMinor,
    routeFundingMinor,
    source: "route_execution",
  };
}

function resolveCommercialFeeMinor(input: {
  commercialDraft: DealPricingCommercialDraft;
  sourceCurrency: string;
}) {
  const clientPricing = input.commercialDraft.clientPricing;
  if (clientPricing?.commercialFeeMinor) {
    return BigInt(clientPricing.commercialFeeMinor);
  }
  if (
    input.commercialDraft.fixedFeeAmount &&
    (!input.commercialDraft.fixedFeeCurrency ||
      input.commercialDraft.fixedFeeCurrency === input.sourceCurrency)
  ) {
    return BigInt(
      toMinorAmountString(
        input.commercialDraft.fixedFeeAmount,
        input.sourceCurrency,
      ),
    );
  }
  return 0n;
}

function resolveClientSide(input: {
  commercialDraft: DealPricingCommercialDraft;
  executionSide: ExecutionSideSnapshot;
  quotePreview: QuotePreviewRecord;
}): ClientSideSnapshot {
  const draft = input.commercialDraft.clientPricing;
  const beneficiaryAmountMinor = input.quotePreview.toAmountMinor;
  const fallbackRate = input.executionSide.executionRate ?? {
    rateDen: input.executionSide.routeCostMinor,
    rateNum: beneficiaryAmountMinor.toString(),
  };
  const mode = draft?.mode ?? "client_rate";
  const explicitRate = draft?.clientRate ?? null;
  const commercialFeeMinor = resolveCommercialFeeMinor({
    commercialDraft: input.commercialDraft,
    sourceCurrency: input.quotePreview.fromCurrency,
  });
  const separateExecutionCostMinor =
    draft?.passThroughPolicy === "separate_execution_costs"
      ? input.executionSide.executionCostLines
          .filter((line) => line.treatment === "separate_expense")
          .reduce(
            (sum, line) => sum + BigInt(line.routeInputImpactMinor),
            0n,
          )
      : 0n;
  const discountMinor = draft?.discountMinor ? BigInt(draft.discountMinor) : 0n;
  const clientTotalMinor =
    mode === "client_total" && draft?.clientTotalMinor
      ? BigInt(draft.clientTotalMinor)
      : null;
  const clientPrincipalMinor =
    clientTotalMinor !== null
      ? clientTotalMinor -
        commercialFeeMinor -
        separateExecutionCostMinor +
        discountMinor
      : mulDivRoundHalfUp(
          beneficiaryAmountMinor,
          BigInt((explicitRate ?? fallbackRate).rateDen),
          BigInt((explicitRate ?? fallbackRate).rateNum),
        );
  if (clientPrincipalMinor < 0n) {
    throw new ValidationError(
      "Customer total is lower than mandatory commercial fees and reimbursements",
    );
  }
  const clientRate =
    clientTotalMinor !== null
      ? {
          rateDen: clientPrincipalMinor.toString(),
          rateNum: beneficiaryAmountMinor.toString(),
        }
      : (explicitRate ?? fallbackRate);
  const customerTotalMinor =
    clientTotalMinor ??
    clientPrincipalMinor +
      commercialFeeMinor +
      separateExecutionCostMinor -
      discountMinor;

  return {
    beneficiaryAmountMinor: beneficiaryAmountMinor.toString(),
    clientPrincipalMinor: clientPrincipalMinor.toString(),
    clientRate,
    commercialFeeMinor: commercialFeeMinor.toString(),
    customerTotalMinor: customerTotalMinor.toString(),
    discountMinor: discountMinor.toString(),
    passThroughMinor: separateExecutionCostMinor.toString(),
    pricingMode: mode,
  };
}

function resolvePnl(input: {
  clientSide: ClientSideSnapshot;
  executionSide: ExecutionSideSnapshot;
}): PnlSnapshot {
  const costMinor = BigInt(input.executionSide.routeCostMinor);
  const revenueMinor = BigInt(input.clientSide.customerTotalMinor);
  const grossProfitMinor = revenueMinor - costMinor;
  return {
    costMinor: costMinor.toString(),
    grossProfitMinor: grossProfitMinor.toString(),
    profitPercentOnCost:
      costMinor === 0n
        ? "0"
        : formatFractionDecimal(grossProfitMinor * 100n, costMinor, {
            scale: 2,
          }),
    revenueMinor: revenueMinor.toString(),
  };
}

function buildCrmManualFinancialLines(input: {
  clientSide: ClientSideSnapshot;
  sourceCurrency: string;
}) {
  const lines: NonNullable<PreviewQuoteInput["manualFinancialLines"]> = [];
  const commercialFeeMinor = BigInt(input.clientSide.commercialFeeMinor);
  if (commercialFeeMinor > 0n) {
    lines.push({
      amountMinor: commercialFeeMinor,
      bucket: "commercial_revenue",
      currency: input.sourceCurrency,
      id: "crm:commercial_fee",
      memo: "Commercial fee",
      metadata: { crmPricingComponent: "commercial_fee" },
      source: "manual",
    });
  }
  const discountMinor = BigInt(input.clientSide.discountMinor);
  if (discountMinor > 0n) {
    lines.push({
      amountMinor: discountMinor,
      bucket: "commercial_discount",
      currency: input.sourceCurrency,
      id: "crm:commercial_discount",
      memo: "Commercial discount",
      metadata: { crmPricingComponent: "commercial_discount" },
      source: "manual",
    });
  }
  const passThroughMinor = BigInt(input.clientSide.passThroughMinor);
  if (passThroughMinor > 0n) {
    lines.push({
      amountMinor: passThroughMinor,
      bucket: "pass_through_reimbursement",
      currency: input.sourceCurrency,
      id: "crm:pass_through_reimbursement",
      memo: "Execution cost reimbursement",
      metadata: { crmPricingComponent: "pass_through_reimbursement" },
      source: "manual",
    });
  }
  return lines;
}

function mergeRequiredMinor(
  totals: Map<string, bigint>,
  currencyId: string,
  amountMinor: bigint,
) {
  const absolute = amountMinor < 0n ? -amountMinor : amountMinor;
  const existing = totals.get(currencyId) ?? 0n;

  if (absolute > existing) {
    totals.set(currencyId, absolute);
  }
}

async function buildFundingPositions(input: {
  context: DealPricingContextRecord;
  deps: DealPricingWorkflowDeps;
  quotePreview: QuotePreviewRecord;
  routePreview: PaymentRouteCalculation | null;
}): Promise<DealFundingPosition[]> {
  const requiredByCurrency = new Map<string, bigint>();

  if (input.routePreview) {
    mergeRequiredMinor(
      requiredByCurrency,
      input.routePreview.currencyInId,
      BigInt(input.routePreview.costPriceInMinor),
    );

    for (const leg of input.routePreview.legs) {
      mergeRequiredMinor(
        requiredByCurrency,
        leg.toCurrencyId,
        BigInt(leg.grossOutputMinor),
      );
    }
  } else {
    const [fromCurrency, toCurrency] = await Promise.all([
      input.deps.currencies.findByCode(input.quotePreview.fromCurrency),
      input.deps.currencies.findByCode(input.quotePreview.toCurrency),
    ]);

    mergeRequiredMinor(
      requiredByCurrency,
      fromCurrency.id,
      input.quotePreview.fromAmountMinor,
    );
    mergeRequiredMinor(
      requiredByCurrency,
      toCurrency.id,
      input.quotePreview.toAmountMinor,
    );
  }

  const currencyCodes = await resolveCurrencyCodes(input.deps, [
    ...requiredByCurrency.keys(),
    ...input.context.fundingAdjustments.map((adjustment) => adjustment.currencyId),
  ]);
  const adjustmentByCurrency = input.context.fundingAdjustments.reduce(
    (totals, adjustment) => {
      totals.set(
        adjustment.currencyId,
        (totals.get(adjustment.currencyId) ?? 0n) +
          BigInt(adjustment.amountMinor),
      );
      return totals;
    },
    new Map<string, bigint>(),
  );

  return Array.from(requiredByCurrency.entries())
    .map(([currencyId, requiredMinor]) => {
      const adjustmentTotalMinor = adjustmentByCurrency.get(currencyId) ?? 0n;

      return {
        adjustmentTotalMinor: adjustmentTotalMinor.toString(),
        currencyCode: currencyCodes.get(currencyId) ?? currencyId,
        currencyId,
        netFundingNeedMinor: (requiredMinor - adjustmentTotalMinor).toString(),
        requiredMinor: requiredMinor.toString(),
      };
    })
    .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));
}

async function resolveCommercialTerms(input: {
  deal: DealRecord;
  deps: DealPricingWorkflowDeps;
  fixedFeeCurrencyFallback: string | null;
  pricingContext: DealPricingContextRecord;
}) {
  if (!input.deal.agreementId) {
    throw new ValidationError(`Deal ${input.deal.id} is missing agreementId`);
  }

  const agreement = await input.deps.agreements.agreements.queries.findById(
    input.deal.agreementId,
  );

  if (!agreement) {
    throw new NotFoundError("Agreement", input.deal.agreementId);
  }

  const defaults = extractAgreementCommercialDefaults({
    agreement,
    fallbackFixedFeeCurrency: input.fixedFeeCurrencyFallback,
  });
  const hasClientPricing = input.pricingContext.commercialDraft.clientPricing !== null;

  const resolvedFixedFeeAmount =
    input.pricingContext.commercialDraft.fixedFeeAmount ??
    defaults.fixedFeeAmount;
  const resolvedFixedFeeCurrency =
    input.pricingContext.commercialDraft.fixedFeeCurrency ??
    defaults.fixedFeeCurrency;
  const hasCompleteFixedFee =
    resolvedFixedFeeAmount !== null && resolvedFixedFeeCurrency !== null;

  return {
    agreementVersionId: defaults.agreementVersionId,
    agreementFeeBps: hasClientPricing ? "0" : defaults.agreementFeeBps.toString(),
    fixedFeeAmount:
      hasClientPricing || !hasCompleteFixedFee ? null : resolvedFixedFeeAmount,
    fixedFeeCurrency:
      hasClientPricing || !hasCompleteFixedFee ? null : resolvedFixedFeeCurrency,
    quoteMarkupBps: hasClientPricing
      ? "0"
      : (input.pricingContext.commercialDraft.quoteMarkupBps ?? 0).toString(),
  };
}

async function prepareDealPricingContext(input: {
  dealId: string;
  deps: DealPricingWorkflowDeps;
}): Promise<PreparedDealPricingInput> {
  const [deal, workflow, context] = await Promise.all([
    requireDealRecord(input.deps, input.dealId),
    requireDealWorkflowRecord(input.deps, input.dealId),
    input.deps.deals.deals.queries.findPricingContextByDealId({
      dealId: input.dealId,
    }),
  ]);

  assertDealAllowsCommercialWrite(deal);

  return {
    context,
    deal,
    workflow,
  };
}

function assertPricingContextRevision(input: {
  context: DealPricingContextRecord;
  dealId: string;
  expectedRevision: number;
}) {
  if (input.context.revision !== input.expectedRevision) {
    throw new DealPricingContextRevisionConflictError(
      input.dealId,
      input.expectedRevision,
    );
  }
}

async function buildAutoCrossQuotePayload(input: {
  amountMinor: string;
  amountSide: "source" | "target";
  asOf: Date;
  context: DealPricingContextRecord;
  deal: DealRecord;
  deps: DealPricingWorkflowDeps;
  workflow: DealWorkflowRecord;
}): Promise<QuotePayloadResult> {
  const sourceCurrencyId = input.workflow.intake.moneyRequest.sourceCurrencyId;
  const targetCurrencyId = input.workflow.intake.moneyRequest.targetCurrencyId;

  if (!sourceCurrencyId || !targetCurrencyId) {
    throw new ValidationError(
      `Deal ${input.deal.id} is missing source or target currency`,
    );
  }

  const currencyCodes = await resolveCurrencyCodes(input.deps, [
    sourceCurrencyId,
    targetCurrencyId,
  ]);
  const fromCurrency = currencyCodes.get(sourceCurrencyId)!;
  const toCurrency = currencyCodes.get(targetCurrencyId)!;

  return {
    quoteInput: {
      asOf: input.asOf,
      commercialTerms: await resolveCommercialTerms({
        deal: input.deal,
        deps: input.deps,
        fixedFeeCurrencyFallback: toCurrency,
        pricingContext: input.context,
      }),
      fromCurrency,
      mode: "auto_cross",
      pricingTrace: {
        metadata: {
          dealId: input.deal.id,
          dealPricingRevision: String(input.context.revision),
          pricingFallback: "auto_cross",
        },
        mode: "auto_cross",
        summary: "Deal pricing fallback to auto cross",
        version: "v1",
      },
      toCurrency,
      ...(input.amountSide === "source"
        ? { fromAmountMinor: BigInt(input.amountMinor) }
        : { toAmountMinor: BigInt(input.amountMinor) }),
    } satisfies PreviewQuoteInput,
    routePreview: null,
  };
}

async function buildExplicitRouteQuotePayload(input: {
  amountMinor: string;
  amountSide: "source" | "target";
  asOf: Date;
  context: DealPricingContextRecord;
  deal: DealRecord;
  deps: DealPricingWorkflowDeps;
  workflow: DealWorkflowRecord;
}): Promise<QuotePayloadResult> {
  const routeAttachment = input.context.routeAttachment;

  if (!routeAttachment) {
    throw new ValidationError("Deal pricing route is not attached");
  }

  if (
    input.workflow.intake.moneyRequest.sourceCurrencyId !==
      routeAttachment.snapshot.currencyInId ||
    input.workflow.intake.moneyRequest.targetCurrencyId !==
      routeAttachment.snapshot.currencyOutId
  ) {
    throw new ValidationError(
      `Deal ${input.deal.id} currencies no longer match the attached route`,
    );
  }

  const requestedDraft = buildRequestedRouteDraft({
    amountMinor: input.amountMinor,
    amountSide: input.amountSide,
    snapshot: routeAttachment.snapshot,
  });
  const routePreview =
    await input.deps.treasury.paymentRoutes.queries.previewTemplate({
      asOf: input.asOf,
      draft: requestedDraft,
    });
  const currencyCodes = await resolveCurrencyCodes(input.deps, [
    routePreview.currencyInId,
    routePreview.currencyOutId,
    ...routePreview.legs.flatMap((leg: PaymentRouteCalculation["legs"][number]) => [
      leg.fromCurrencyId,
      leg.toCurrencyId,
    ]),
  ]);
  const fromCurrency = currencyCodes.get(routePreview.currencyInId)!;
  const toCurrency = currencyCodes.get(routePreview.currencyOutId)!;

  return {
    quoteInput: {
      asOf: input.asOf,
      commercialTerms: await resolveCommercialTerms({
        deal: input.deal,
        deps: input.deps,
        fixedFeeCurrencyFallback: toCurrency,
        pricingContext: input.context,
      }),
      fromCurrency,
      legs: routePreview.legs.map((leg: PaymentRouteCalculation["legs"][number]) => ({
        asOf: new Date(leg.asOf),
        executionCounterpartyId: undefined,
        fromCurrency: currencyCodes.get(leg.fromCurrencyId)!,
        rateDen: BigInt(leg.inputAmountMinor),
        rateNum: BigInt(leg.netOutputMinor),
        sourceKind: mapRouteRateSourceToQuoteSourceKind(leg.rateSource),
        sourceRef: `payment_route_leg:${leg.id}:${leg.rateSource}`,
        toCurrency: currencyCodes.get(leg.toCurrencyId)!,
      })),
      manualFinancialLines: buildRouteManualFinancialLines({
        fromCurrency,
        routePreview,
      }),
      mode: "explicit_route",
      pricingTrace: buildRoutePricingTrace({
        context: input.context,
        dealId: input.deal.id,
        routePreview,
        templateId: routeAttachment.templateId,
        templateName: routeAttachment.templateName,
      }),
      toCurrency,
      ...(input.amountSide === "source"
        ? { fromAmountMinor: BigInt(input.amountMinor) }
        : { toAmountMinor: BigInt(input.amountMinor) }),
    } satisfies PreviewQuoteInput,
    routePreview,
  };
}

function ensureCurrencyPair(input: {
  routePreview: PaymentRouteCalculation | null;
  quotePreview: QuotePreviewRecord;
}): CurrencyPairRequirement {
  return {
    fromCurrency: input.routePreview
      ? input.quotePreview.fromCurrency
      : input.quotePreview.fromCurrency,
    toCurrency: input.quotePreview.toCurrency,
  };
}

function createRateSnapshot(input: {
  asOf: Date;
  baseCurrency: string;
  quoteCurrency: string;
  rateDen: bigint;
  rateNum: bigint;
  sourceKind: DealPricingRateSnapshot["sourceKind"];
  sourceLabel: string | null;
}): DealPricingRateSnapshot {
  return {
    asOf: input.asOf,
    baseCurrency: input.baseCurrency,
    quoteCurrency: input.quoteCurrency,
    rateDen: input.rateDen.toString(),
    rateNum: input.rateNum.toString(),
    sourceKind: input.sourceKind,
    sourceLabel: input.sourceLabel,
  };
}

function composeRouteRate(routePreview: PaymentRouteCalculation) {
  return routePreview.legs.reduce(
    (combined, leg) => ({
      rateDen: combined.rateDen * BigInt(leg.rateDen),
      rateNum: combined.rateNum * BigInt(leg.rateNum),
    }),
    {
      rateDen: 1n,
      rateNum: 1n,
    },
  );
}

async function convertMinorAmount(input: {
  amountMinor: bigint;
  asOf: Date;
  deps: DealPricingWorkflowDeps;
  fromCurrency: string;
  toCurrency: string;
  cache: Map<string, { rateDen: bigint; rateNum: bigint }>;
}): Promise<bigint> {
  if (input.fromCurrency === input.toCurrency) {
    return input.amountMinor;
  }

  const cacheKey = `${input.fromCurrency}:${input.toCurrency}:${input.asOf.toISOString()}`;
  let cross = input.cache.get(cacheKey);

  if (!cross) {
    const resolved = await input.deps.treasury.rates.queries.getCrossRate(
      input.fromCurrency,
      input.toCurrency,
      input.asOf,
      "USD",
    );
    cross = {
      rateDen: resolved.rateDen,
      rateNum: resolved.rateNum,
    };
    input.cache.set(cacheKey, cross);
  }

  return mulDivRoundHalfUp(input.amountMinor, cross.rateNum, cross.rateDen);
}

async function summarizeFinancialLinesInSourceCurrency(input: {
  asOf: Date;
  deps: DealPricingWorkflowDeps;
  financialLines: QuotePreviewRecord["financialLines"];
  sourceCurrency: string;
}) {
  const totals = {
    commercialDiscountMinor: 0n,
    commercialRevenueMinor: 0n,
    passThroughMinor: 0n,
  };
  const cache = new Map<string, { rateDen: bigint; rateNum: bigint }>();

  for (const line of input.financialLines) {
    const amountMinor = await convertMinorAmount({
      amountMinor: line.amountMinor,
      asOf: input.asOf,
      deps: input.deps,
      fromCurrency: line.currency,
      toCurrency: input.sourceCurrency,
      cache,
    });

    if (
      line.bucket === "pass_through" ||
      line.bucket === "pass_through_reimbursement"
    ) {
      totals.passThroughMinor += amountMinor;
    }

    if (
      line.bucket === "fee_revenue" ||
      line.bucket === "spread_revenue" ||
      line.bucket === "commercial_revenue"
    ) {
      totals.commercialRevenueMinor += amountMinor;
    }

    if (line.bucket === "commercial_discount") {
      totals.commercialDiscountMinor += amountMinor;
    }
  }

  return totals;
}

async function buildBenchmarks(input: {
  asOf: Date;
  commercialRevenueMinor: bigint;
  deps: DealPricingWorkflowDeps;
  quotePreview: QuotePreviewRecord;
  routePreview: PaymentRouteCalculation | null;
}): Promise<DealPricingBenchmarks> {
  const pair = ensureCurrencyPair({
    quotePreview: input.quotePreview,
    routePreview: input.routePreview,
  });
  const marketRate = await input.deps.treasury.rates.queries.getCrossRate(
    pair.fromCurrency,
    pair.toCurrency,
    input.asOf,
    "USD",
  );
  const routeRate = input.routePreview
    ? composeRouteRate(input.routePreview)
    : null;

  // All-in customer rate = base rate × (principal + commercialRevenue) / principal.
  // commercialRevenue is bucketed as fee_revenue + spread_revenue and isn't folded
  // into quotePreview.rateNum/rateDen, so we scale the base rate accordingly.
  const principal = input.quotePreview.fromAmountMinor;
  const clientRateMultiplier = principal + input.commercialRevenueMinor;
  const clientRateNum =
    principal > 0n
      ? input.quotePreview.rateNum * principal
      : input.quotePreview.rateNum;
  const clientRateDen =
    principal > 0n
      ? input.quotePreview.rateDen * clientRateMultiplier
      : input.quotePreview.rateDen;

  return {
    client: createRateSnapshot({
      asOf: input.asOf,
      baseCurrency: pair.fromCurrency,
      quoteCurrency: pair.toCurrency,
      rateDen: clientRateDen,
      rateNum: clientRateNum,
      sourceKind: "client",
      sourceLabel: "Курс клиенту",
    }),
    cost:
      input.routePreview && input.quotePreview.toAmountMinor > 0n
        ? createRateSnapshot({
            asOf: input.asOf,
            baseCurrency: pair.fromCurrency,
            quoteCurrency: pair.toCurrency,
            rateDen: BigInt(input.routePreview.costPriceInMinor),
            rateNum: input.quotePreview.toAmountMinor,
            sourceKind: "cost",
            sourceLabel: "Курс себестоимости",
          })
        : null,
    market: createRateSnapshot({
      asOf: input.asOf,
      baseCurrency: pair.fromCurrency,
      quoteCurrency: pair.toCurrency,
      rateDen: marketRate.rateDen,
      rateNum: marketRate.rateNum,
      sourceKind: "market",
      sourceLabel: describeMarketRateSource(marketRate.source),
    }),
    pricingBase: input.routePreview ? "route_benchmark" : "market_benchmark",
    routeBase: routeRate
      ? createRateSnapshot({
          asOf: input.asOf,
          baseCurrency: pair.fromCurrency,
          quoteCurrency: pair.toCurrency,
          rateDen: routeRate.rateDen,
          rateNum: routeRate.rateNum,
          sourceKind: "route",
          sourceLabel: "Базовый курс маршрута",
        })
      : null,
  };
}

async function buildProfitability(input: {
  asOf: Date;
  crmPricingSnapshot?: CrmPricingSnapshot;
  financialSummary: {
    commercialRevenueMinor: bigint;
    passThroughMinor: bigint;
  };
  quotePreview: QuotePreviewRecord;
  routePreview: PaymentRouteCalculation | null;
}): Promise<DealPricingProfitability | null> {
  if (input.crmPricingSnapshot) {
    const clientSide = input.crmPricingSnapshot.clientSide;
    const pnl = input.crmPricingSnapshot.pnl;
    return {
      commercialDiscountMinor: clientSide.discountMinor,
      commercialRevenueMinor: clientSide.commercialFeeMinor,
      costPriceMinor: pnl.costMinor,
      currency: input.quotePreview.fromCurrency,
      customerPrincipalMinor: clientSide.clientPrincipalMinor,
      customerTotalMinor: clientSide.customerTotalMinor,
      passThroughMinor: clientSide.passThroughMinor,
      profitMinor: pnl.grossProfitMinor,
      profitPercentOnCost: pnl.profitPercentOnCost,
    };
  }

  const sourceCurrency = input.quotePreview.fromCurrency;
  const financialSummary = input.financialSummary;
  const customerPrincipalMinor = input.quotePreview.fromAmountMinor;
  const costPriceMinor = input.routePreview
    ? BigInt(input.routePreview.costPriceInMinor)
    : input.quotePreview.fromAmountMinor;
  const customerTotalMinor =
    customerPrincipalMinor +
    financialSummary.commercialRevenueMinor +
    financialSummary.passThroughMinor;
  const profitMinor = customerTotalMinor - costPriceMinor;
  const profitPercentOnCost =
    costPriceMinor === 0n
      ? "0"
      : formatFractionDecimal(profitMinor * 100n, costPriceMinor, {
          scale: 2,
        });

  return {
    commercialDiscountMinor: "0",
    commercialRevenueMinor: financialSummary.commercialRevenueMinor.toString(),
    costPriceMinor: costPriceMinor.toString(),
    currency: sourceCurrency,
    customerPrincipalMinor: customerPrincipalMinor.toString(),
    customerTotalMinor: customerTotalMinor.toString(),
    passThroughMinor: financialSummary.passThroughMinor.toString(),
    profitMinor: profitMinor.toString(),
    profitPercentOnCost,
  };
}

function formatMinorValue(amountMinor: bigint | string, currency: string) {
  return minorToAmountString(amountMinor, { currency });
}

function formatAmountLabel(amountMinor: bigint | string, currency: string) {
  return `${formatMinorValue(amountMinor, currency)} ${currency}`;
}

function formatRateValue(rateNum: bigint | string, rateDen: bigint | string) {
  return formatFractionDecimal(rateNum, rateDen, { scale: 6 });
}

function buildAmountSnapshot(input: {
  amountSide: "source" | "target";
  profitability: DealPricingProfitability | null;
  quotePreview: QuotePreviewRecord;
  requestedAmountMinor: string;
}): DealPricingAmountSnapshot {
  return {
    amountSide: input.amountSide,
    commercialRevenueMinor: input.profitability?.commercialRevenueMinor ?? "0",
    customerDebitMinor:
      input.profitability?.customerTotalMinor ??
      input.quotePreview.fromAmountMinor.toString(),
    customerReceivesMinor: input.quotePreview.toAmountMinor.toString(),
    fxPrincipalFromAmountMinor: input.quotePreview.fromAmountMinor.toString(),
    passThroughMinor: input.profitability?.passThroughMinor ?? "0",
    requestedAmountMinor: input.requestedAmountMinor,
  };
}

function normalizeRateSourceLabel(rateSource: string) {
  switch (rateSource) {
    case "market":
      return "Рынок";
    case "cb":
      return "ЦБ";
    case "bank":
      return "Банк";
    case "manual":
      return "Ручной курс";
    case "derived":
      return "Производный курс";
    default:
      return rateSource;
  }
}

function buildClientPricingLines(input: {
  amountSide: "source" | "target";
  benchmarks: DealPricingBenchmarks;
  profitability: DealPricingProfitability | null;
  pricingContext: DealPricingContextRecord;
  quotePreview: QuotePreviewRecord;
}): DealPricingFormulaLine[] {
  const lines: DealPricingFormulaLine[] = [];
  const clientRate = input.benchmarks.client;
  const reverseRate = formatRateValue(clientRate.rateDen, clientRate.rateNum);
  const fromAmount = formatAmountLabel(
    input.quotePreview.fromAmountMinor,
    input.quotePreview.fromCurrency,
  );
  const toAmount = formatAmountLabel(
    input.quotePreview.toAmountMinor,
    input.quotePreview.toCurrency,
  );
  const customerDebit = input.profitability
    ? formatAmountLabel(
        input.profitability.customerTotalMinor,
        input.profitability.currency,
      )
    : fromAmount;
  const commercialRevenueMinor = input.profitability
    ? BigInt(input.profitability.commercialRevenueMinor)
    : 0n;
  const passThroughMinor = input.profitability
    ? BigInt(input.profitability.passThroughMinor)
    : 0n;
  const extraChargesMinor = commercialRevenueMinor + passThroughMinor;

  if (input.amountSide === "target") {
    lines.push({
      currency: input.quotePreview.toCurrency,
      expression: toAmount,
      kind: "note",
      label: "Бенефициар получит",
      metadata: {
        pricingBase: input.benchmarks.pricingBase,
      },
      result: toAmount,
    });
    lines.push({
      currency: input.quotePreview.fromCurrency,
      expression:
        extraChargesMinor > 0n
          ? `${fromAmount} + ${formatAmountLabel(
              extraChargesMinor,
              input.quotePreview.fromCurrency,
            )} = ${customerDebit}`
          : `${toAmount} × ${reverseRate} = ${customerDebit}`,
      kind: "equation",
      label: "Cписание c клиента",
      metadata: {
        pricingBase: input.benchmarks.pricingBase,
      },
      result: customerDebit,
    });
  } else {
    lines.push({
      currency: input.quotePreview.toCurrency,
      expression: `${fromAmount} / ${reverseRate} = ${toAmount}`,
      kind: "equation",
      label: "Расчёт получения",
      metadata: {
        pricingBase: input.benchmarks.pricingBase,
      },
      result: toAmount,
    });
  }

  const pricingBaseRate =
    input.benchmarks.routeBase ?? input.benchmarks.market;
  const pricingBaseLabel =
    input.benchmarks.pricingBase === "route_benchmark"
      ? "База расчета: базовый курс маршрута"
      : "База расчета: рыночный курс";
  lines.push({
    currency: null,
    expression: `${pricingBaseRate.quoteCurrency}/${pricingBaseRate.baseCurrency} ${formatRateValue(
      pricingBaseRate.rateDen,
      pricingBaseRate.rateNum,
    )}`,
    kind: "note",
    label: pricingBaseLabel,
    metadata: {
      sourceLabel: pricingBaseRate.sourceLabel,
    },
    result: pricingBaseRate.sourceLabel ?? "Курс принят в расчет",
  });

  if (input.profitability) {
    lines.push({
      currency: input.profitability.currency,
      expression: `${formatAmountLabel(
        input.profitability.customerTotalMinor,
        input.profitability.currency,
      )} − ${formatAmountLabel(
        input.profitability.costPriceMinor,
        input.profitability.currency,
      )}`,
      kind: "note",
      label: "P&L",
      metadata: {},
      result: formatAmountLabel(
        input.profitability.profitMinor,
        input.profitability.currency,
      ),
    });
    if (extraChargesMinor !== 0n) {
      lines.push({
        currency: input.profitability.currency,
        expression: formatAmountLabel(
          extraChargesMinor,
          input.profitability.currency,
        ),
        kind: "note",
        label: "Комиссии / компенсации",
        metadata: {},
        result: formatAmountLabel(
          input.profitability.customerTotalMinor,
          input.profitability.currency,
        ),
      });
    }
  }

  return lines;
}

function buildRouteExecutionLines(input: {
  currencyCodeById: Map<string, string>;
  routePreview: PaymentRouteCalculation | null;
}): DealPricingFormulaLine[] {
  if (!input.routePreview) {
    return [
      {
        currency: null,
        expression: "Маршрут не выбран, используется автоподбор по рынку",
        kind: "note",
        label: "Исполнение маршрута",
        metadata: {},
        result: "Шагов маршрута нет",
      },
    ];
  }

  return input.routePreview.legs.flatMap((leg) => {
    const fromCurrency =
      input.currencyCodeById.get(leg.fromCurrencyId) ?? leg.fromCurrencyId;
    const toCurrency =
      input.currencyCodeById.get(leg.toCurrencyId) ?? leg.toCurrencyId;
    const fromAmount = formatAmountLabel(leg.inputAmountMinor, fromCurrency);
    const toAmount = formatAmountLabel(leg.netOutputMinor, toCurrency);
    const lines: DealPricingFormulaLine[] = [
      {
        currency: toCurrency,
        expression:
          fromCurrency === toCurrency
            ? `${fromAmount} = ${toAmount}`
            : `${fromAmount} × ${formatRateValue(leg.rateNum, leg.rateDen)} = ${toAmount}`,
        kind: "equation",
        label: `Шаг ${leg.idx}: ${fromCurrency} → ${toCurrency}`,
        metadata: {
          legId: leg.id,
          rateSource: leg.rateSource,
        },
        result: toAmount,
      },
    ];

    if (leg.fees.length > 0) {
      const feeLabels = leg.fees.map((fee) => {
        if (fee.kind === "fixed") {
          return `${fee.label ?? "Расход"} ${formatAmountLabel(
            fee.routeInputImpactMinor,
            fromCurrency,
          )}`;
        }

        return `${fee.label ?? "Расход"} ${fee.percentage ?? "0"}%`;
      });
      lines.push({
        currency: fromCurrency,
        expression: feeLabels.join(" + "),
        kind: "note",
        label: `Расходы шага ${leg.idx}`,
        metadata: {
          legId: leg.id,
        },
        result: feeLabels.join(", "),
      });
    }

    lines.push({
      currency: null,
      expression: `${normalizeRateSourceLabel(leg.rateSource)} · ${new Date(
        leg.asOf,
      ).toLocaleDateString("ru-RU")}`,
      kind: "note",
      label: `Источник курса шага ${leg.idx}`,
      metadata: {
        legId: leg.id,
      },
      result:
        fromCurrency === toCurrency
          ? "Шаг без конвертации"
          : `${fromCurrency}/${toCurrency}`,
    });

    return lines;
  });
}

function buildFundingEquation(
  position: DealFundingPosition,
  adjustments: DealFundingAdjustment[],
): string {
  const parts = [
    formatAmountLabel(position.requiredMinor, position.currencyCode),
  ];

  for (const adjustment of adjustments) {
    const minor = BigInt(adjustment.amountMinor);
    const absolute = minor < 0n ? -minor : minor;
    const sign = minor >= 0n ? "-" : "+";

    parts.push(`${sign} ${formatAmountLabel(absolute, position.currencyCode)}`);
  }

  return `${parts.join(" ")} = ${formatAmountLabel(
    position.netFundingNeedMinor,
    position.currencyCode,
  )}`;
}

function buildFundingLines(input: {
  context: DealPricingContextRecord;
  fundingPositions: DealFundingPosition[];
}): DealPricingFormulaLine[] {
  if (input.fundingPositions.length === 0) {
    return [
      {
        currency: null,
        expression: "Потребность в обеспечении пока не рассчитана",
        kind: "note",
        label: "Обеспечение сделки",
        metadata: {},
        result: "Нет данных",
      },
    ];
  }

  return input.fundingPositions.flatMap((position) => {
    const adjustments = input.context.fundingAdjustments.filter(
      (adjustment) => adjustment.currencyId === position.currencyId,
    );
    const lines: DealPricingFormulaLine[] = [
      {
        currency: position.currencyCode,
        expression: buildFundingEquation(position, adjustments),
        kind: "equation",
        label: `${position.currencyCode}: нужно обеспечить`,
        metadata: {},
        result: formatAmountLabel(
          position.netFundingNeedMinor,
          position.currencyCode,
        ),
      },
    ];

    for (const adjustment of adjustments) {
      lines.push({
        currency: position.currencyCode,
        expression: formatAmountLabel(
          adjustment.amountMinor,
          position.currencyCode,
        ),
        kind: "note",
        label: `${FUNDING_ADJUSTMENT_KIND_LABELS[adjustment.kind]} · ${adjustment.label}`,
        metadata: {
          adjustmentId: adjustment.id,
          kind: adjustment.kind,
        },
        result: formatAmountLabel(
          adjustment.amountMinor,
          position.currencyCode,
        ),
      });
    }

    return lines;
  });
}

async function buildFormulaTrace(input: {
  amountSide: "source" | "target";
  benchmarks: DealPricingBenchmarks;
  context: DealPricingContextRecord;
  currencyCodeById: Map<string, string>;
  fundingPositions: DealFundingPosition[];
  profitability: DealPricingProfitability | null;
  quotePreview: QuotePreviewRecord;
  routePreview: PaymentRouteCalculation | null;
}): Promise<DealPricingFormulaTrace> {
  return {
    sections: [
      {
        kind: "client_pricing",
        lines: buildClientPricingLines({
          amountSide: input.amountSide,
          benchmarks: input.benchmarks,
          pricingContext: input.context,
          profitability: input.profitability,
          quotePreview: input.quotePreview,
        }),
        title: "Цена клиенту",
      },
      {
        kind: "route_execution",
        lines: buildRouteExecutionLines({
          currencyCodeById: input.currencyCodeById,
          routePreview: input.routePreview,
        }),
        title: "Исполнение маршрута",
      },
      {
        kind: "funding",
        lines: buildFundingLines({
          context: input.context,
          fundingPositions: input.fundingPositions,
        }),
        title: "Обеспечение сделки",
      },
    ],
  };
}

async function buildPricingArtifacts(input: {
  amountSide: "source" | "target";
  asOf: Date;
  context: DealPricingContextRecord;
  crmPricingSnapshot: CrmPricingSnapshot;
  deps: DealPricingWorkflowDeps;
  fundingPositions: DealFundingPosition[];
  quotePreview: QuotePreviewRecord;
  routePreview: PaymentRouteCalculation | null;
}): Promise<PricingArtifacts> {
  const financialSummary = await summarizeFinancialLinesInSourceCurrency({
    asOf: input.asOf,
    deps: input.deps,
    financialLines: input.quotePreview.financialLines,
    sourceCurrency: input.quotePreview.fromCurrency,
  });
  const benchmarks = await buildBenchmarks({
    asOf: input.asOf,
    commercialRevenueMinor:
      BigInt(input.crmPricingSnapshot.clientSide.customerTotalMinor) -
      input.quotePreview.fromAmountMinor,
    deps: input.deps,
    quotePreview: input.quotePreview,
    routePreview: input.routePreview,
  });
  const profitability = await buildProfitability({
    asOf: input.asOf,
    crmPricingSnapshot: input.crmPricingSnapshot,
    financialSummary,
    quotePreview: input.quotePreview,
    routePreview: input.routePreview,
  });
  const currencyIds = [
    ...(input.routePreview
      ? [
          input.routePreview.currencyInId,
          input.routePreview.currencyOutId,
          ...input.routePreview.legs.flatMap((leg) => [
            leg.fromCurrencyId,
            leg.toCurrencyId,
          ]),
        ]
      : []),
    ...input.context.fundingAdjustments.map((adjustment) => adjustment.currencyId),
  ];
  const currencyCodeById = await resolveCurrencyCodes(input.deps, currencyIds);
  const formulaTrace = await buildFormulaTrace({
    amountSide: input.amountSide,
    benchmarks,
    context: input.context,
    currencyCodeById,
    fundingPositions: input.fundingPositions,
    profitability,
    quotePreview: input.quotePreview,
    routePreview: input.routePreview,
  });

  return {
    benchmarks,
    crmPricingSnapshot: input.crmPricingSnapshot,
    formulaTrace,
    profitability,
  };
}

function withCrmPricingSnapshot(input: {
  amountSide: "source" | "target";
  benchmarks: DealPricingBenchmarks;
  crmPricingSnapshot: CrmPricingSnapshot;
  formulaTrace: DealPricingFormulaTrace;
  profitability: DealPricingProfitability | null;
  quoteInput: PreviewQuoteInput;
  quotePreview: QuotePreviewRecord;
  requestedAmountMinor: string;
}) {
  const pricingTrace = structuredClone(input.quoteInput.pricingTrace ?? {});
  const metadata =
    pricingTrace.metadata &&
    typeof pricingTrace.metadata === "object" &&
    !Array.isArray(pricingTrace.metadata)
      ? { ...(pricingTrace.metadata as Record<string, unknown>) }
      : {};

  metadata.crmPricingSnapshot = {
    ...input.crmPricingSnapshot,
    amounts: buildAmountSnapshot({
      amountSide: input.amountSide,
      profitability: input.profitability,
      quotePreview: input.quotePreview,
      requestedAmountMinor: input.requestedAmountMinor,
    }),
    benchmarks: input.benchmarks,
    formulaTrace: input.formulaTrace,
    profitability: input.profitability,
  };

  pricingTrace.metadata = metadata;

  return {
    ...input.quoteInput,
    pricingTrace,
  } satisfies PreviewQuoteInput;
}

async function previewWithArtifacts(input: {
  amountMinor: string;
  amountSide: "source" | "target";
  asOf: Date;
  clientPricing?: DealPricingCommercialDraft["clientPricing"];
  executionSource?: DealPricingCommercialDraft["executionSource"];
  prepared: PreparedDealPricingInput;
  deps: DealPricingWorkflowDeps;
}): Promise<
  DealPricingPreviewRecord & {
    crmPricingSnapshot: CrmPricingSnapshot;
    quoteInput: PreviewQuoteInput;
  }
> {
  const pricingContext = input.clientPricing
    ? {
        ...input.prepared.context,
        commercialDraft: {
          ...input.prepared.context.commercialDraft,
          clientPricing: input.clientPricing,
          executionSource: resolveExecutionSource(
            input.prepared.context,
            input.executionSource,
          ),
        },
      }
    : input.executionSource
      ? {
          ...input.prepared.context,
          commercialDraft: {
            ...input.prepared.context.commercialDraft,
            executionSource: input.executionSource,
          },
        }
      : input.prepared.context;
  const payload = input.prepared.context.routeAttachment
    ? await buildExplicitRouteQuotePayload({
        amountMinor: input.amountMinor,
        amountSide: input.amountSide,
        asOf: input.asOf,
        context: pricingContext,
        deal: input.prepared.deal,
        deps: input.deps,
        workflow: input.prepared.workflow,
      })
    : await buildAutoCrossQuotePayload({
        amountMinor: input.amountMinor,
        amountSide: input.amountSide,
        asOf: input.asOf,
        context: pricingContext,
        deal: input.prepared.deal,
        deps: input.deps,
        workflow: input.prepared.workflow,
      });

  const baseQuotePreview = await input.deps.treasury.quotes.queries.previewQuote(
    payload.quoteInput,
  );
  const executionSide = await resolveExecutionSide({
    amountMinor: baseQuotePreview.toAmountMinor,
    deps: input.deps,
    executionSource: resolveExecutionSource(
      pricingContext,
      input.executionSource,
    ),
    quotePreview: baseQuotePreview,
    routePreview: payload.routePreview,
  });
  const clientSide = resolveClientSide({
    commercialDraft: pricingContext.commercialDraft,
    executionSide,
    quotePreview: baseQuotePreview,
  });
  const pnl = resolvePnl({ clientSide, executionSide });
  const crmPricingSnapshot = { clientSide, executionSide, pnl };
  const crmManualLines = buildCrmManualFinancialLines({
    clientSide,
    sourceCurrency: baseQuotePreview.fromCurrency,
  });
  const quoteInputWithCrmLines = {
    ...payload.quoteInput,
    manualFinancialLines: [
      ...(payload.quoteInput.manualFinancialLines ?? []),
      ...crmManualLines,
    ],
  } satisfies PreviewQuoteInput;
  const quotePreview = await input.deps.treasury.quotes.queries.previewQuote(
    quoteInputWithCrmLines,
  );
  const fundingPositions = await buildFundingPositions({
    context: pricingContext,
    deps: input.deps,
    quotePreview,
    routePreview: payload.routePreview,
  });
  const artifacts = await buildPricingArtifacts({
    amountSide: input.amountSide,
    asOf: input.asOf,
    context: pricingContext,
    crmPricingSnapshot,
    deps: input.deps,
    fundingPositions,
    quotePreview,
    routePreview: payload.routePreview,
  });
  const [fromCurrency, toCurrency] = await Promise.all([
    input.deps.currencies.findByCode(quotePreview.fromCurrency),
    input.deps.currencies.findByCode(quotePreview.toCurrency),
  ]);
  const pricingFingerprint = computePricingFingerprint({
    clientPricing: crmPricingSnapshot,
    commercialTerms: quotePreview.commercialTerms
      ? {
          agreementFeeBps: quotePreview.commercialTerms.agreementFeeBps,
          agreementVersionId: quotePreview.commercialTerms.agreementVersionId,
          fixedFeeAmountMinor: quotePreview.commercialTerms.fixedFeeAmountMinor,
          fixedFeeCurrency: quotePreview.commercialTerms.fixedFeeCurrency,
          quoteMarkupBps: quotePreview.commercialTerms.quoteMarkupBps,
        }
      : null,
    fromAmountMinor: quotePreview.fromAmountMinor,
    fromCurrencyId: fromCurrency.id,
    pricingMode: quotePreview.pricingMode,
    routeTemplateId:
      pricingContext.routeAttachment?.templateId ?? null,
    toAmountMinor: quotePreview.toAmountMinor,
    toCurrencyId: toCurrency.id,
  });

  return {
    benchmarks: artifacts.benchmarks,
    formulaTrace: artifacts.formulaTrace,
    fundingSummary: {
      positions: fundingPositions,
    },
    pricingFingerprint,
    pricingMode: payload.routePreview ? "explicit_route" : "auto_cross",
    profitability: artifacts.profitability,
    crmPricingSnapshot: artifacts.crmPricingSnapshot,
    quoteInput: withCrmPricingSnapshot({
      amountSide: input.amountSide,
      benchmarks: artifacts.benchmarks,
      crmPricingSnapshot: artifacts.crmPricingSnapshot,
      formulaTrace: artifacts.formulaTrace,
      profitability: artifacts.profitability,
      quoteInput: quoteInputWithCrmLines,
      quotePreview,
      requestedAmountMinor: input.amountMinor,
    }),
    quotePreview,
    routePreview: payload.routePreview,
  };
}

export function createDealPricingWorkflow(
  deps: DealPricingWorkflowDeps,
): DealPricingWorkflow {
  return {
    async listRoutes(input) {
      const [deal, workflow] = await Promise.all([
        requireDealRecord(deps, input.dealId),
        requireDealWorkflowRecord(deps, input.dealId),
      ]);

      return listRecommendedRoutes(deps, { deal, workflow });
    },

    async attachRoute(input) {
      return attachRouteByTemplateId(deps, input);
    },

    async initializeDefaultRoute(input) {
      const MAX_ATTEMPTS = 3;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const context = await deps.deals.deals.queries.findPricingContextByDealId({
          dealId: input.dealId,
        });

        if (context.routeAttachment) {
          return context;
        }

        const [deal, workflow] = await Promise.all([
          requireDealRecord(deps, input.dealId),
          requireDealWorkflowRecord(deps, input.dealId),
        ]);
        const candidates = await listRecommendedRoutes(deps, { deal, workflow });
        const [topCandidate] = candidates;

        if (!topCandidate) {
          return context;
        }

        try {
          return await attachRouteByTemplateId(deps, {
            dealId: input.dealId,
            routeTemplateId: topCandidate.id,
          });
        } catch (error) {
          if (error instanceof DealPricingContextRevisionConflictError) {
            continue;
          }
          throw error;
        }
      }

      throw new ConflictError(
        "deal_pricing_initialize_route_revision_conflict",
        "Не удалось привязать маршрут по умолчанию: слишком много конфликтов ревизии.",
        { dealId: input.dealId },
      );
    },

    async detachRoute(input) {
      await requireDealRecord(deps, input.dealId);

      return deps.deals.deals.commands.detachPricingRoute({
        dealId: input.dealId,
      });
    },

    async swapRouteTemplate(input) {
      // Pre-validate template before mutating anything: existence, active
      // status, currency-pair match against deal intake, customer-binding
      // compatibility. Any mismatch throws before we cancel draft steps,
      // so a bad routeTemplateId can't leave the deal with cancelled drafts.
      await loadValidatedRouteTemplate(deps, {
        dealId: input.dealId,
        routeTemplateId: input.newRouteTemplateId,
      });

      const steps = await listAllPaymentSteps(deps.treasury.paymentSteps.queries, {
        dealId: input.dealId,
        purpose: "deal_leg",
      });
      const blocking = steps.filter(
        (step) =>
          !["draft", "cancelled", "skipped"].includes(step.state),
      );
      if (blocking.length > 0) {
        throw new ValidationError(
          `Cannot swap route — payment steps are already in execution: ${blocking
            .map((step) => step.state)
            .join(", ")}`,
        );
      }

      await deps.treasury.paymentSteps.commands.cancelDrafts({
        actorUserId: input.actorUserId,
        dealId: input.dealId,
      });

      return deps.deals.deals.commands.swapDealRouteTemplate({
        actorUserId: input.actorUserId,
        dealId: input.dealId,
        memo: input.memo ?? null,
        newRouteTemplateId: input.newRouteTemplateId,
        reasonCode:
          input.reasonCode as Parameters<
            DealsModule["deals"]["commands"]["swapDealRouteTemplate"]
          >[0]["reasonCode"],
      });
    },

    async updateContext(input) {
      await requireDealRecord(deps, input.dealId);

      return deps.deals.deals.commands.updatePricingContext({
        ...input.patch,
        dealId: input.dealId,
      });
    },

    async preview(input) {
      const prepared = await prepareDealPricingContext({
        dealId: input.dealId,
        deps,
      });

      assertPricingContextRevision({
        context: prepared.context,
        dealId: input.dealId,
        expectedRevision: input.expectedRevision,
      });

      const result = await previewWithArtifacts({
        amountMinor: input.amountMinor,
        amountSide: input.amountSide,
        asOf: input.asOf,
        clientPricing: input.clientPricing,
        deps,
        executionSource: input.executionSource,
        prepared,
      });

      return {
        benchmarks: result.benchmarks,
        formulaTrace: result.formulaTrace,
        fundingSummary: result.fundingSummary,
        pricingFingerprint: result.pricingFingerprint,
        pricingMode: result.pricingMode,
        profitability: result.profitability,
        quotePreview: result.quotePreview,
        routePreview: result.routePreview,
      };
    },

    async createQuote(input) {
      const prepared = await prepareDealPricingContext({
        dealId: input.dealId,
        deps,
      });

      assertPricingContextRevision({
        context: prepared.context,
        dealId: input.dealId,
        expectedRevision: input.expectedRevision,
      });

      const previewResult = await previewWithArtifacts({
        amountMinor: input.amountMinor,
        amountSide: input.amountSide,
        asOf: input.asOf,
        clientPricing: input.clientPricing,
        deps,
        executionSource: input.executionSource,
        prepared,
      });

      const currentAcceptance = prepared.workflow.acceptedQuote;
      if (currentAcceptance) {
        const existingQuote = await deps.treasury.quotes.queries.findById(
          currentAcceptance.quoteId,
        );
        if (
          existingQuote &&
          existingQuote.pricingFingerprint &&
          existingQuote.pricingFingerprint === previewResult.pricingFingerprint &&
          existingQuote.expiresAt.getTime() > Date.now()
        ) {
          throw new ConflictError(
            "rate_already_locked",
            "Текущая котировка уже зафиксирована на тех же условиях и ещё действительна.",
            {
              expiresAt: existingQuote.expiresAt.toISOString(),
              quoteId: existingQuote.id,
            },
          );
        }
      }

      const createQuoteInput = {
        ...previewResult.quoteInput,
        dealId: input.dealId,
        idempotencyKey: input.idempotencyKey,
        routeTemplateId:
          prepared.context.routeAttachment?.templateId ?? null,
      } satisfies CreateQuoteInput;
      const quote = await deps.treasury.quotes.commands.createQuote(
        createQuoteInput,
      );

      return {
        benchmarks: previewResult.benchmarks,
        formulaTrace: previewResult.formulaTrace,
        pricingMode: previewResult.pricingMode,
        profitability: previewResult.profitability,
        quote,
      };
    },
  };
}

export type { DealPricingContextRecord };
