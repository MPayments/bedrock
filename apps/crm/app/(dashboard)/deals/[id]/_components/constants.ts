import type {
  DealLegKind,
  DealLegState,
  DealOperationalPositionKind,
  DealOperationalPositionState,
  DealStatus,
  DealType,
} from "./types";

export const STATUS_LABELS: Record<DealStatus, string> = {
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

export const STATUS_COLORS: Record<DealStatus, string> = {
  awaiting_funds: "bg-orange-100 text-orange-800",
  awaiting_payment: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  closing_documents: "bg-cyan-100 text-cyan-800",
  done: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-100 text-slate-800",
  preparing_documents: "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-800",
  submitted: "bg-sky-100 text-sky-800",
};

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  currency_exchange: "Обмен валюты",
  currency_transit: "Валютный транзит",
  exporter_settlement: "Расчеты с экспортером",
  payment: "Платеж поставщику",
};

export const DEAL_PARTICIPANT_ROLE_LABELS: Record<string, string> = {
  applicant: "контрагент клиента",
  customer: "клиент",
  external_beneficiary: "получатель выплаты",
  external_payer: "плательщик",
  internal_entity: "наша организация",
};

export const FORMAL_DOCUMENT_LABELS: Record<string, string> = {
  exchange: "Документ по обмену валюты",
  fx_execute: "Исполнение конвертации",
  fx_resolution: "Сверка по конвертации",
  invoice: "Исходящий инвойс",
  transfer_intra: "Внутренний перевод",
  transfer_intercompany: "Межкомпанейский перевод",
  transfer_resolution: "Сверка по переводу",
};

export const DEAL_LEG_KIND_LABELS: Record<DealLegKind, string> = {
  collect: "Сбор средств",
  convert: "Конвертация",
  payout: "Выплата",
  settle_exporter: "Расчет с экспортером",
  transit_hold: "Транзитное удержание",
};

export const DEAL_LEG_STATE_LABELS: Record<DealLegState, string> = {
  blocked: "Заблокирован",
  done: "Завершен",
  in_progress: "В работе",
  pending: "Ожидает",
  ready: "Готов",
  skipped: "Пропущен",
};

export const DEAL_LEG_STATE_COLORS: Record<DealLegState, string> = {
  blocked: "bg-red-100 text-red-800",
  done: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-blue-100 text-blue-800",
  pending: "bg-slate-100 text-slate-800",
  ready: "bg-amber-100 text-amber-800",
  skipped: "bg-zinc-100 text-zinc-700",
};

export const DEAL_OPERATIONAL_POSITION_LABELS: Record<
  DealOperationalPositionKind,
  string
