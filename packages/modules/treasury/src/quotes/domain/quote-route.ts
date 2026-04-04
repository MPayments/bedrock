import { ValueObject, invariant } from "@bedrock/shared/core/domain";

import {
  QuoteLeg,
  type CreateQuoteLegInput,
  type QuoteLegSnapshot,
} from "./quote-leg";

export interface QuoteRouteSnapshot {
  fromCurrency: string;
  toCurrency: string;
  legs: QuoteLegSnapshot[];
}

export class QuoteRoute extends ValueObject<QuoteRouteSnapshot> {
  private readonly legs: QuoteLeg[];

  private constructor(snapshot: QuoteRouteSnapshot) {
    invariant(snapshot.legs.length > 0, "Quote route requires at least one leg", {
      code: "treasury.quote_route.empty",
    });

    const legs = snapshot.legs.map((leg) => QuoteLeg.fromSnapshot(leg));
    const first = legs[0]!;
    const last = legs[legs.length - 1]!;

    invariant(
      first.fromCurrency === snapshot.fromCurrency.trim().toUpperCase(),
      "First leg fromCurrency must match quote fromCurrency",
      {
        code: "treasury.quote_route.first_leg_currency_mismatch",
      },
    );
    invariant(
      last.toCurrency === snapshot.toCurrency.trim().toUpperCase(),
      "Last leg toCurrency must match quote toCurrency",
      {
        code: "treasury.quote_route.last_leg_currency_mismatch",
      },
    );

    for (let index = 1; index < legs.length; index += 1) {
      const previous = legs[index - 1]!;
      const current = legs[index]!;

      invariant(
        previous.toCurrency === current.fromCurrency,
        `Leg continuity mismatch at idx=${index + 1}: ${previous.toCurrency} != ${current.fromCurrency}`,
        {
          code: "treasury.quote_route.continuity_mismatch",
          meta: { idx: index + 1 },
        },
      );
    }

    super({
      fromCurrency: snapshot.fromCurrency.trim().toUpperCase(),
      toCurrency: snapshot.toCurrency.trim().toUpperCase(),
      legs: legs.map((leg) => leg.toSnapshot()),
    });
    this.legs = legs;
  }

  static single(input: {
    fromCurrency: string;
    toCurrency: string;
    fromAmountMinor: bigint;
    rateNum: bigint;
    rateDen: bigint;
    asOf: Date;
    sourceKind: CreateQuoteLegInput["sourceKind"];
    sourceRef?: string | null;
    executionCounterpartyId?: string | null;
  }): QuoteRoute {
    return new QuoteRoute({
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      legs: [
        QuoteLeg.create({
          idx: 1,
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
          fromAmountMinor: input.fromAmountMinor,
          rateNum: input.rateNum,
          rateDen: input.rateDen,
          sourceKind: input.sourceKind,
          sourceRef: input.sourceRef ?? null,
          asOf: input.asOf,
          executionCounterpartyId: input.executionCounterpartyId ?? null,
        }).toSnapshot(),
      ],
    });
  }

  static singleFromTarget(input: {
    fromCurrency: string;
    toCurrency: string;
    toAmountMinor: bigint;
    rateNum: bigint;
    rateDen: bigint;
    asOf: Date;
    sourceKind: CreateQuoteLegInput["sourceKind"];
    sourceRef?: string | null;
    executionCounterpartyId?: string | null;
  }): QuoteRoute {
    return new QuoteRoute({
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      legs: [
        QuoteLeg.createFromTarget({
          idx: 1,
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
          toAmountMinor: input.toAmountMinor,
          rateNum: input.rateNum,
          rateDen: input.rateDen,
          sourceKind: input.sourceKind,
          sourceRef: input.sourceRef ?? null,
          asOf: input.asOf,
          executionCounterpartyId: input.executionCounterpartyId ?? null,
        }).toSnapshot(),
      ],
    });
  }

  static explicit(input: {
    fromCurrency: string;
    toCurrency: string;
    fromAmountMinor: bigint;
    asOf: Date;
    legs: (Omit<CreateQuoteLegInput, "idx" | "fromAmountMinor" | "asOf"> & {
      asOf?: Date;
    })[];
  }): QuoteRoute {
    let rollingAmount = input.fromAmountMinor;

    return new QuoteRoute({
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      legs: input.legs.map((leg, index) => {
        const pricedLeg = QuoteLeg.create({
          idx: index + 1,
          fromCurrency: leg.fromCurrency,
          toCurrency: leg.toCurrency,
          fromAmountMinor: rollingAmount,
          rateNum: leg.rateNum,
          rateDen: leg.rateDen,
          sourceKind: leg.sourceKind,
          sourceRef: leg.sourceRef ?? null,
          asOf: leg.asOf ?? input.asOf,
          executionCounterpartyId: leg.executionCounterpartyId ?? null,
        });
        rollingAmount = pricedLeg.toAmountMinor;
        return pricedLeg.toSnapshot();
      }),
    });
  }

  static explicitFromTarget(input: {
    fromCurrency: string;
    toCurrency: string;
    toAmountMinor: bigint;
    asOf: Date;
    legs: (Omit<CreateQuoteLegInput, "idx" | "fromAmountMinor" | "asOf"> & {
      asOf?: Date;
    })[];
  }): QuoteRoute {
    let rollingTargetAmount = input.toAmountMinor;

    return new QuoteRoute({
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      legs: input.legs
        .map((leg, index) => ({
          idx: index + 1,
          leg,
        }))
        .reverse()
        .map(({ idx, leg }) => {
          const pricedLeg = QuoteLeg.createFromTarget({
            idx,
            fromCurrency: leg.fromCurrency,
            toCurrency: leg.toCurrency,
            toAmountMinor: rollingTargetAmount,
            rateNum: leg.rateNum,
            rateDen: leg.rateDen,
            sourceKind: leg.sourceKind,
            sourceRef: leg.sourceRef ?? null,
            asOf: leg.asOf ?? input.asOf,
            executionCounterpartyId: leg.executionCounterpartyId ?? null,
          });
          rollingTargetAmount = pricedLeg.fromAmountMinor;
          return pricedLeg.toSnapshot();
        })
        .reverse(),
    });
  }

  static fromSnapshots(input: QuoteRouteSnapshot): QuoteRoute {
    return new QuoteRoute(input);
  }

  get fromAmountMinor(): bigint {
    return this.legs[0]!.fromAmountMinor;
  }

  get length(): number {
    return this.legs.length;
  }

  get toAmountMinor(): bigint {
    return this.legs[this.legs.length - 1]!.toAmountMinor;
  }

  toSnapshots(): QuoteLegSnapshot[] {
    return this.legs.map((leg) => leg.toSnapshot());
  }
}
