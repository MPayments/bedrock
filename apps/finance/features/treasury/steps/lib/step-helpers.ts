import type {
  FinanceDealPaymentStep,
  FinanceDealPaymentStepAttempt,
} from "@/features/treasury/deals/lib/queries";

export type StepState = FinanceDealPaymentStep["state"];
export type StepConfirmOutcome = "settled" | "failed" | "returned";

export const STEP_STATE_LABELS: Record<StepState, string> = {
  draft: "Черновик",
  scheduled: "Запланирован",
  pending: "Ожидает",
  processing: "В обработке",
  completed: "Выполнен",
  failed: "Ошибка",
  returned: "Возврат",
  cancelled: "Отменён",
  skipped: "Пропущен",
};

export const STEP_CONFIRM_OUTCOME_LABELS: Record<StepConfirmOutcome, string> = {
  settled: "Подтвердить исполнение",
  failed: "Отметить как ошибку",
  returned: "Подтвердить возврат",
};

/**
 * Treasurer-facing primary action derived from the step's current state.
 * - `submit` while the step is actionable but not yet in-flight
 * - `confirm` while the banking leg is processing and awaiting evidence
 * - `null` for terminal states (completed/cancelled/skipped/returned) — the
 *   overflow menu surfaces any remaining options (e.g. retry after failed)
 */
export type StepPrimaryAction = "submit" | "confirm" | null;

export function deriveStepPrimaryAction(
  state: StepState,
): StepPrimaryAction {
  switch (state) {
    case "pending":
    case "failed":
      return "submit";
    case "processing":
      return "confirm";
    default:
      return null;
  }
}

export type StepBadgeVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary";

/**
 * Map each state to a shadcn Badge variant. Mutable states use `outline` to
 * stay low-visual-weight; terminal success uses the strong `default`; errors
 * use `destructive`; override/skip uses `secondary`.
 */
export function stepBadgeVariant(state: StepState): StepBadgeVariant {
  switch (state) {
    case "completed":
      return "default";
    case "failed":
    case "returned":
      return "destructive";
    case "cancelled":
    case "skipped":
      return "secondary";
    default:
      return "outline";
  }
}

export interface AmendFieldValues {
  fromAmountMinor: string | null;
  fromCurrencyId: string;
  fromPartyId: string;
  fromRequisiteId: string | null;
  rate: { value: string; lockedSide: "in" | "out" } | null;
  toAmountMinor: string | null;
  toCurrencyId: string;
  toPartyId: string;
  toRequisiteId: string | null;
}

export interface AmendRouteInput {
  before: AmendFieldValues;
  after: AmendFieldValues;
}

/**
 * Build the `POST /v1/treasury/steps/{id}/amend` body for the fields that
 * actually changed. Returns `null` when nothing has changed so the caller can
 * skip the network round-trip.
 *
 * Party updates always send the full `{ id, requisiteId }` payload because
 * the backend schema requires both — changing only the entity leaves the
 * old requisite attached to the new owner, so the UI also resets the
 * requisite whenever the entity changes (enforced by the editor, not here).
 */
export function buildAmendRouteBody(
  input: AmendRouteInput,
): Record<string, unknown> | null {
  const body: Record<string, unknown> = {};

  if (input.before.fromAmountMinor !== input.after.fromAmountMinor) {
    body.fromAmountMinor = input.after.fromAmountMinor;
  }
  if (input.before.fromCurrencyId !== input.after.fromCurrencyId) {
    body.fromCurrencyId = input.after.fromCurrencyId;
  }
  if (
    input.before.fromPartyId !== input.after.fromPartyId ||
    input.before.fromRequisiteId !== input.after.fromRequisiteId
  ) {
    body.fromParty = {
      id: input.after.fromPartyId,
      requisiteId: input.after.fromRequisiteId,
    };
  }
  if (!rateEquals(input.before.rate, input.after.rate)) {
    body.rate = input.after.rate;
  }
  if (input.before.toAmountMinor !== input.after.toAmountMinor) {
    body.toAmountMinor = input.after.toAmountMinor;
  }
  if (input.before.toCurrencyId !== input.after.toCurrencyId) {
    body.toCurrencyId = input.after.toCurrencyId;
  }
  if (
    input.before.toPartyId !== input.after.toPartyId ||
    input.before.toRequisiteId !== input.after.toRequisiteId
  ) {
    body.toParty = {
      id: input.after.toPartyId,
      requisiteId: input.after.toRequisiteId,
    };
  }

  return Object.keys(body).length === 0 ? null : body;
}

function rateEquals(
  left: AmendFieldValues["rate"],
  right: AmendFieldValues["rate"],
): boolean {
  if (left === null && right === null) return true;
  if (left === null || right === null) return false;
  return left.value === right.value && left.lockedSide === right.lockedSide;
}

/**
 * Latest attempt for a step (attempts are append-only and ordered by attempt
 * number). Returns `null` if the step has never been submitted.
 */
export function latestStepAttempt(
  step: FinanceDealPaymentStep,
): FinanceDealPaymentStepAttempt | null {
  if (step.attempts.length === 0) return null;
  return step.attempts.reduce((acc, attempt) =>
    attempt.attemptNo > acc.attemptNo ? attempt : acc,
  );
}
