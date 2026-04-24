import { invariant } from "@bedrock/shared/core/domain";

import type {
  PaymentStepAttemptOutcome,
  PaymentStepAttemptRecord,
} from "./types";

export type PaymentStepAttemptFinalOutcome = Exclude<
  PaymentStepAttemptOutcome,
  "pending"
>;

export interface CreatePaymentStepAttemptProps {
  attemptNo: number;
  id: string;
  paymentStepId: string;
  providerRef?: string | null;
  providerSnapshot?: unknown;
  submittedAt: Date;
}

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

function assertValidDate(value: Date, field: string): void {
  invariant(value instanceof Date && !Number.isNaN(value.getTime()), `${field} is invalid`, {
    code: "treasury.payment_step_attempt.invalid_date",
    meta: { field },
  });
}

function normalizeSnapshot(
  snapshot: PaymentStepAttemptRecord,
): PaymentStepAttemptRecord {
  invariant(snapshot.id.trim().length > 0, "Payment step attempt id is required", {
    code: "treasury.payment_step_attempt.id_required",
  });
  invariant(
    snapshot.paymentStepId.trim().length > 0,
    "Payment step id is required",
    {
      code: "treasury.payment_step_attempt.payment_step_required",
      meta: { attemptId: snapshot.id },
    },
  );
  invariant(
    Number.isInteger(snapshot.attemptNo) && snapshot.attemptNo > 0,
    "Payment step attempt number must be positive",
    {
      code: "treasury.payment_step_attempt.attempt_no_invalid",
      meta: { attemptId: snapshot.id, attemptNo: snapshot.attemptNo },
    },
  );
  assertValidDate(snapshot.submittedAt, "submittedAt");
  assertValidDate(snapshot.createdAt, "createdAt");
  assertValidDate(snapshot.updatedAt, "updatedAt");
  if (snapshot.outcomeAt) {
    assertValidDate(snapshot.outcomeAt, "outcomeAt");
  }
  invariant(
    snapshot.outcome === "pending" || snapshot.outcomeAt !== null,
    "Finalized payment step attempts require outcomeAt",
    {
      code: "treasury.payment_step_attempt.outcome_at_required",
      meta: { attemptId: snapshot.id, outcome: snapshot.outcome },
    },
  );
  invariant(
    snapshot.outcome !== "pending" || snapshot.outcomeAt === null,
    "Pending payment step attempts cannot have outcomeAt",
    {
      code: "treasury.payment_step_attempt.pending_outcome_at_invalid",
      meta: { attemptId: snapshot.id },
    },
  );

  return {
    ...snapshot,
    createdAt: cloneDate(snapshot.createdAt),
    outcomeAt: cloneNullableDate(snapshot.outcomeAt),
    providerRef: normalizeOptionalText(snapshot.providerRef),
    submittedAt: cloneDate(snapshot.submittedAt),
    updatedAt: cloneDate(snapshot.updatedAt),
  };
}

export class PaymentStepAttempt {
  private constructor(private readonly snapshot: PaymentStepAttemptRecord) {}

  static create(input: CreatePaymentStepAttemptProps): PaymentStepAttempt {
    return new PaymentStepAttempt(
      normalizeSnapshot({
        attemptNo: input.attemptNo,
        createdAt: input.submittedAt,
        id: input.id,
        outcome: "pending",
        outcomeAt: null,
        paymentStepId: input.paymentStepId,
        providerRef: input.providerRef ?? null,
        providerSnapshot: input.providerSnapshot ?? null,
        submittedAt: input.submittedAt,
        updatedAt: input.submittedAt,
      }),
    );
  }

  static fromSnapshot(snapshot: PaymentStepAttemptRecord): PaymentStepAttempt {
    return new PaymentStepAttempt(normalizeSnapshot(snapshot));
  }

  get attemptNo(): number {
    return this.snapshot.attemptNo;
  }

  get id(): string {
    return this.snapshot.id;
  }

  get outcome(): PaymentStepAttemptOutcome {
    return this.snapshot.outcome;
  }

  get outcomeAt(): Date | null {
    return cloneNullableDate(this.snapshot.outcomeAt);
  }

  get paymentStepId(): string {
    return this.snapshot.paymentStepId;
  }

  isPending(): boolean {
    return this.snapshot.outcome === "pending";
  }

  isSettledBefore(at: Date): boolean {
    return (
      this.snapshot.outcome === "settled" &&
      this.snapshot.outcomeAt !== null &&
      this.snapshot.outcomeAt.getTime() <= at.getTime()
    );
  }

  recordOutcome(input: {
    outcome: PaymentStepAttemptFinalOutcome;
    outcomeAt: Date;
  }): PaymentStepAttempt {
    assertValidDate(input.outcomeAt, "outcomeAt");

    if (input.outcome === "returned") {
      invariant(
        this.snapshot.outcome === "settled",
        "Returned payment step attempts require a settled attempt",
        {
          code: "treasury.payment_step_attempt.return_requires_settled",
          meta: { attemptId: this.snapshot.id, outcome: this.snapshot.outcome },
        },
      );
    } else {
      invariant(
        this.snapshot.outcome === "pending",
        "Only pending payment step attempts can be finalized",
        {
          code: "treasury.payment_step_attempt.finalize_not_allowed",
          meta: { attemptId: this.snapshot.id, outcome: this.snapshot.outcome },
        },
      );
    }

    return new PaymentStepAttempt(
      normalizeSnapshot({
        ...this.snapshot,
        outcome: input.outcome,
        outcomeAt: input.outcomeAt,
        updatedAt: input.outcomeAt,
      }),
    );
  }

  toSnapshot(): PaymentStepAttemptRecord {
    return normalizeSnapshot(this.snapshot);
  }
}
