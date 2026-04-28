import type {
  FinanceDealPaymentStep,
  FinanceDealPaymentStepAttempt,
} from "@/features/treasury/deals/lib/queries";

export type StepState = FinanceDealPaymentStep["state"];
export type StepKind = FinanceDealPaymentStep["kind"];
export type StepPurpose = FinanceDealPaymentStep["purpose"];
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

export const STEP_KIND_LABELS: Record<StepKind, string> = {
  payin: "Входящий платёж",
  payout: "Выплата",
  intracompany_transfer: "Внутренний перевод",
  intercompany_funding: "Межкомпанейское фондирование",
  internal_transfer: "Собственный перевод",
};

export const STEP_PURPOSE_LABELS: Record<StepPurpose, string> = {
  deal_leg: "Шаг сделки",
  pre_fund: "Пре-фондирование",
  standalone_payment: "Отдельная операция",
};

export function getStepKindLabel(
  step: Pick<FinanceDealPaymentStep, "fromCurrencyId" | "kind" | "toCurrencyId">,
): string {
  if (step.kind === "payout" && step.fromCurrencyId !== step.toCurrencyId) {
    return "Выплата с конвертацией";
  }

  return STEP_KIND_LABELS[step.kind];
}

export function requiresSettlementEvidence(step: FinanceDealPaymentStep): boolean {
  return (
    step.origin.type === "deal_execution_leg" &&
    step.kind === "payout"
  );
}

export type StepPrimaryAction = "submit" | "confirm" | null;

export function deriveStepPrimaryAction(
  state: StepState,
): StepPrimaryAction {
  switch (state) {
    case "draft":
    case "scheduled":
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

export function latestStepAttempt(
  step: FinanceDealPaymentStep,
): FinanceDealPaymentStepAttempt | null {
  if (step.attempts.length === 0) return null;
  return step.attempts.reduce((acc, attempt) =>
    attempt.attemptNo > acc.attemptNo ? attempt : acc,
  );
}
