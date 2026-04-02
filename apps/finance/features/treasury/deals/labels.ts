import type { Option } from "@/types/data-table";

type DealBadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const FINANCE_DEAL_QUEUE_VALUES = [
  "funding",
  "execution",
  "failed_instruction",
] as const;

export type FinanceDealQueue = (typeof FINANCE_DEAL_QUEUE_VALUES)[number];

export const FINANCE_DEAL_STATUS_VALUES = [
  "draft",
  "submitted",
  "rejected",
  "preparing_documents",
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
  "done",
  "cancelled",
] as const;

export type FinanceDealStatus = (typeof FINANCE_DEAL_STATUS_VALUES)[number];

export const FINANCE_DEAL_TYPE_VALUES = [
  "payment",
  "currency_exchange",
  "currency_transit",
  "exporter_settlement",
] as const;

export type FinanceDealType = (typeof FINANCE_DEAL_TYPE_VALUES)[number];

export const FINANCE_DEAL_QUEUE_LABELS: Record<FinanceDealQueue, string> = {
  execution: "Исполнение",
  failed_instruction: "Блокеры исполнения",
  funding: "Фондирование",
};

export const FINANCE_DEAL_STATUS_LABELS: Record<FinanceDealStatus, string> = {
  awaiting_funds: "Ожидание средств",
  awaiting_payment: "Ожидание оплаты",
  cancelled: "Отменена",
  closing_documents: "Закрывающие документы",
  done: "Завершена",
  draft: "Черновик",
  preparing_documents: "Подготовка документов",
  rejected: "Отклонена",
  submitted: "Отправлена",
};

export const FINANCE_DEAL_TYPE_LABELS: Record<FinanceDealType, string> = {
  currency_exchange: "Обмен валюты",
  currency_transit: "Валютный транзит",
  exporter_settlement: "Расчеты с экспортером",
  payment: "Платеж поставщику",
};

export const DEAL_CAPABILITY_LABELS: Record<string, string> = {
  can_collect: "Сбор средств",
  can_exporter_settle: "Расчеты экспортера",
  can_fx: "Конвертация",
  can_payout: "Выплата",
  can_transit: "Транзит",
};

export const DEAL_CAPABILITY_STATUS_LABELS: Record<string, string> = {
  disabled: "Выключена",
  enabled: "Включена",
  pending: "Ожидает настройки",
};

export const DEAL_LEG_KIND_LABELS: Record<string, string> = {
  collect: "Сбор средств",
  convert: "Конвертация",
  payout: "Выплата",
  settle_exporter: "Расчет с экспортером",
  transit_hold: "Транзитное удержание",
};

export const DEAL_LEG_STATE_LABELS: Record<string, string> = {
  blocked: "Заблокирован",
  done: "Завершен",
  in_progress: "В работе",
  pending: "Ожидает",
  ready: "Готов",
  skipped: "Пропущен",
};

export const DEAL_OPERATIONAL_POSITION_LABELS: Record<string, string> = {
  customer_receivable: "Дебиторка клиента",
  exporter_expected_receivable: "Ожидаемая выручка экспортера",
  fee_revenue: "Комиссионный доход",
  in_transit: "Средства в транзите",
  intercompany_due_from: "Межкомпанейская дебиторка",
  intercompany_due_to: "Межкомпанейская кредиторка",
  provider_payable: "Обязательство перед провайдером",
  spread_revenue: "Доход от спреда",
  suspense: "Суспенс",
};

export const DEAL_OPERATIONAL_POSITION_STATE_LABELS: Record<string, string> = {
  blocked: "Заблокирована",
  done: "Закрыта",
  in_progress: "В работе",
  not_applicable: "Не применяется",
  pending: "Ожидает",
  ready: "Готова",
};

export const DEAL_QUOTE_STATUS_LABELS: Record<string, string> = {
  active: "Активна",
  cancelled: "Отменена",
  expired: "Истекла",
  used: "Исполнена",
};

export const DEAL_TIMELINE_EVENT_LABELS: Record<string, string> = {
  attachment_deleted: "Вложение удалено",
  attachment_uploaded: "Вложение загружено",
  calculation_attached: "Расчет привязан",
  deal_created: "Сделка создана",
  document_created: "Документ создан",
  document_status_changed: "Статус документа изменен",
  intake_saved: "Анкета сохранена",
  leg_state_changed: "Состояние этапа изменено",
  participant_changed: "Участники изменены",
  quote_accepted: "Котировка принята",
  quote_created: "Котировка создана",
  quote_expired: "Котировка истекла",
  quote_used: "Котировка исполнена",
  status_changed: "Статус сделки изменен",
};

