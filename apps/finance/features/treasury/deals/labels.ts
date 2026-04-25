import { FORMAL_DOCUMENT_LABELS } from "@bedrock/deals/labels";
import { formatCompactId } from "@bedrock/shared/core/uuid";

import type { Option } from "@bedrock/sdk-tables-ui/lib/types";

export { FORMAL_DOCUMENT_LABELS };

type DealBadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const FINANCE_DEAL_QUEUE_VALUES = [
  "funding",
  "execution",
  "failed_instruction",
] as const;

export type FinanceDealQueue = (typeof FINANCE_DEAL_QUEUE_VALUES)[number];

export const FINANCE_DEAL_STAGE_VALUES = [
  "awaiting_collection",
  "awaiting_fx",
  "awaiting_intracompany_transfer",
  "awaiting_intercompany_funding",
  "awaiting_payout",
  "awaiting_reconciliation",
  "ready_to_close",
] as const;

export type FinanceDealStage = (typeof FINANCE_DEAL_STAGE_VALUES)[number];

export const FINANCE_DEAL_BLOCKER_STATE_VALUES = [
  "blocked",
  "clear",
] as const;

export type FinanceDealBlockerState =
  (typeof FINANCE_DEAL_BLOCKER_STATE_VALUES)[number];

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

const FINANCE_DEAL_QUEUE_LABELS: Record<FinanceDealQueue, string> = {
  execution: "Исполнение",
  failed_instruction: "Блокеры исполнения",
  funding: "Фондирование",
};

const FINANCE_DEAL_STAGE_LABELS: Record<FinanceDealStage, string> = {
  awaiting_collection: "Ожидание поступления",
  awaiting_fx: "Ожидание FX",
  awaiting_intercompany_funding: "Ожидание межкомпанейского фондирования",
  awaiting_intracompany_transfer: "Ожидание внутреннего перевода",
  awaiting_payout: "Ожидание выплаты",
  awaiting_reconciliation: "Ожидание сверки",
  ready_to_close: "Готова к закрытию",
};

const FINANCE_DEAL_BLOCKER_STATE_LABELS: Record<
  FinanceDealBlockerState,
  string
> = {
  blocked: "С блокерами",
  clear: "Без блокеров",
};

