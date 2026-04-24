import type { CalculationsModule } from "@bedrock/calculations";
import {
  DealPricingProfitabilitySchema,
  type DealPricingProfitability,
} from "@bedrock/deals/contracts";
import type {
  TreasuryInstruction,
  TreasuryOperationKind,
} from "@bedrock/treasury/contracts";

import type {
  FinanceDealCashflowSummary,
  FinanceProfitabilityAmount,
  FinanceProfitabilitySnapshot,
} from "../contracts";
import type {
  CalculationDetailsLike,
  DealProjectionsWorkflowDeps,
  TreasuryOperationRecord,
} from "../shared/deps";

const CASHFLOW_OUTBOUND_KINDS: ReadonlySet<TreasuryOperationKind> =
  new Set<TreasuryOperationKind>(["payout", "intercompany_funding"]);

export function sumCalculationLineAmountsByCurrency(
  lines: CalculationDetailsLike["lines"],
  kind: string,
) {
  return lines.reduce((acc, line) => {
    if (line.kind !== kind) {
      return acc;
    }

    const nextAmount =
      (acc.get(line.currencyId) ?? 0n) + BigInt(line.amountMinor);

    acc.set(line.currencyId, nextAmount);
    return acc;
  }, new Map<string, bigint>());
}

export function mergeProfitabilityAmountsByCurrency(
  ...groups: Map<string, bigint>[]
) {
  const totals = new Map<string, bigint>();

  for (const group of groups) {
    for (const [currencyId, amountMinor] of group.entries()) {
      totals.set(currencyId, (totals.get(currencyId) ?? 0n) + amountMinor);
    }
  }

  return totals;
}

export async function resolveProfitabilityAmounts(
  currencyIdsToAmounts: Map<string, bigint>,
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">,
): Promise<FinanceProfitabilityAmount[]> {
  if (currencyIdsToAmounts.size === 0) {
    return [];
  }

  const currencies = await Promise.all(
    Array.from(currencyIdsToAmounts.keys()).map(async (currencyId) => ({
      currency: await deps.currencies.findById(currencyId),
      currencyId,
    })),
  );

  const codeById = new Map(
    currencies.map(({ currency, currencyId }) => [
      currencyId,
      currency?.code ?? currencyId,
    ]),
  );

  return Array.from(currencyIdsToAmounts.entries())
    .sort(([leftId], [rightId]) => {
      const leftCode = codeById.get(leftId) ?? leftId;
      const rightCode = codeById.get(rightId) ?? rightId;
      return leftCode.localeCompare(rightCode);
    })
    .map(([currencyId, amountMinor]) => ({
      amountMinor: amountMinor.toString(),
      currencyCode: codeById.get(currencyId) ?? currencyId,
      currencyId,
    }));
}

export function extractNetProfitFromQuoteTrace(
  quoteDetails: { pricingTrace: Record<string, unknown> } | null,
): DealPricingProfitability | null {
  const trace = quoteDetails?.pricingTrace;
  if (!trace || typeof trace !== "object") return null;

  const metadata = trace["metadata"];
  if (!metadata || typeof metadata !== "object") return null;

  const crmPricingSnapshot = (metadata as Record<string, unknown>)[
    "crmPricingSnapshot"
  ];
  if (!crmPricingSnapshot || typeof crmPricingSnapshot !== "object") return null;

  const profitability = (crmPricingSnapshot as Record<string, unknown>)[
    "profitability"
  ];
  if (!profitability) return null;

  const parsed = DealPricingProfitabilitySchema.safeParse(profitability);
  return parsed.success ? parsed.data : null;
}

export async function buildProfitabilitySnapshot(
  calculation: Awaited<
    ReturnType<CalculationsModule["calculations"]["queries"]["findById"]>
  > | null,
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">,
  options: {
    acceptedQuoteDetails?: { pricingTrace: Record<string, unknown> } | null;
  } = {},
): Promise<FinanceProfitabilitySnapshot> {
  if (!calculation) {
    return null;
  }

  const feeRevenue = sumCalculationLineAmountsByCurrency(
    calculation.lines,
    "fee_revenue",
  );
  const providerFeeExpense = sumCalculationLineAmountsByCurrency(
    calculation.lines,
    "provider_fee_expense",
  );
  const spreadRevenue = sumCalculationLineAmountsByCurrency(
    calculation.lines,
    "spread_revenue",
  );
  const totalRevenue = mergeProfitabilityAmountsByCurrency(
    feeRevenue,
    spreadRevenue,
  );

  return {
    calculationId: calculation.id,
    feeRevenue: await resolveProfitabilityAmounts(feeRevenue, deps),
    netProfit: extractNetProfitFromQuoteTrace(
      options.acceptedQuoteDetails ?? null,
    ),
    providerFeeExpense: await resolveProfitabilityAmounts(
      providerFeeExpense,
      deps,
    ),
    spreadRevenue: await resolveProfitabilityAmounts(spreadRevenue, deps),
    totalRevenue: await resolveProfitabilityAmounts(totalRevenue, deps),
  };
}

export function accumulateAmount(
  accumulator: Map<string, bigint>,
  currencyId: string | null,
  amountMinor: string | null,
) {
  if (!currencyId || !amountMinor) return;
  let parsed: bigint;
  try {
    parsed = BigInt(amountMinor);
  } catch {
    return;
  }
  accumulator.set(currencyId, (accumulator.get(currencyId) ?? 0n) + parsed);
}

export async function buildCashflowSummary(
  operations: readonly TreasuryOperationRecord[],
  latestInstructionByOperationId: ReadonlyMap<string, TreasuryInstruction>,
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">,
): Promise<FinanceDealCashflowSummary> {
  const receivedInByCurrency = new Map<string, bigint>();
  const scheduledOutByCurrency = new Map<string, bigint>();
  const settledOutByCurrency = new Map<string, bigint>();

  for (const operation of operations) {
    const latestInstruction =
      latestInstructionByOperationId.get(operation.id) ?? null;
    const instructionState = latestInstruction?.state ?? null;

    if (operation.kind === "payin") {
      if (instructionState === "settled") {
        accumulateAmount(
          receivedInByCurrency,
          operation.currencyId,
          operation.amountMinor,
        );
      }
      continue;
    }

    if (CASHFLOW_OUTBOUND_KINDS.has(operation.kind)) {
      if (instructionState === "settled") {
        accumulateAmount(
          settledOutByCurrency,
          operation.currencyId,
          operation.amountMinor,
        );
      } else if (
        instructionState === "prepared" ||
        instructionState === "submitted"
      ) {
        accumulateAmount(
          scheduledOutByCurrency,
          operation.currencyId,
          operation.amountMinor,
        );
      }
    }
  }

  const [receivedIn, scheduledOut, settledOut] = await Promise.all([
    resolveProfitabilityAmounts(receivedInByCurrency, deps),
    resolveProfitabilityAmounts(scheduledOutByCurrency, deps),
    resolveProfitabilityAmounts(settledOutByCurrency, deps),
  ]);

  return { receivedIn, scheduledOut, settledOut };
}