> = {
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

export const DEAL_QUOTE_STATUS_LABELS: Record<string, string> = {
  active: "Активна",
  cancelled: "Отменена",
  expired: "Истекла",
  used: "Исполнена",
};

export const DEAL_OPERATIONAL_POSITION_STATE_LABELS: Record<
  DealOperationalPositionState,
  string
> = {
  blocked: "Заблокирована",
  done: "Закрыта",
  in_progress: "В работе",
  not_applicable: "Не применяется",
  pending: "Ожидает",
  ready: "Готова",
};

export const DEAL_OPERATIONAL_POSITION_STATE_COLORS: Record<
  DealOperationalPositionState,
  string
> = {
  blocked: "bg-red-100 text-red-800",
  done: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-blue-100 text-blue-800",
  not_applicable: "bg-zinc-100 text-zinc-700",
  pending: "bg-slate-100 text-slate-800",
  ready: "bg-amber-100 text-amber-800",
};

export const DEAL_SECTION_LABELS: Record<string, string> = {
  common: "Общие данные",
  externalBeneficiary: "Получатель выплаты",
  incomingReceipt: "Входящее поступление",
  moneyRequest: "Сумма и валюта",
  settlementDestination: "Куда зачислить средства",
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
  "Update execution leg state": "Обновить этап исполнения",
};

const DEAL_MESSAGE_LABELS: Record<string, string> = {
  "A calculation derived from the accepted quote is required":
    "Нужно создать расчет по принятой котировке.",
  "An accepted quote is required for convert deals":
    "Для сделки с конвертацией нужна принятая котировка.",
  "Applicant requisite is required": "Выберите реквизиты контрагента.",
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
  "Required intake sections are incomplete": "Анкета заполнена не полностью.",
  "Settlement mode is required": "Укажите, куда зачислить средства.",
  "Source amount is required": "Укажите сумму сделки.",
  "Source currency is required": "Укажите валюту сделки.",
  "The accepted quote is no longer executable":
    "Принятая котировка больше не действует.",
};

export const DEAL_TIMELINE_EVENT_LABELS: Record<string, string> = {
  attachment_deleted: "Вложение удалено",
  attachment_ingested: "Файл распознан",
  attachment_ingestion_failed: "Ошибка распознавания файла",
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

export const ATTACHMENT_PURPOSE_LABELS: Record<
  "contract" | "invoice" | "other",
  string
> = {
  contract: "Договор",
  invoice: "Инвойс",
  other: "Другое",
};

export const ATTACHMENT_VISIBILITY_LABELS: Record<
  "customer_safe" | "internal",
  string
> = {
  customer_safe: "Видно клиенту и CRM",
  internal: "Только CRM / внутреннее",
};

export const ATTACHMENT_INGESTION_STATUS_LABELS = {
  applied: "Данные учтены",
  failed: "Не удалось обработать",
  pending: "Ожидает распознавания",
  processing: "Распознается",
  processed_without_changes: "Распознано, без изменений",
  unavailable: "Обработка недоступна",
} as const;

const WARNING_DEAL_WORKFLOW_MESSAGES = new Set<string>([
  "Applicant requisite is required",
  "Beneficiary bank instructions are required",
  "Contract number is required",
  "Expected amount is required",
  "Expected currency is required",
  "External beneficiary is required",
  "External payer is required",
  "Invoice number is required",
  "Manual settlement bank instructions are required",
  "Required intake sections are incomplete",
  "Settlement mode is required",
  "Source amount is required",
  "Source currency is required",
]);

function formatFallbackLabel(value: string) {
  return value.split("_").filter(Boolean).join(" ");
}

export function formatDealNextAction(nextAction: string | null) {
  if (!nextAction) {
    return "Действие не определено";
  }

  return DEAL_NEXT_ACTION_LABELS[nextAction] ?? nextAction;
}

export function formatDealWorkflowMessage(message: string) {
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

  const approvalPendingMatch = message.match(
    /^Approval is still pending: (.+)$/,
  );
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
      DEAL_OPERATIONAL_POSITION_LABELS[kind as DealOperationalPositionKind] ??
      formatFallbackLabel(kind);

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
    const stage =
      documentMatch[1] === "Opening" ? "Открывающий" : "Закрывающий";
    const status = documentMatch[2];
    const docType = documentMatch[3] ?? "";
    const documentLabel =
      FORMAL_DOCUMENT_LABELS[docType] ?? formatFallbackLabel(docType);

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
    const legLabel =
      DEAL_LEG_KIND_LABELS[kind as DealLegKind] ?? formatFallbackLabel(kind);

    if (state === "blocked") {
      return `Этап исполнения заблокирован: ${legLabel}.`;
    }

    if (state === "not ready") {
      return `Этап исполнения еще не готов: ${legLabel}.`;
    }

    return `Этап исполнения еще не завершен: ${legLabel}.`;
  }

  const transitionMatch = message.match(
    /^Cannot transition from ([a-z_]+) to ([a-z_]+)$/,
  );
  if (transitionMatch) {
    const from = transitionMatch[1] ?? "";
    const to = transitionMatch[2] ?? "";

    return `Нельзя перевести сделку из статуса "${
      STATUS_LABELS[from as DealStatus] ?? formatFallbackLabel(from)
    }" в статус "${
      STATUS_LABELS[to as DealStatus] ?? formatFallbackLabel(to)
    }".`;
  }

  return message;
}

export function getDealWorkflowMessageTone(
  message: string,
): "default" | "warning" {
  if (WARNING_DEAL_WORKFLOW_MESSAGES.has(message)) {
    return "warning";
  }

  if (/^Required participant is unresolved: ([a-z_]+)$/u.test(message)) {
    return "warning";
  }

  return "default";
}

export const DOCUMENT_SUBMISSION_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  submitted: "Отправлен",
};

export const DOCUMENT_APPROVAL_STATUS_LABELS: Record<string, string> = {
  approved: "Согласован",
  not_required: "Не требуется",
  pending: "На согласовании",
  rejected: "Отклонен",
};

export const DOCUMENT_POSTING_STATUS_LABELS: Record<string, string> = {
  not_required: "Не требуется",
  posted: "Проведен",
  ready: "Готов к проведению",
  skipped: "Пропущен",
};
