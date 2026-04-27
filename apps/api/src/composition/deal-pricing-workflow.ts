import type { AgreementsModule } from "@bedrock/agreements";
import type { CurrenciesService } from "@bedrock/currencies";
import { canDealWriteTreasuryOrFormalDocuments } from "@bedrock/deals";
import { DealPricingContextRevisionConflictError } from "@bedrock/deals";
import type { DealsModule } from "@bedrock/deals";
import type {
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
import { formatFractionDecimal, minorToAmountString, mulDivRoundHalfUp } from "@bedrock/shared/money";
import type { TreasuryModule } from "@bedrock/treasury";
import {
  computePricingFingerprint,
  type CreateQuoteInput,
  type PaymentRouteCalculation,
  type PaymentRouteDraft,
  type PaymentRouteTemplateListItem,
  type PreviewQuoteInput,
  type QuotePreviewRecord,
  type QuoteRecord,
} from "@bedrock/treasury/contracts";

import { extractAgreementCommercialDefaults } from "./commercial-pricing";

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
}

interface CurrencyPairRequirement {
  fromCurrency: string;
  toCurrency: string;
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
    dealId: string;
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
    dealId: string;
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
    "paymentRoutes" | "paymentSteps" | "quotes" | "rates"
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
  const routeFeeLines = [
    ...input.routePreview.additionalFees.map((fee) => ({
      fee,
      location: "additional" as const,
    })),
    ...input.routePreview.legs.flatMap((leg) =>
      leg.fees.map((fee) => ({
        fee,
        location: "leg" as const,
      })),
    ),
  ];

  return routeFeeLines
    .filter(({ fee }) => BigInt(fee.routeInputImpactMinor) > 0n)
    .map(({ fee, location }) => {
      const bucket = fee.chargeToCustomer
        ? ("pass_through" as const)
        : ("provider_fee_expense" as const);

      return {
        amountMinor: BigInt(fee.routeInputImpactMinor),
        bucket,
        currency: input.fromCurrency,
        id: `${location}:${fee.id}`,
        memo: fee.label ?? fee.id,
        metadata: {
          embeddedInRoute:
            fee.chargeToCustomer && location === "leg" ? "true" : "false",
          paymentRouteFeeId: fee.id,
          paymentRouteFeeKind: fee.kind,
          paymentRouteFeeLocation: location,
        },
        source: "manual" as const,
      };
    });
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
      BigInt(input.routePreview.amountInMinor),
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
    agreementFeeBps: defaults.agreementFeeBps.toString(),
    fixedFeeAmount: hasCompleteFixedFee ? resolvedFixedFeeAmount : null,
    fixedFeeCurrency: hasCompleteFixedFee ? resolvedFixedFeeCurrency : null,
    quoteMarkupBps: (
      input.pricingContext.commercialDraft.quoteMarkupBps ?? 0
    ).toString(),
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

    if (line.bucket === "pass_through") {
      totals.passThroughMinor += amountMinor;
    }

