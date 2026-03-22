export type RevenueExpenseAccountKind = "revenue" | "expense";
export type RevenueExpensePostingSide = "debit" | "credit";

export interface RevenueExpenseEffect {
  kind: RevenueExpenseAccountKind;
  amountMinor: bigint;
}

export function resolveRevenueExpenseEffect(input: {
  kind: string | null | undefined;
  side: RevenueExpensePostingSide;
  amountMinor: bigint;
}): RevenueExpenseEffect | null {
  if (input.kind !== "revenue" && input.kind !== "expense") {
    return null;
  }

  const amountMinor =
    input.kind === "revenue"
      ? input.side === "debit"
        ? -input.amountMinor
        : input.amountMinor
      : input.side === "debit"
        ? input.amountMinor
        : -input.amountMinor;

  return {
    kind: input.kind,
    amountMinor,
  };
}