const FINANCE_DEAL_STATUS_LABELS: Record<FinanceDealStatus, string> = {
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

const FINANCE_DEAL_TYPE_LABELS: Record<FinanceDealType, string> = {
  currency_exchange: "Обмен валюты",
  currency_transit: "Валютный транзит",
  exporter_settlement: "Расчеты с экспортером",
  payment: "Платеж поставщику",
};

const DEAL_PARTICIPANT_ROLE_LABELS: Record<string, string> = {
  applicant: "юридическое лицо клиента",
  customer: "клиент",
  external_beneficiary: "получатель выплаты",
  external_payer: "плательщик",
  internal_entity: "наша организация",
};

const DEAL_LEG_KIND_LABELS: Record<string, string> = {
  collect: "Сбор средств",
  convert: "Конвертация",
  payout: "Выплата",
  settle_exporter: "Расчет с экспортером",
  transit_hold: "Транзитное удержание",
};

const DEAL_LEG_STATE_LABELS: Record<string, string> = {
  blocked: "Заблокирован",
  done: "Завершен",
  in_progress: "В работе",
  pending: "Ожидает",
  ready: "Подготовлен",
  skipped: "Пропущен",
};

const DEAL_OPERATIONAL_POSITION_LABELS: Record<string, string> = {
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

const FINANCE_PRIMARY_POSITION_LABELS: Record<string, string> = {
  customer_receivable: "Поступление от клиента",
  exporter_expected_receivable: "Ожидаемая экспортная выручка",
  in_transit: "Средства в транзите",
  provider_payable: "Выплата получателю",
};


const DEAL_OPERATIONAL_POSITION_STATE_LABELS: Record<string, string> = {
  blocked: "Заблокирована",
  done: "Закрыта",
  in_progress: "В работе",
  not_applicable: "Не применяется",
  pending: "Ожидает",
  ready: "Готова",
};

const DEAL_QUOTE_STATUS_LABELS: Record<string, string> = {
  active: "Активна",
  cancelled: "Отменена",
  expired: "Истекла",
  used: "Исполнена",
};

const DEAL_TIMELINE_EVENT_LABELS: Record<string, string> = {
  attachment_deleted: "Вложение удалено",
  attachment_ingested: "Файл распознан",
  attachment_uploaded: "Вложение загружено",
  calculation_attached: "Расчет привязан",
  deal_created: "Сделка создана",
  deal_closed: "Сделка закрыта",
  document_created: "Документ создан",
  document_status_changed: "Статус документа изменен",
  execution_requested: "Запущено исполнение сделки",
  intake_saved: "Анкета сохранена",
  instruction_failed: "Инструкция завершилась ошибкой",
  instruction_prepared: "Инструкция подготовлена",
  instruction_retried: "Инструкция отправлена на повтор",
  instruction_returned: "Инструкция возвращена",
  instruction_settled: "Инструкция исполнена",
  instruction_submitted: "Инструкция отправлена",
  instruction_voided: "Инструкция отменена",
  leg_operation_created: "Создана казначейская операция",
  leg_state_changed: "Состояние шага изменено",
  participant_changed: "Участники изменены",
  quote_accepted: "Котировка принята",
  quote_created: "Котировка создана",
  quote_expired: "Котировка истекла",
  quote_used: "Котировка исполнена",
  return_requested: "Запрошен возврат",
  status_changed: "Статус сделки изменен",
};

const DEAL_NEXT_ACTION_LABELS: Record<string, string> = {
  "Accept quote": "Принять котировку",
  "Complete intake": "Заполнить анкету",
  "Continue processing": "Продолжить обработку",
  "Create calculation from accepted quote":
    "Создать расчет по принятой котировке",
  "No action": "Действий не требуется",
  "Prepare closing documents": "Подготовить закрывающие документы",
  "Prepare documents": "Подготовить документы",
  "Resolve approvals": "Завершить согласование",
  "Resolve operational state": "Разобрать операционное состояние",
  "Submit deal": "Отправить сделку",
  "Update execution leg state": "Обновить шаг исполнения",
};

const DEAL_MESSAGE_LABELS: Record<string, string> = {
  "A calculation derived from the accepted quote is required":
    "Нужно создать расчет по принятой котировке.",
  "An accepted quote is required for convert deals":
    "Для сделки с конвертацией нужна принятая котировка.",
  "Applicant requisite is required":
    "Выберите реквизиты юридического лица.",
  "Beneficiary bank instructions are required":
    "Заполните банковские реквизиты получателя.",
  "Contract number is required": "Укажите номер договора.",
  "Expected amount is required": "Укажите ожидаемую сумму поступления.",
  "Expected currency is required": "Укажите валюту ожидаемого поступления.",
  "Exchange deals require a different target currency":
    "Для обмена валюты выберите другую валюту назначения.",
  "External beneficiary is required": "Укажите получателя выплаты.",
  "External payer is required": "Укажите плательщика.",
  "Invoice number is required": "Укажите номер инвойса.",
  "Manual settlement bank instructions are required":
    "Заполните банковские реквизиты для зачисления средств.",
  "Purpose is required": "Укажите назначение платежа.",
  "Required intake sections are incomplete": "Анкета заполнена не полностью.",
  "Settlement mode is required": "Укажите, куда зачислить средства.",
  "Source amount is required": "Укажите сумму сделки.",
  "Source currency is required": "Укажите валюту сделки.",
  "The accepted quote is no longer executable":
    "Принятая котировка больше не действует.",
};

const HIDDEN_OPERATIONAL_POSITION_KINDS = new Set([
  "intercompany_due_from",
  "intercompany_due_to",
  "suspense",
  "fee_revenue",
  "spread_revenue",
]);

function formatFallbackLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .join(" ");
}

export function getFinanceDealQueueLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return FINANCE_DEAL_QUEUE_LABELS[value as FinanceDealQueue] ?? value;
}

export function getFinanceDealStageLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return FINANCE_DEAL_STAGE_LABELS[value as FinanceDealStage] ?? value;
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

function getDealOperationalPositionLabel(
  value: string | null | undefined,
) {
  if (!value) {
    return "—";
  }

  return DEAL_OPERATIONAL_POSITION_LABELS[value] ?? value;
}

