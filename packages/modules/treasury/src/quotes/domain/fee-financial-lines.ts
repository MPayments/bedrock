import {
  aggregateFinancialLines,
  normalizeFinancialLine,
  type FinancialLine,
  type FinancialLineBucket,
} from "@bedrock/documents/contracts";

import type { FeeComponent } from "../../fees/domain/fee-types";

function resolveBucket(
  component: Pick<FeeComponent, "accountingTreatment" | "kind">,
): FinancialLineBucket {
  if (component.accountingTreatment === "expense") {
    return "provider_fee_expense";
  }

  if (component.accountingTreatment === "pass_through") {
    return "pass_through";
  }

  return component.kind === "fx_spread" ? "spread_revenue" : "fee_revenue";
}

export function financialLineFromFeeComponent(
  component: FeeComponent,
): FinancialLine {
  return normalizeFinancialLine({
    id: component.id,
    bucket: resolveBucket(component),
    currency: component.currency,
    amountMinor: component.amountMinor,
    source: component.source,
    settlementMode: component.settlementMode,
    memo: component.memo,
    metadata: {
      ...(component.metadata ?? {}),
      ...(component.ruleId ? { ruleId: component.ruleId } : {}),
      feeKind: component.kind,
    },
  });
}

export function financialLinesFromFeeComponents(
  components: readonly FeeComponent[],
): FinancialLine[] {
  return components.map(financialLineFromFeeComponent);
}

export function normalizeFinancialLines(
  lines: readonly FinancialLine[],
): FinancialLine[] {
  return aggregateFinancialLines([...lines]) as FinancialLine[];
}
