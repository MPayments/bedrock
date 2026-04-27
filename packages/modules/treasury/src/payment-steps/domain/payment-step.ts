import { AggregateRoot, invariant } from "@bedrock/shared/core/domain";

import { PaymentStepAttempt } from "./payment-step-attempt";
import type {
  ArtifactRef,
  PaymentStepAttemptRecord,
  PaymentStepDealLegRole,
  PaymentStepKind,
  PaymentStepPartyRef,
  PaymentStepPurpose,
  PaymentStepRate,
  PaymentStepRecord,
  PaymentStepState,
  PostingDocumentRef,
} from "./types";
import { PAYMENT_STEP_SETTLEMENT_EVIDENCE_PURPOSE_VALUES } from "./types";

export type PaymentStepSnapshot = PaymentStepRecord;

export interface CreatePaymentStepProps {
  dealId?: string | null;
  dealLegIdx?: number | null;
  dealLegRole?: PaymentStepDealLegRole | null;
  fromAmountMinor?: bigint | null;
  fromCurrencyId: string;
  fromParty: PaymentStepPartyRef;
  id: string;
  kind: PaymentStepKind;
  purpose: PaymentStepPurpose;
  rate?: PaymentStepRate | null;
  toAmountMinor?: bigint | null;
  toCurrencyId: string;
  toParty: PaymentStepPartyRef;
  treasuryBatchId?: string | null;
}

export type PaymentStepRouteAmendment = Partial<{
  fromAmountMinor: bigint | null;
  fromCurrencyId: string;
  fromParty: PaymentStepPartyRef;
  rate: PaymentStepRate | null;
  toAmountMinor: bigint | null;
  toCurrencyId: string;
  toParty: PaymentStepPartyRef;
}>;

export type PaymentStepConfirmOutcome = "settled" | "failed" | "returned";

export interface SubmitPaymentStepAttemptInput {
  attemptId: string;
  providerRef?: string | null;
  providerSnapshot?: unknown;
  submittedAt: Date;
}

export interface ConfirmPaymentStepInput {
  artifacts?: ArtifactRef[];
  attemptId?: string;
  failureReason?: string | null;
  outcome: PaymentStepConfirmOutcome;
  outcomeAt: Date;
}

const AMENDABLE_STATES: PaymentStepState[] = ["draft", "scheduled", "pending"];
const SUBMITTABLE_STATES: PaymentStepState[] = ["pending", "failed"];

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function cloneNullableDate(value: Date | null): Date | null {
  return value ? cloneDate(value) : null;
}