export function getFinancePrimaryOperationalPositionLabel(
  value: string | null | undefined,
) {
  if (!value) {
    return "—";
  }

  return FINANCE_PRIMARY_POSITION_LABELS[value] ?? getDealOperationalPositionLabel(value);
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

export function formatDealNextAction(value: string | null | undefined) {
  if (!value) {
    return "Действие не определено";
  }

  return DEAL_NEXT_ACTION_LABELS[value] ?? value;
}

export function formatDealWorkflowMessage(message: string | null | undefined) {
  if (!message) {
    return "Детали недоступны.";
  }

  if (DEAL_MESSAGE_LABELS[message]) {
    return DEAL_MESSAGE_LABELS[message];
  }

  const participantMatch = message.match(
    /^Required participant is unresolved: ([a-z_]+)$/,
  );
  if (participantMatch) {
    const role = participantMatch[1] ?? "";
    return `Не заполнен обязательный участник: ${
      DEAL_PARTICIPANT_ROLE_LABELS[role] ?? formatFallbackLabel(role)
    }.`;
  }

  const approvalPendingMatch = message.match(/^Approval is still pending: (.+)$/);
  if (approvalPendingMatch) {
    return `Согласование еще не завершено: ${approvalPendingMatch[1]}.`;
  }

  const approvalRejectedMatch = message.match(/^Approval was rejected: (.+)$/);
  if (approvalRejectedMatch) {
    return `Согласование отклонено: ${approvalRejectedMatch[1]}.`;
  }

  const positionMatch = message.match(
    /^Operational position is (missing|blocked|not complete|not ready): ([a-z_]+)$/,
  );
  if (positionMatch) {
    const state = positionMatch[1] ?? "";
    const kind = positionMatch[2] ?? "";
    const positionLabel =
      DEAL_OPERATIONAL_POSITION_LABELS[kind] ?? formatFallbackLabel(kind);

    if (state === "missing") {
      return `Не хватает операционной позиции: ${positionLabel}.`;
    }

    if (state === "blocked") {
      return `Операционная позиция заблокирована: ${positionLabel}.`;
    }

    if (state === "not complete") {
      return `Операционная позиция еще не завершена: ${positionLabel}.`;
    }

    return `Операционная позиция еще не готова: ${positionLabel}.`;
  }

  const documentMatch = message.match(
    /^(Opening|Closing) document is (required|not ready): ([a-z_]+)$/,
  );
  if (documentMatch) {
    const stage = documentMatch[1] === "Opening" ? "Открывающий" : "Закрывающий";
    const status = documentMatch[2];
    const docType = documentMatch[3] ?? "";
    const documentLabel = FORMAL_DOCUMENT_LABELS[docType] ?? formatFallbackLabel(docType);

    return status === "required"
      ? `${stage} документ обязателен: ${documentLabel}.`
      : `${stage} документ еще не готов: ${documentLabel}.`;
  }

  const executionLegMatch = message.match(
    /^Execution leg is (blocked|not ready|not complete): ([a-z_]+)$/,
  );
  if (executionLegMatch) {
    const state = executionLegMatch[1] ?? "";
    const kind = executionLegMatch[2] ?? "";
    const legLabel = DEAL_LEG_KIND_LABELS[kind] ?? formatFallbackLabel(kind);

    if (state === "blocked") {
      return `Этап исполнения заблокирован: ${legLabel}.`;
    }

    if (state === "not ready") {
      return `Этап исполнения еще не готов: ${legLabel}.`;
    }

    return `Этап исполнения еще не завершен: ${legLabel}.`;
  }

  return message;
}

export function formatOperationalPositionIssue(input: {
  kind: string | null | undefined;
}) {
  const label = getFinancePrimaryOperationalPositionLabel(input.kind).toLowerCase();
  return `Этап заблокирован: ${label}.`;
}

export function isPrimaryOperationalPositionVisible(
  kind: string | null | undefined,
) {
  if (!kind) {
    return false;
  }

  return !HIDDEN_OPERATIONAL_POSITION_KINDS.has(kind);
}

export function getFinanceDealQueueOptions(): Option[] {
  return FINANCE_DEAL_QUEUE_VALUES.map((value) => ({
    value,
    label: FINANCE_DEAL_QUEUE_LABELS[value],
  }));
}

export function getFinanceDealStageOptions(): Option[] {
  return FINANCE_DEAL_STAGE_VALUES.map((value) => ({
    value,
    label: FINANCE_DEAL_STAGE_LABELS[value],
  }));
}

export function getFinanceDealBlockerStateOptions(): Option[] {
  return FINANCE_DEAL_BLOCKER_STATE_VALUES.map((value) => ({
    value,
    label: FINANCE_DEAL_BLOCKER_STATE_LABELS[value],
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
      : `#${formatCompactId(input.id)}`;

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
