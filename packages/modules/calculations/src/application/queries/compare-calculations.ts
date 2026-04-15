import { CalculationNotFoundError } from "../../errors";
import type { CalculationCompare, CalculationLine } from "../contracts/dto";
import type { CalculationReads } from "../ports/calculation.reads";

function buildLineKey(line: CalculationLine) {
  return (
    line.routeComponentId ??
    line.componentCode ??
    `${line.kind}:${line.currencyId}:${line.routeLegId ?? "none"}`
  );
}

function compareMinor(left: string, right: string) {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);

  return {
    deltaMinor: (leftValue - rightValue).toString(),
    leftMinor: leftValue.toString(),
    rightMinor: rightValue.toString(),
  };
}

function buildLineDiffs(input: {
  left: CalculationLine[];
  right: CalculationLine[];
}): CalculationCompare["lineDiffs"] {
  const leftByKey = new Map(
    input.left.map((line) => [buildLineKey(line), line] as const),
  );
  const rightByKey = new Map(
    input.right.map((line) => [buildLineKey(line), line] as const),
  );
  const keys = Array.from(new Set([...leftByKey.keys(), ...rightByKey.keys()])).sort();

  return keys.map((key) => {
    const left = leftByKey.get(key) ?? null;
    const right = rightByKey.get(key) ?? null;

    return {
      basisAmountMinor: left?.basisAmountMinor ?? right?.basisAmountMinor ?? null,
      classification: left?.classification ?? right?.classification ?? null,
      componentCode: left?.componentCode ?? right?.componentCode ?? key,
      componentFamily: left?.componentFamily ?? right?.componentFamily ?? null,
      currencyId: left?.currencyId ?? right?.currencyId ?? "",
      deltaAmountMinor: (
        BigInt(left?.amountMinor ?? "0") - BigInt(right?.amountMinor ?? "0")
      ).toString(),
      kind: left?.kind ?? right?.kind ?? "adjustment",
      leftAmountMinor: left?.amountMinor ?? "0",
      rightAmountMinor: right?.amountMinor ?? "0",
      routeComponentId: left?.routeComponentId ?? right?.routeComponentId ?? null,
      routeLegId: left?.routeLegId ?? right?.routeLegId ?? null,
    };
  });
}

export class CompareCalculationsQuery {
  constructor(private readonly reads: CalculationReads) {}

  async execute(input: {
    leftCalculationId: string;
    rightCalculationId: string;
  }): Promise<CalculationCompare> {
    const [left, right] = await Promise.all([
      this.reads.findById(input.leftCalculationId),
      this.reads.findById(input.rightCalculationId),
    ]);

    if (!left) {
      throw new CalculationNotFoundError(input.leftCalculationId);
    }

    if (!right) {
      throw new CalculationNotFoundError(input.rightCalculationId);
    }

    return {
      left,
      right,
      lineDiffs: buildLineDiffs({
        left: left.lines,
        right: right.lines,
      }),
      totals: {
        expenseAmountInBaseMinor: compareMinor(
          left.currentSnapshot.expenseAmountInBaseMinor,
          right.currentSnapshot.expenseAmountInBaseMinor,
        ),
        grossRevenueInBaseMinor: compareMinor(
          left.currentSnapshot.grossRevenueInBaseMinor,
          right.currentSnapshot.grossRevenueInBaseMinor,
        ),
        netMarginInBaseMinor: compareMinor(
          left.currentSnapshot.netMarginInBaseMinor,
          right.currentSnapshot.netMarginInBaseMinor,
        ),
        passThroughAmountInBaseMinor: compareMinor(
          left.currentSnapshot.passThroughAmountInBaseMinor,
          right.currentSnapshot.passThroughAmountInBaseMinor,
        ),
        totalInBaseMinor: compareMinor(
          left.currentSnapshot.totalInBaseMinor,
          right.currentSnapshot.totalInBaseMinor,
        ),
        totalWithExpensesInBaseMinor: compareMinor(
          left.currentSnapshot.totalWithExpensesInBaseMinor,
          right.currentSnapshot.totalWithExpensesInBaseMinor,
        ),
      },
    };
  }
}
