import { formatCompactId } from "@bedrock/shared/core/uuid";
import { TREASURY_OPERATION_VIEW_VALUES } from "@bedrock/treasury/contracts";

import type { Option } from "@bedrock/sdk-tables-ui/lib/types";

type OperationBadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const TREASURY_OPERATION_KIND_LABELS = {
  fx_conversion: "Конвертация",
  intercompany_funding: "Межкомпанейское фондирование",
  intracompany_transfer: "Внутренний перевод",
  payin: "Поступление",
  payout: "Выплата",
} as const;

export const TREASURY_OPERATION_INSTRUCTION_STATUS_LABELS = {
  blocked: "Заблокирована",
  failed: "Ошибка исполнения",
  planned: "Запланирована",
  prepared: "Подготовлена",
  return_requested: "Возврат запрошен",
  returned: "Возвращена",
  settled: "Исполнена",
  submitted: "Отправлена",
  voided: "Отменена",
} as const;

export const TREASURY_OPERATION_STATE_LABELS = {
  planned: "План",
} as const;

export const TREASURY_OPERATION_PROJECTED_STATE_LABELS = {
  planned: "Запланирована",
  in_progress: "В исполнении",
  settled: "Исполнена",
  voided: "Отменена",
} as const;

export const TREASURY_OPERATION_VIEW_LABELS = {
  all: "Все",
  exceptions: "Исключения",
  fx: "FX",
  incoming: "Входящие",
  intercompany: "Межкомпанейские",
  intracompany: "Внутренние",
  outgoing: "Исходящие",
} as const;

export const TREASURY_OPERATION_VIEW_KEYS = [
  "all",
  ...TREASURY_OPERATION_VIEW_VALUES,
] as const;

export type TreasuryOperationSavedView =
  (typeof TREASURY_OPERATION_VIEW_KEYS)[number];

export function getTreasuryOperationKindLabel(value: string | null | undefined) {
  if (!value) {
    return "Операция";
  }

  return (
    TREASURY_OPERATION_KIND_LABELS[
      value as keyof typeof TREASURY_OPERATION_KIND_LABELS
    ] ?? value
  );
}

export function getTreasuryOperationKindOptions(): Option[] {
  return Object.entries(TREASURY_OPERATION_KIND_LABELS).map(
    ([value, label]) => ({
      label,
      value,
    }),
  );
}

export function getTreasuryOperationInstructionStatusLabel(
  value: string | null | undefined,
) {
  if (!value) {
    return "Статус не определен";
  }

  return (
    TREASURY_OPERATION_INSTRUCTION_STATUS_LABELS[
      value as keyof typeof TREASURY_OPERATION_INSTRUCTION_STATUS_LABELS
    ] ?? value
  );
}

export function getTreasuryOperationStateLabel(value: string | null | undefined) {
  if (!value) {
    return "Состояние не определено";
  }

  return (
    TREASURY_OPERATION_STATE_LABELS[
      value as keyof typeof TREASURY_OPERATION_STATE_LABELS
    ] ?? value
  );
}

export function getTreasuryOperationViewLabel(
  value: TreasuryOperationSavedView,
) {
  return TREASURY_OPERATION_VIEW_LABELS[value];
}

export function getTreasuryOperationKindVariant(
  value: string | null | undefined,
): OperationBadgeVariant {
  switch (value) {
    case "payout":
      return "default";
    case "fx_conversion":
      return "outline";
    case "intercompany_funding":
      return "secondary";
    case "intracompany_transfer":
      return "outline";
    case "payin":
      return "secondary";
    default:
      return "outline";
  }
}

export function getTreasuryOperationInstructionStatusVariant(
  value: string | null | undefined,
): OperationBadgeVariant {
  switch (value) {
    case "failed":
    case "blocked":
      return "destructive";
    case "settled":
      return "default";
    case "planned":
    case "prepared":
    case "return_requested":
      return "secondary";
    case "submitted":
    case "voided":
    case "returned":
      return "outline";
    default:
      return "outline";
  }
}

export function getTreasuryOperationProjectedStateLabel(
  value: string | null | undefined,
) {
  if (!value) {
    return "Проекция не рассчитана";
  }

  return (
    TREASURY_OPERATION_PROJECTED_STATE_LABELS[
      value as keyof typeof TREASURY_OPERATION_PROJECTED_STATE_LABELS
    ] ?? value
  );
}

export function getTreasuryOperationProjectedStateVariant(
  value: string | null | undefined,
): OperationBadgeVariant {
  switch (value) {
    case "settled":
      return "default";
    case "in_progress":
      return "secondary";
    case "voided":
      return "destructive";
    case "planned":
      return "outline";
    default:
      return "outline";
  }
}

export function getTreasuryOperationDisplayTitle(input: {
  applicantName?: string | null;
  dealId?: string | null;
  id: string;
  kind: string;
}) {
  const label =
    input.applicantName?.trim().length
      ? input.applicantName.trim()
      : `#${formatCompactId(input.dealId ?? input.id)}`;

  return `${getTreasuryOperationKindLabel(input.kind)} • ${label}`;
}