    if (
      line.bucket === "fee_revenue" ||
      line.bucket === "spread_revenue"
    ) {
      totals.commercialRevenueMinor += amountMinor;
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
  financialSummary: {
    commercialRevenueMinor: bigint;
    passThroughMinor: bigint;
  };
  quotePreview: QuotePreviewRecord;
  routePreview: PaymentRouteCalculation | null;
}): Promise<DealPricingProfitability | null> {
  const sourceCurrency = input.quotePreview.fromCurrency;
  const financialSummary = input.financialSummary;
  const customerPrincipalMinor = input.quotePreview.fromAmountMinor;
  const costPriceMinor = input.routePreview
    ? BigInt(input.routePreview.costPriceInMinor)
    : input.quotePreview.fromAmountMinor;
  const customerTotalMinor =
    customerPrincipalMinor + financialSummary.passThroughMinor;
  const profitMinor =
    customerPrincipalMinor -
    costPriceMinor +
    financialSummary.commercialRevenueMinor;
  const profitPercentOnCost =
    costPriceMinor === 0n
      ? "0"
      : formatFractionDecimal(profitMinor * 100n, costPriceMinor, {
          scale: 2,
        });

  return {
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

function formatBpsPercent(bps: bigint | string) {
  return `${formatFractionDecimal(bps, 100n, { scale: 2 })}%`;
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

  lines.push({
    currency:
      input.amountSide === "source"
        ? input.quotePreview.toCurrency
        : input.quotePreview.fromCurrency,
    expression:
      input.amountSide === "source"
        ? `${fromAmount} / ${reverseRate} = ${toAmount}`
        : `${toAmount} × ${reverseRate} = ${fromAmount}`,
    kind: "equation",
    label: "Цена клиенту",
    metadata: {
      pricingBase: input.benchmarks.pricingBase,
    },
    result: input.amountSide === "source" ? toAmount : fromAmount,
  });

  const pricingBaseRate =
    input.benchmarks.routeBase ?? input.benchmarks.market;
  const pricingBaseLabel =
    input.benchmarks.pricingBase === "route_benchmark"
      ? "База расчета: базовый курс маршрута"
      : "База расчета: рыночный курс";
  const markupBps = BigInt(
    input.pricingContext.commercialDraft.quoteMarkupBps ?? 0,
  );
  const agreementFeeBps =
    input.quotePreview.commercialTerms?.agreementFeeBps ?? 0n;
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

  if (markupBps > 0n || agreementFeeBps > 0n) {
    const parts = [];
    if (markupBps > 0n) {
      parts.push(`наценка ${formatBpsPercent(markupBps)}`);
    }
    if (agreementFeeBps > 0n) {
      parts.push(`агентская комиссия ${formatBpsPercent(agreementFeeBps)}`);
    }
    lines.push({
      currency: null,
      expression: parts.join(" + "),
      kind: "note",
      label: "Надбавки",
      metadata: {},
      result: "Учитываются в цене клиента",
    });
  }

  if (
    input.profitability &&
    BigInt(input.profitability.passThroughMinor) > 0n
  ) {
    lines.push({
      currency: input.profitability.currency,
      expression: formatAmountLabel(
        input.profitability.passThroughMinor,
        input.profitability.currency,
      ),
      kind: "note",
      label: "Перевыставляемые расходы сверху",
      metadata: {},
      result: formatAmountLabel(
        input.profitability.customerTotalMinor,
        input.profitability.currency,
      ),
    });
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
    commercialRevenueMinor: financialSummary.commercialRevenueMinor,
    deps: input.deps,
    quotePreview: input.quotePreview,
    routePreview: input.routePreview,
  });
  const profitability = await buildProfitability({
    asOf: input.asOf,
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
    formulaTrace,
    profitability,
  };
}

function withCrmPricingSnapshot(input: {
  benchmarks: DealPricingBenchmarks;
  formulaTrace: DealPricingFormulaTrace;
  profitability: DealPricingProfitability | null;
  quoteInput: PreviewQuoteInput;
}) {
  const pricingTrace = structuredClone(input.quoteInput.pricingTrace ?? {});
  const metadata =
    pricingTrace.metadata &&
    typeof pricingTrace.metadata === "object" &&
    !Array.isArray(pricingTrace.metadata)
      ? { ...(pricingTrace.metadata as Record<string, unknown>) }
      : {};

  metadata.crmPricingSnapshot = {
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
  prepared: PreparedDealPricingInput;
  deps: DealPricingWorkflowDeps;
}): Promise<DealPricingPreviewRecord & { quoteInput: PreviewQuoteInput }> {
  const payload = input.prepared.context.routeAttachment
    ? await buildExplicitRouteQuotePayload({
        amountMinor: input.amountMinor,
        amountSide: input.amountSide,
        asOf: input.asOf,
        context: input.prepared.context,
        deal: input.prepared.deal,
        deps: input.deps,
        workflow: input.prepared.workflow,
      })
    : await buildAutoCrossQuotePayload({
        amountMinor: input.amountMinor,
        amountSide: input.amountSide,
        asOf: input.asOf,
        context: input.prepared.context,
        deal: input.prepared.deal,
        deps: input.deps,
        workflow: input.prepared.workflow,
      });

  const quotePreview = await input.deps.treasury.quotes.queries.previewQuote(
    payload.quoteInput,
  );
  const fundingPositions = await buildFundingPositions({
    context: input.prepared.context,
    deps: input.deps,
    quotePreview,
    routePreview: payload.routePreview,
  });
  const artifacts = await buildPricingArtifacts({
    amountSide: input.amountSide,
    asOf: input.asOf,
    context: input.prepared.context,
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
      input.prepared.context.routeAttachment?.templateId ?? null,
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
    quoteInput: payload.quoteInput,
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

      const steps = await deps.treasury.paymentSteps.queries.list({
        dealId: input.dealId,
        limit: 100,
        offset: 0,
        purpose: "deal_leg",
      });
      const blocking = steps.data.filter(
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
        deps,
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
        deps,
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
        ...withCrmPricingSnapshot({
          benchmarks: previewResult.benchmarks,
          formulaTrace: previewResult.formulaTrace,
          profitability: previewResult.profitability,
          quoteInput: previewResult.quoteInput,
        }),
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
