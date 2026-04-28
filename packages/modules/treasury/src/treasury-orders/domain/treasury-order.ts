import { AggregateRoot, invariant } from "@bedrock/shared/core/domain";

import type {
  CreateTreasuryOrderStepPlanProps,
  TreasuryOrderRecord,
  TreasuryOrderStepPlanRecord,
  TreasuryOrderType,
} from "./types";
import type { PaymentStepPartyRef } from "../../payment-steps/domain/types";

export interface CreateTreasuryOrderProps {
  description?: string | null;
  id: string;
  steps: CreateTreasuryOrderStepPlanProps[];
  type: TreasuryOrderType;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeRequiredText(value: string, field: string): string {
  const normalized = value.trim();
  invariant(normalized.length > 0, `${field} is required`, {
    code: "treasury.order.required",
    meta: { field },
  });
  return normalized;
}

function normalizeParty(party: PaymentStepPartyRef, field: string) {
  return {
    displayName: normalizeOptionalText(party.displayName),
    entityKind: normalizeOptionalText(party.entityKind),
    id: normalizeRequiredText(party.id, `${field}.id`),
    requisiteId: normalizeOptionalText(party.requisiteId),
    snapshot: party.snapshot ? { ...party.snapshot } : null,
  };
}

function normalizeAmount(amount: bigint | null | undefined, field: string) {
  if (amount == null) return null;
  invariant(amount > 0n, `${field} must be positive`, {
    code: "treasury.order.amount_invalid",
    meta: { amount: amount.toString(), field },
  });
  return amount;
}

function cloneStep(step: TreasuryOrderStepPlanRecord): TreasuryOrderStepPlanRecord {
  const quoteId = normalizeOptionalText(step.quoteId);
  if (step.kind === "quote_execution") {
    invariant(
      quoteId !== null,
      "FX exchange order steps require a quote reference",
      {
        code: "treasury.order.fx_quote_required",
        meta: { stepId: step.id },
      },
    );
  }

  return {
    ...step,
    createdAt: new Date(step.createdAt.getTime()),
    fromAmountMinor: normalizeAmount(step.fromAmountMinor, "fromAmountMinor"),
    fromCurrencyId: normalizeRequiredText(step.fromCurrencyId, "fromCurrencyId"),
    fromParty: normalizeParty(step.fromParty, "fromParty"),
    paymentStepId: normalizeOptionalText(step.paymentStepId),
    quoteExecutionId: normalizeOptionalText(step.quoteExecutionId),
    quoteId,
    rate: step.rate
      ? {
          lockedSide: step.rate.lockedSide,
          value: normalizeRequiredText(step.rate.value, "rate.value"),
        }
      : null,
    sourceRef: normalizeRequiredText(step.sourceRef, "sourceRef"),
    toAmountMinor: normalizeAmount(step.toAmountMinor, "toAmountMinor"),
    toCurrencyId: normalizeRequiredText(step.toCurrencyId, "toCurrencyId"),
    toParty: normalizeParty(step.toParty, "toParty"),
    updatedAt: new Date(step.updatedAt.getTime()),
  };
}

function normalizeSnapshot(record: TreasuryOrderRecord): TreasuryOrderRecord {
  invariant(record.steps.length > 0, "Treasury order requires at least one step", {
    code: "treasury.order.steps_required",
    meta: { orderId: record.id },
  });

  return {
    activatedAt: record.activatedAt
      ? new Date(record.activatedAt.getTime())
      : null,
    cancelledAt: record.cancelledAt
      ? new Date(record.cancelledAt.getTime())
      : null,
    createdAt: new Date(record.createdAt.getTime()),
    description: normalizeOptionalText(record.description),
    id: normalizeRequiredText(record.id, "id"),
    state: record.state,
    steps: record.steps.map(cloneStep),
    type: record.type,
    updatedAt: new Date(record.updatedAt.getTime()),
  };
}

export class TreasuryOrder extends AggregateRoot<string> {
  private constructor(private readonly snapshot: TreasuryOrderRecord) {
    super({ id: snapshot.id, props: {} });
  }

  static create(
    input: CreateTreasuryOrderProps,
    now: Date,
    generateUuid: () => string,
  ): TreasuryOrder {
    return new TreasuryOrder(
      normalizeSnapshot({
        activatedAt: null,
        cancelledAt: null,
        createdAt: now,
        description: input.description ?? null,
        id: input.id,
        state: "draft",
        steps: input.steps.map((step, index) => ({
          createdAt: now,
          fromAmountMinor: step.fromAmountMinor ?? null,
          fromCurrencyId: step.fromCurrencyId,
          fromParty: step.fromParty,
          id: generateUuid(),
          kind: step.kind,
          paymentStepId: null,
          quoteExecutionId: null,
          quoteId: step.quoteId ?? null,
          rate: step.rate ?? null,
          sequence: index + 1,
          sourceRef: `treasury-order:${input.id}:step:${index + 1}:${step.kind}`,
          toAmountMinor: step.toAmountMinor ?? null,
          toCurrencyId: step.toCurrencyId,
          toParty: step.toParty,
          updatedAt: now,
        })),
        type: input.type,
        updatedAt: now,
      }),
    );
  }

  static fromSnapshot(record: TreasuryOrderRecord): TreasuryOrder {
    return new TreasuryOrder(normalizeSnapshot(record));
  }

  activate(now: Date): TreasuryOrder {
    invariant(this.snapshot.state === "draft", "Treasury order is not draft", {
      code: "treasury.order.activate_not_allowed",
      meta: { orderId: this.id, state: this.snapshot.state },
    });

    return new TreasuryOrder(
      normalizeSnapshot({
        ...this.snapshot,
        activatedAt: now,
        state: "active",
        updatedAt: now,
      }),
    );
  }

  linkPaymentStep(planStepId: string, paymentStepId: string, now: Date): TreasuryOrder {
    return new TreasuryOrder(
      normalizeSnapshot({
        ...this.snapshot,
        steps: this.snapshot.steps.map((step) =>
          step.id === planStepId
            ? { ...step, paymentStepId, updatedAt: now }
            : cloneStep(step),
        ),
        updatedAt: now,
      }),
    );
  }

  linkQuoteExecution(
    planStepId: string,
    quoteExecutionId: string,
    now: Date,
  ): TreasuryOrder {
    return new TreasuryOrder(
      normalizeSnapshot({
        ...this.snapshot,
        steps: this.snapshot.steps.map((step) =>
          step.id === planStepId
            ? { ...step, quoteExecutionId, updatedAt: now }
            : cloneStep(step),
        ),
        updatedAt: now,
      }),
    );
  }

  cancel(now: Date): TreasuryOrder {
    invariant(
      this.snapshot.state === "draft" || this.snapshot.state === "active",
      "Treasury order cannot be cancelled",
      {
        code: "treasury.order.cancel_not_allowed",
        meta: { orderId: this.id, state: this.snapshot.state },
      },
    );

    return new TreasuryOrder(
      normalizeSnapshot({
        ...this.snapshot,
        cancelledAt: now,
        state: "cancelled",
        updatedAt: now,
      }),
    );
  }

  complete(now: Date): TreasuryOrder {
    invariant(this.snapshot.state === "active", "Treasury order is not active", {
      code: "treasury.order.complete_not_allowed",
      meta: { orderId: this.id, state: this.snapshot.state },
    });

    return new TreasuryOrder(
      normalizeSnapshot({
        ...this.snapshot,
        state: "completed",
        updatedAt: now,
      }),
    );
  }

  toSnapshot(): TreasuryOrderRecord {
    return normalizeSnapshot(this.snapshot);
  }
}