function assertValidDate(value: Date, field: string): void {
  invariant(value instanceof Date && !Number.isNaN(value.getTime()), `${field} is invalid`, {
    code: "treasury.payment_step.invalid_date",
    meta: { field },
  });
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeRequiredText(value: string, field: string): string {
  const normalized = value.trim();
  invariant(normalized.length > 0, `${field} is required`, {
    code: "treasury.payment_step.required",
    meta: { field },
  });
  return normalized;
}

function normalizeParty(party: PaymentStepPartyRef, field: string): PaymentStepPartyRef {
  return {
    id: normalizeRequiredText(party.id, `${field}.id`),
    requisiteId: normalizeOptionalText(party.requisiteId),
  };
}

function normalizeRate(rate: PaymentStepRate | null): PaymentStepRate | null {
  if (!rate) {
    return null;
  }

  return {
    lockedSide: rate.lockedSide,
    value: normalizeRequiredText(rate.value, "rate.value"),
  };
}

function normalizeAmount(
  amount: bigint | null | undefined,
  field: string,
): bigint | null {
  if (amount == null) {
    return null;
  }

  invariant(amount > 0n, `${field} must be positive`, {
    code: "treasury.payment_step.amount_invalid",
    meta: { amount: amount.toString(), field },
  });
  return amount;
}

function clonePosting(posting: PostingDocumentRef): PostingDocumentRef {
  return { ...posting };
}

function cloneArtifact(artifact: ArtifactRef): ArtifactRef {
  return { ...artifact };
}

function hasSettlementEvidence(artifacts: ArtifactRef[]): boolean {
  return artifacts.some((artifact) =>
    PAYMENT_STEP_SETTLEMENT_EVIDENCE_PURPOSE_VALUES.includes(
      artifact.purpose as (typeof PAYMENT_STEP_SETTLEMENT_EVIDENCE_PURPOSE_VALUES)[number],
    ),
  );
}

function requiresSettlementEvidence(snapshot: PaymentStepSnapshot): boolean {
  return (
    snapshot.purpose === "deal_leg" &&
    snapshot.dealLegRole === "payout" &&
    snapshot.kind === "payout"
  );
}

function cloneAttemptRecord(
  attempt: PaymentStepAttemptRecord,
): PaymentStepAttemptRecord {
  return PaymentStepAttempt.fromSnapshot(attempt).toSnapshot();
}

function cloneSnapshot(snapshot: PaymentStepSnapshot): PaymentStepSnapshot {
  return {
    ...snapshot,
    artifacts: snapshot.artifacts.map(cloneArtifact),
    attempts: snapshot.attempts.map(cloneAttemptRecord),
    completedAt: cloneNullableDate(snapshot.completedAt),
    createdAt: cloneDate(snapshot.createdAt),
    fromParty: normalizeParty(snapshot.fromParty, "fromParty"),
    postings: snapshot.postings.map(clonePosting),
    rate: normalizeRate(snapshot.rate),
    scheduledAt: cloneNullableDate(snapshot.scheduledAt),
    submittedAt: cloneNullableDate(snapshot.submittedAt),
    toParty: normalizeParty(snapshot.toParty, "toParty"),
    updatedAt: cloneDate(snapshot.updatedAt),
  };
}

function normalizeAttempts(
  stepId: string,
  attempts: PaymentStepAttemptRecord[],
): PaymentStepAttemptRecord[] {
  return attempts.map((attempt, index) => {
    const normalized = PaymentStepAttempt.fromSnapshot(attempt).toSnapshot();
    invariant(
      normalized.paymentStepId === stepId,
      "Payment step attempt belongs to a different step",
      {
        code: "treasury.payment_step.attempt_step_mismatch",
        meta: {
          attemptId: normalized.id,
          attemptStepId: normalized.paymentStepId,
          stepId,
        },
      },
    );
    invariant(
      normalized.attemptNo === index + 1,
      "Payment step attempts must be append-only and sequential",
      {
        code: "treasury.payment_step.attempt_sequence_invalid",
        meta: {
          attemptId: normalized.id,
          attemptNo: normalized.attemptNo,
          expectedAttemptNo: index + 1,
          stepId,
        },
      },
    );

    return normalized;
  });
}

function normalizeSnapshot(snapshot: PaymentStepSnapshot): PaymentStepSnapshot {
  const id = normalizeRequiredText(snapshot.id, "id");
  assertValidDate(snapshot.createdAt, "createdAt");
  assertValidDate(snapshot.updatedAt, "updatedAt");
  if (snapshot.scheduledAt) {
    assertValidDate(snapshot.scheduledAt, "scheduledAt");
  }
  if (snapshot.submittedAt) {
    assertValidDate(snapshot.submittedAt, "submittedAt");
  }
  if (snapshot.completedAt) {
    assertValidDate(snapshot.completedAt, "completedAt");
  }

  const normalized: PaymentStepSnapshot = {
    ...snapshot,
    artifacts: snapshot.artifacts.map(cloneArtifact),
    attempts: normalizeAttempts(id, snapshot.attempts),
    completedAt: cloneNullableDate(snapshot.completedAt),
    createdAt: cloneDate(snapshot.createdAt),
    dealId: normalizeOptionalText(snapshot.dealId),
    failureReason: normalizeOptionalText(snapshot.failureReason),
    fromAmountMinor: normalizeAmount(
      snapshot.fromAmountMinor,
      "fromAmountMinor",
    ),
    fromCurrencyId: normalizeRequiredText(
      snapshot.fromCurrencyId,
      "fromCurrencyId",
    ),
    fromParty: normalizeParty(snapshot.fromParty, "fromParty"),
    id,
    postings: snapshot.postings.map(clonePosting),
    rate: normalizeRate(snapshot.rate),
    scheduledAt: cloneNullableDate(snapshot.scheduledAt),
    submittedAt: cloneNullableDate(snapshot.submittedAt),
    toAmountMinor: normalizeAmount(snapshot.toAmountMinor, "toAmountMinor"),
    toCurrencyId: normalizeRequiredText(snapshot.toCurrencyId, "toCurrencyId"),
    toParty: normalizeParty(snapshot.toParty, "toParty"),
    treasuryBatchId: normalizeOptionalText(snapshot.treasuryBatchId),
    updatedAt: cloneDate(snapshot.updatedAt),
  };

  if (normalized.dealLegIdx !== null) {
    invariant(
      Number.isInteger(normalized.dealLegIdx) && normalized.dealLegIdx >= 0,
      "Payment step deal leg index must be non-negative",
      {
        code: "treasury.payment_step.deal_leg_idx_invalid",
        meta: { dealLegIdx: normalized.dealLegIdx, stepId: normalized.id },
      },
    );
  }
  if (normalized.purpose === "deal_leg") {
    invariant(
      normalized.dealId !== null &&
        normalized.dealLegIdx !== null &&
        normalized.dealLegRole !== null,
      "Deal leg payment steps require deal context",
      {
        code: "treasury.payment_step.deal_context_required",
        meta: { stepId: normalized.id },
      },
    );
  }
  if (normalized.state === "completed") {
    invariant(
      normalized.completedAt !== null,
      "Completed payment steps require completedAt",
      {
        code: "treasury.payment_step.completed_at_required",
        meta: { stepId: normalized.id },
      },
    );
    invariant(
      normalized.attempts.some((attempt) => attempt.outcome === "settled"),
      "Completed payment steps require a settled attempt",
      {
        code: "treasury.payment_step.completed_attempt_required",
        meta: { stepId: normalized.id },
      },
    );
    if (requiresSettlementEvidence(normalized)) {
      invariant(
        hasSettlementEvidence(normalized.artifacts),
        "Completed beneficiary payout steps require settlement evidence",
        {
          code: "treasury.payment_step.evidence_required",
          meta: { stepId: normalized.id },
        },
      );
    }
  }
  if (normalized.state === "returned") {
    invariant(
      normalized.completedAt !== null,
      "Returned payment steps require prior completion",
      {
        code: "treasury.payment_step.return_requires_completion",
        meta: { stepId: normalized.id },
      },
    );
    invariant(
      normalized.attempts.some(
        (attempt) =>
          attempt.outcome === "returned" &&
          attempt.outcomeAt !== null &&
          normalized.completedAt !== null &&
          attempt.outcomeAt.getTime() >= normalized.completedAt.getTime(),
      ),
      "Returned payment steps require a completed attempt before return",
      {
        code: "treasury.payment_step.return_attempt_required",
        meta: { stepId: normalized.id },
      },
    );
  }

  return normalized;
}

export class PaymentStep extends AggregateRoot<string> {
  private constructor(private readonly snapshot: PaymentStepSnapshot) {
    super({ id: snapshot.id, props: {} });
  }

  static create(input: CreatePaymentStepProps, now: Date): PaymentStep {
    return new PaymentStep(
      normalizeSnapshot({
        artifacts: [],
        attempts: [],
        completedAt: null,
        createdAt: now,
        dealId: input.dealId ?? null,
        dealLegIdx: input.dealLegIdx ?? null,
        dealLegRole: input.dealLegRole ?? null,
        failureReason: null,
        fromAmountMinor: input.fromAmountMinor ?? null,
        fromCurrencyId: input.fromCurrencyId,
        fromParty: input.fromParty,
        id: input.id,
        kind: input.kind,
        postings: [],
        purpose: input.purpose,
        rate: input.rate ?? null,
        scheduledAt: null,
        state: "draft",
        submittedAt: null,
        toAmountMinor: input.toAmountMinor ?? null,
        toCurrencyId: input.toCurrencyId,
        toParty: input.toParty,
        treasuryBatchId: input.treasuryBatchId ?? null,
        updatedAt: now,
      }),
    );
  }

  static fromSnapshot(snapshot: PaymentStepSnapshot): PaymentStep {
    return new PaymentStep(normalizeSnapshot(snapshot));
  }

  amend(input: PaymentStepRouteAmendment, now: Date): PaymentStep {
    invariant(
      AMENDABLE_STATES.includes(this.snapshot.state),
      "Payment step route cannot be amended after processing starts",
      {
        code: "treasury.payment_step.amend_not_allowed",
        meta: { state: this.snapshot.state, stepId: this.id },
      },
    );

    return new PaymentStep(
      normalizeSnapshot({
        ...this.snapshot,
        fromAmountMinor: input.fromAmountMinor !== undefined
          ? input.fromAmountMinor
          : this.snapshot.fromAmountMinor,
        fromCurrencyId: input.fromCurrencyId !== undefined
          ? input.fromCurrencyId
          : this.snapshot.fromCurrencyId,
        fromParty: input.fromParty !== undefined
          ? input.fromParty
          : this.snapshot.fromParty,
        rate: input.rate !== undefined ? input.rate : this.snapshot.rate,
        toAmountMinor: input.toAmountMinor !== undefined
          ? input.toAmountMinor
          : this.snapshot.toAmountMinor,
        toCurrencyId: input.toCurrencyId !== undefined
          ? input.toCurrencyId
          : this.snapshot.toCurrencyId,
        toParty: input.toParty !== undefined ? input.toParty : this.snapshot.toParty,
        updatedAt: now,
      }),
    );
  }

  schedule(scheduledAt: Date, now: Date): PaymentStep {
    assertValidDate(scheduledAt, "scheduledAt");
    invariant(
      AMENDABLE_STATES.includes(this.snapshot.state),
      "Payment step cannot be scheduled after processing starts",
      {
        code: "treasury.payment_step.schedule_not_allowed",
        meta: { state: this.snapshot.state, stepId: this.id },
      },
    );

    return new PaymentStep(
      normalizeSnapshot({
        ...this.snapshot,
        scheduledAt,
        state: "scheduled",
        updatedAt: now,
      }),
    );
  }

  markPending(now: Date): PaymentStep {
    invariant(
      this.snapshot.state === "draft" || this.snapshot.state === "scheduled",
      "Payment step cannot be marked pending from its current state",
      {
        code: "treasury.payment_step.pending_not_allowed",
        meta: { state: this.snapshot.state, stepId: this.id },
      },
    );

    return new PaymentStep(
      normalizeSnapshot({
        ...this.snapshot,
        state: "pending",
        updatedAt: now,
      }),
    );
  }

  submit(input: SubmitPaymentStepAttemptInput): PaymentStep {
    invariant(
      SUBMITTABLE_STATES.includes(this.snapshot.state),
      "Payment step cannot be submitted from its current state",
      {
        code: "treasury.payment_step.submit_not_allowed",
        meta: { state: this.snapshot.state, stepId: this.id },
      },
    );
    const latestAttempt = this.latestAttempt();
    invariant(
      latestAttempt === null || !latestAttempt.isPending(),
      "Payment step already has a pending attempt",
      {
        code: "treasury.payment_step.pending_attempt_exists",
        meta: { stepId: this.id },
      },
    );

    const attempt = PaymentStepAttempt.create({
      attemptNo: this.snapshot.attempts.length + 1,
      id: input.attemptId,
      paymentStepId: this.id,
      providerRef: input.providerRef ?? null,
      providerSnapshot: input.providerSnapshot ?? null,
      submittedAt: input.submittedAt,
    });

    return new PaymentStep(
      normalizeSnapshot({
        ...this.snapshot,
        attempts: [...this.snapshot.attempts, attempt.toSnapshot()],
        failureReason: null,
        state: "processing",
        submittedAt: input.submittedAt,
        updatedAt: input.submittedAt,
      }),
    );
  }

  confirm(input: ConfirmPaymentStepInput): PaymentStep {
    if (input.outcome === "returned") {
      return this.markReturned(input);
    }

    invariant(
      this.snapshot.state === "processing",
      "Payment step outcome can only be recorded while processing",
      {
        code: "treasury.payment_step.confirm_not_allowed",
        meta: { state: this.snapshot.state, stepId: this.id },
      },
    );

    const attempt = this.requireAttempt(input.attemptId);
    const finalizedAttempt = attempt.recordOutcome({
      outcome: input.outcome,
      outcomeAt: input.outcomeAt,
    });
    const attempts = this.replaceAttempt(finalizedAttempt);

    if (input.outcome === "failed") {
      return new PaymentStep(
        normalizeSnapshot({
          ...this.snapshot,
          attempts,
          failureReason: normalizeOptionalText(input.failureReason),
          state: "failed",
          updatedAt: input.outcomeAt,
        }),
      );
    }

    const artifacts = [
      ...this.snapshot.artifacts.map(cloneArtifact),
      ...(input.artifacts ?? []).map(cloneArtifact),
    ];
    invariant(
      attempts.some((candidate) => candidate.outcome === "settled"),
      "Completed payment steps require a settled attempt",
      {
        code: "treasury.payment_step.completed_attempt_required",
        meta: { stepId: this.id },
      },
    );
    if (requiresSettlementEvidence(this.snapshot)) {
      invariant(
        hasSettlementEvidence(artifacts),
        "Completed beneficiary payout steps require settlement evidence",
        {
          code: "treasury.payment_step.evidence_required",
          meta: { stepId: this.id },
        },
      );
    }

    return new PaymentStep(
      normalizeSnapshot({
        ...this.snapshot,
        artifacts,
        attempts,
        completedAt: input.outcomeAt,
        failureReason: null,
        state: "completed",
        updatedAt: input.outcomeAt,
      }),
    );
  }

  cancel(now: Date): PaymentStep {
    invariant(
      AMENDABLE_STATES.includes(this.snapshot.state),
      "Payment step cannot be cancelled after processing starts",
      {
        code: "treasury.payment_step.cancel_not_allowed",
        meta: { state: this.snapshot.state, stepId: this.id },
      },
    );

    return new PaymentStep(
      normalizeSnapshot({
        ...this.snapshot,
        state: "cancelled",
        updatedAt: now,
      }),
    );
  }

  skip(now: Date): PaymentStep {
    invariant(
      AMENDABLE_STATES.includes(this.snapshot.state),
      "Payment step cannot be skipped after processing starts",
      {
        code: "treasury.payment_step.skip_not_allowed",
        meta: { state: this.snapshot.state, stepId: this.id },
      },
    );

    return new PaymentStep(
      normalizeSnapshot({
        ...this.snapshot,
        state: "skipped",
        updatedAt: now,
      }),
    );
  }

  /**
   * Attach a posting-document reference. Idempotent per `(documentId, kind)`
   * tuple — a second attach with the same pair is a no-op so deal-execution
   * workflows can safely auto-link on every Submit/Confirm without risking
   * duplicates. Allowed in every state: treasurers may surface a
   * retroactive document after the step already completed.
   */
  attachPosting(input: PostingDocumentRef, now: Date): PaymentStep {
    const documentId = normalizeRequiredText(input.documentId, "documentId");
    const kind = normalizeRequiredText(input.kind, "kind");
    const alreadyLinked = this.snapshot.postings.some(
      (existing) => existing.documentId === documentId && existing.kind === kind,
    );
    if (alreadyLinked) {
      return new PaymentStep(cloneSnapshot(this.snapshot));
    }

    return new PaymentStep(
      normalizeSnapshot({
        ...this.snapshot,
        postings: [...this.snapshot.postings, { documentId, kind }],
        updatedAt: now,
      }),
    );
  }

  toSnapshot(): PaymentStepSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  private latestAttempt(): PaymentStepAttempt | null {
    const latest = this.snapshot.attempts.at(-1);
    return latest ? PaymentStepAttempt.fromSnapshot(latest) : null;
  }

  private markReturned(input: ConfirmPaymentStepInput): PaymentStep {
    invariant(
      this.snapshot.state === "completed",
      "Returned payment steps require prior completion",
      {
        code: "treasury.payment_step.return_requires_completion",
        meta: { state: this.snapshot.state, stepId: this.id },
      },
    );
    const attempt = this.requireAttempt(input.attemptId);
    invariant(
      attempt.isSettledBefore(input.outcomeAt),
      "Returned payment steps require a completed attempt before return",
      {
        code: "treasury.payment_step.return_attempt_required",
        meta: { attemptId: attempt.id, stepId: this.id },
      },
    );

    const returnedAttempt = attempt.recordOutcome({
      outcome: "returned",
      outcomeAt: input.outcomeAt,
    });

    return new PaymentStep(
      normalizeSnapshot({
        ...this.snapshot,
        attempts: this.replaceAttempt(returnedAttempt),
        failureReason: normalizeOptionalText(input.failureReason),
        state: "returned",
        updatedAt: input.outcomeAt,
      }),
    );
  }

  private replaceAttempt(attempt: PaymentStepAttempt): PaymentStepAttemptRecord[] {
    return this.snapshot.attempts.map((candidate) =>
      candidate.id === attempt.id ? attempt.toSnapshot() : cloneAttemptRecord(candidate),
    );
  }

  private requireAttempt(attemptId?: string): PaymentStepAttempt {
    const attempt = attemptId
      ? this.snapshot.attempts.find((candidate) => candidate.id === attemptId)
      : this.snapshot.attempts.at(-1);

    invariant(attempt !== undefined, "Payment step attempt not found", {
      code: "treasury.payment_step.attempt_not_found",
      meta: { attemptId: attemptId ?? null, stepId: this.id },
    });

    return PaymentStepAttempt.fromSnapshot(attempt);
  }
}