export function getFinanceDealQueueLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return FINANCE_DEAL_QUEUE_LABELS[value as FinanceDealQueue] ?? value;
}

export function getFinanceDealStatusLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return FINANCE_DEAL_STATUS_LABELS[value as FinanceDealStatus] ?? value;
}

export function getFinanceDealTypeLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return FINANCE_DEAL_TYPE_LABELS[value as FinanceDealType] ?? value;
}

export function getDealCapabilityLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return DEAL_CAPABILITY_LABELS[value] ?? value;
}

export function getDealCapabilityStatusLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return DEAL_CAPABILITY_STATUS_LABELS[value] ?? value;
}

export function getDealLegKindLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return DEAL_LEG_KIND_LABELS[value] ?? value;
}

export function getDealLegStateLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return DEAL_LEG_STATE_LABELS[value] ?? value;
}

export function getDealOperationalPositionLabel(
  value: string | null | undefined,
) {
  if (!value) {
    return "—";
  }

  return DEAL_OPERATIONAL_POSITION_LABELS[value] ?? value;
}

export function getDealOperationalPositionStateLabel(
  value: string | null | undefined,
) {
  if (!value) {
    return "—";
  }

  return DEAL_OPERATIONAL_POSITION_STATE_LABELS[value] ?? value;
}

export function getDealQuoteStatusLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return DEAL_QUOTE_STATUS_LABELS[value] ?? value;
}

export function getDealTimelineEventLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return DEAL_TIMELINE_EVENT_LABELS[value] ?? value;
}

export function getFinanceDealQueueOptions(): Option[] {
  return FINANCE_DEAL_QUEUE_VALUES.map((value) => ({
    value,
    label: FINANCE_DEAL_QUEUE_LABELS[value],
  }));
}

export function getFinanceDealStatusOptions(): Option[] {
  return FINANCE_DEAL_STATUS_VALUES.map((value) => ({
    value,
    label: FINANCE_DEAL_STATUS_LABELS[value],
  }));
}

export function getFinanceDealTypeOptions(): Option[] {
  return FINANCE_DEAL_TYPE_VALUES.map((value) => ({
    value,
    label: FINANCE_DEAL_TYPE_LABELS[value],
  }));
}

export function getFinanceDealDisplayTitle(input: {
  applicantDisplayName?: string | null;
  id: string;
  type: string;
}) {
  const applicantLabel =
    input.applicantDisplayName?.trim().length
      ? input.applicantDisplayName.trim()
      : input.id;

  return `${getFinanceDealTypeLabel(input.type)} • ${applicantLabel}`;
}

export function getFinanceDealQueueVariant(
  value: string | null | undefined,
): DealBadgeVariant {
  switch (value) {
    case "execution":
      return "default";
    case "failed_instruction":
      return "destructive";
    case "funding":
      return "secondary";
    default:
      return "outline";
  }
}

export function getFinanceDealStatusVariant(
  value: string | null | undefined,
): DealBadgeVariant {
  switch (value) {
    case "done":
      return "default";
    case "rejected":
    case "cancelled":
      return "destructive";
    case "draft":
      return "secondary";
    case "submitted":
    case "preparing_documents":
    case "awaiting_funds":
    case "awaiting_payment":
    case "closing_documents":
      return "outline";
    default:
      return "outline";
  }
}

export function getDealCapabilityStatusVariant(
  value: string | null | undefined,
): DealBadgeVariant {
  switch (value) {
    case "enabled":
      return "default";
    case "disabled":
      return "destructive";
    case "pending":
      return "secondary";
    default:
      return "outline";
  }
}

export function getDealOperationalPositionStateVariant(
  value: string | null | undefined,
): DealBadgeVariant {
  switch (value) {
    case "done":
      return "default";
    case "blocked":
      return "destructive";
    case "pending":
      return "secondary";
    case "in_progress":
    case "ready":
    case "not_applicable":
      return "outline";
    default:
      return "outline";
  }
}

export function getDealQuoteStatusVariant(
  value: string | null | undefined,
): DealBadgeVariant {
  switch (value) {
    case "active":
      return "default";
    case "cancelled":
      return "outline";
    case "expired":
      return "destructive";
    case "used":
      return "secondary";
    default:
      return "outline";
  }
}
