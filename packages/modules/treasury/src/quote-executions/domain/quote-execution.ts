import { AggregateRoot, invariant } from "@bedrock/shared/core/domain";

import type {
  QuoteExecutionRecord,
  QuoteExecutionParties,
  QuoteExecutionState,
} from "./types";
import type {
  PaymentStepOrigin,
  PaymentStepPartyRef,
  PostingDocumentRef,
} from "../../payment-steps/domain/types";

export type QuoteExecutionSnapshot = QuoteExecutionRecord;

export interface CreateQuoteExecutionProps {
  dealId?: string | null;
  fromAmountMinor: bigint;
  fromCurrencyId: string;
  id: string;
  origin: PaymentStepOrigin;
  quoteId: string;
  quoteLegIdx?: number | null;
  quoteSnapshot?: unknown;
  rateDen: bigint;
  rateNum: bigint;
  executionParties?: QuoteExecutionParties | null;
  sourceRef: string;
  toAmountMinor: bigint;
  toCurrencyId: string;
  treasuryOrderId?: string | null;
}

const SUBMITTABLE_STATES: QuoteExecutionState[] = ["pending", "failed"];

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function cloneNullableDate(value: Date | null): Date | null {
  return value ? cloneDate(value) : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeRequiredText(value: string, field: string): string {
  const normalized = value.trim();
  invariant(normalized.length > 0, `${field} is required`, {
    code: "treasury.quote_execution.required",
    meta: { field },
  });
  return normalized;
}

function normalizeAmount(amount: bigint, field: string): bigint {
  invariant(amount > 0n, `${field} must be positive`, {
    code: "treasury.quote_execution.amount_invalid",
    meta: { amount: amount.toString(), field },
  });
  return amount;
}

function normalizeRatePart(value: bigint, field: string): bigint {
  invariant(value > 0n, `${field} must be positive`, {
    code: "treasury.quote_execution.rate_invalid",
    meta: { field, value: value.toString() },
  });
  return value;
}

function cloneOrigin(origin: PaymentStepOrigin): PaymentStepOrigin {
  return {
    dealId: normalizeOptionalText(origin.dealId),
    planLegId: normalizeOptionalText(origin.planLegId),
    routeSnapshotLegId: normalizeOptionalText(origin.routeSnapshotLegId),
    sequence: origin.sequence ?? null,
    treasuryOrderId: normalizeOptionalText(origin.treasuryOrderId),
    type: origin.type,
  };
}

function clonePartyRef(
  party: PaymentStepPartyRef,
  field: string,
): PaymentStepPartyRef {
  return {
    displayName: normalizeOptionalText(party.displayName),
    entityKind: normalizeOptionalText(party.entityKind),
    id: normalizeRequiredText(party.id, `${field}.id`),
    requisiteId: normalizeOptionalText(party.requisiteId),
    snapshot: party.snapshot ? { ...party.snapshot } : null,
  };
}

function cloneParties(
  parties: QuoteExecutionParties | null | undefined,
): QuoteExecutionParties | null {
  if (!parties) return null;
  return {
    creditParty: clonePartyRef(
      parties.creditParty,
      "executionParties.creditParty",
    ),
    debitParty: clonePartyRef(
      parties.debitParty,
      "executionParties.debitParty",
    ),
  };
}

function clonePosting(ref: PostingDocumentRef): PostingDocumentRef {
  return { ...ref };
}

function normalizeSnapshot(snapshot: QuoteExecutionSnapshot) {
  const id = normalizeRequiredText(snapshot.id, "id");
  const origin = cloneOrigin(snapshot.origin);
  const dealId = normalizeOptionalText(snapshot.dealId);
  const treasuryOrderId = normalizeOptionalText(snapshot.treasuryOrderId);

  if (origin.type === "deal_execution_leg") {
    invariant(
      dealId !== null && origin.dealId === dealId && origin.planLegId !== null,
      "Deal quote executions require deal origin context",
      {
        code: "treasury.quote_execution.deal_context_required",
        meta: { executionId: id },
      },
    );
  }
  if (origin.type === "treasury_order_step") {
    invariant(
      treasuryOrderId !== null &&
        origin.treasuryOrderId === treasuryOrderId &&
        origin.planLegId !== null,
      "Treasury order quote executions require order origin context",
      {
        code: "treasury.quote_execution.order_context_required",
        meta: { executionId: id },
      },
    );
  }
  if (snapshot.state === "completed") {
    invariant(snapshot.completedAt !== null, "Completed quote executions require completedAt", {
      code: "treasury.quote_execution.completed_at_required",
      meta: { executionId: id },
    });
  }

  return {
    ...snapshot,
    completedAt: cloneNullableDate(snapshot.completedAt),
    createdAt: cloneDate(snapshot.createdAt),
    dealId,
    failureReason: normalizeOptionalText(snapshot.failureReason),
    fromAmountMinor: normalizeAmount(
      snapshot.fromAmountMinor,
      "fromAmountMinor",
    ),
    fromCurrencyId: normalizeRequiredText(
      snapshot.fromCurrencyId,
      "fromCurrencyId",
    ),
    id,
    origin,
    postingDocumentRefs: snapshot.postingDocumentRefs.map(clonePosting),
    providerRef: normalizeOptionalText(snapshot.providerRef),
    quoteId: normalizeRequiredText(snapshot.quoteId, "quoteId"),
    quoteLegIdx: snapshot.quoteLegIdx ?? null,
    rateDen: normalizeRatePart(snapshot.rateDen, "rateDen"),
    rateNum: normalizeRatePart(snapshot.rateNum, "rateNum"),
    executionParties: cloneParties(snapshot.executionParties),
    sourceRef: normalizeRequiredText(snapshot.sourceRef, "sourceRef"),
    submittedAt: cloneNullableDate(snapshot.submittedAt),
    toAmountMinor: normalizeAmount(snapshot.toAmountMinor, "toAmountMinor"),
    toCurrencyId: normalizeRequiredText(snapshot.toCurrencyId, "toCurrencyId"),
    treasuryOrderId,
    updatedAt: cloneDate(snapshot.updatedAt),
  } satisfies QuoteExecutionSnapshot;
}

export class QuoteExecution extends AggregateRoot<string> {
  private constructor(private readonly snapshot: QuoteExecutionSnapshot) {
    super({ id: snapshot.id, props: {} });
  }

  static create(input: CreateQuoteExecutionProps, now: Date): QuoteExecution {
    return new QuoteExecution(
      normalizeSnapshot({
        completedAt: null,
        createdAt: now,
        dealId: input.dealId ?? null,
        failureReason: null,
        fromAmountMinor: input.fromAmountMinor,
        fromCurrencyId: input.fromCurrencyId,
        id: input.id,
        origin: input.origin,
        postingDocumentRefs: [],
        providerRef: null,
        providerSnapshot: null,
        quoteId: input.quoteId,
        quoteLegIdx: input.quoteLegIdx ?? null,
        quoteSnapshot: input.quoteSnapshot ?? null,
        rateDen: input.rateDen,
        rateNum: input.rateNum,
        executionParties: input.executionParties ?? null,
        sourceRef: input.sourceRef,
        state: "draft",
        submittedAt: null,
        toAmountMinor: input.toAmountMinor,
        toCurrencyId: input.toCurrencyId,
        treasuryOrderId: input.treasuryOrderId ?? null,
        updatedAt: now,
      }),
    );
  }

  static fromSnapshot(snapshot: QuoteExecutionSnapshot): QuoteExecution {
    return new QuoteExecution(normalizeSnapshot(snapshot));
  }

  markPending(now: Date): QuoteExecution {
    invariant(this.snapshot.state === "draft", "Quote execution is not draft", {
      code: "treasury.quote_execution.pending_not_allowed",
      meta: { executionId: this.id, state: this.snapshot.state },
    });

    return new QuoteExecution(
      normalizeSnapshot({
        ...this.snapshot,
        state: "pending",
        updatedAt: now,
      }),
    );
  }

  submit(input: {
    providerRef?: string | null;
    providerSnapshot?: unknown;
    submittedAt: Date;
  }): QuoteExecution {
    invariant(
      SUBMITTABLE_STATES.includes(this.snapshot.state),
      "Quote execution cannot be submitted",
      {
        code: "treasury.quote_execution.submit_not_allowed",
        meta: { executionId: this.id, state: this.snapshot.state },
      },
    );

    return new QuoteExecution(
      normalizeSnapshot({
        ...this.snapshot,
        failureReason: null,
        providerRef: input.providerRef ?? null,
        providerSnapshot: input.providerSnapshot ?? null,
        state: "processing",
        submittedAt: input.submittedAt,
        updatedAt: input.submittedAt,
      }),
    );
  }

  complete(completedAt: Date): QuoteExecution {
    invariant(
      this.snapshot.state === "processing",
      "Quote execution is not processing",
      {
        code: "treasury.quote_execution.complete_not_allowed",
        meta: { executionId: this.id, state: this.snapshot.state },
      },
    );

    return new QuoteExecution(
      normalizeSnapshot({
        ...this.snapshot,
        completedAt,
        failureReason: null,
        state: "completed",
        updatedAt: completedAt,
      }),
    );
  }

  fail(input: { failedAt: Date; failureReason?: string | null }): QuoteExecution {
    invariant(
      this.snapshot.state === "pending" || this.snapshot.state === "processing",
      "Quote execution cannot fail from its current state",
      {
        code: "treasury.quote_execution.fail_not_allowed",
        meta: { executionId: this.id, state: this.snapshot.state },
      },
    );

    return new QuoteExecution(
      normalizeSnapshot({
        ...this.snapshot,
        failureReason: input.failureReason ?? null,
        state: "failed",
        updatedAt: input.failedAt,
      }),
    );
  }

  cancel(now: Date): QuoteExecution {
    invariant(
      this.snapshot.state === "draft" || this.snapshot.state === "pending",
      "Quote execution cannot be cancelled",
      {
        code: "treasury.quote_execution.cancel_not_allowed",
        meta: { executionId: this.id, state: this.snapshot.state },
      },
    );

    return new QuoteExecution(
      normalizeSnapshot({
        ...this.snapshot,
        state: "cancelled",
        updatedAt: now,
      }),
    );
  }

  expire(now: Date): QuoteExecution {
    invariant(
      this.snapshot.state === "draft" || this.snapshot.state === "pending",
      "Quote execution cannot be expired",
      {
        code: "treasury.quote_execution.expire_not_allowed",
        meta: { executionId: this.id, state: this.snapshot.state },
      },
    );

    return new QuoteExecution(
      normalizeSnapshot({
        ...this.snapshot,
        state: "expired",
        updatedAt: now,
      }),
    );
  }

  attachPosting(ref: PostingDocumentRef, now: Date): QuoteExecution {
    if (
      this.snapshot.postingDocumentRefs.some(
        (existing) =>
          existing.documentId === ref.documentId && existing.kind === ref.kind,
      )
    ) {
      return this;
    }

    return new QuoteExecution(
      normalizeSnapshot({
        ...this.snapshot,
        postingDocumentRefs: [
          ...this.snapshot.postingDocumentRefs.map(clonePosting),
          { ...ref },
        ],
        updatedAt: now,
      }),
    );
  }

  toSnapshot(): QuoteExecutionSnapshot {
    return normalizeSnapshot(this.snapshot);
  }
}
