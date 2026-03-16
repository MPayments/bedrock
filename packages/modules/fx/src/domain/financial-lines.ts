import {
  normalizeFinancialLine,
  type FinancialLine,
  type FinancialLineBucket,
} from "@bedrock/documents/model";
import type { FeeComponent } from "@bedrock/fees";

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
