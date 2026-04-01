import type {
  DealCapabilityKind,
  DealCapabilityStatus,
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
  currency_exchange: "Конверсия",
  currency_transit: "Транзит",
  exporter_settlement: "Расчеты экспортера",
  payment: "Платеж",
};

export const FORMAL_DOCUMENT_LABELS: Record<string, string> = {
  exchange: "Коммерческий документ",
  fx_execute: "FX Execute",
  fx_resolution: "FX Resolution",
  invoice: "Инвойс",
  transfer_intra: "Внутренний перевод",
  transfer_intercompany: "Межкомпанейский перевод",
  transfer_resolution: "Transfer Resolution",
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

export const DEAL_CAPABILITY_LABELS: Record<DealCapabilityKind, string> = {
  can_collect: "Сбор средств",
  can_exporter_settle: "Расчеты экспортера",
  can_fx: "FX",
  can_payout: "Выплата",
  can_transit: "Транзит",
};

export const DEAL_CAPABILITY_STATUS_LABELS: Record<DealCapabilityStatus, string> = {
  disabled: "Выключена",
  enabled: "Включена",
  pending: "Ожидает настройки",
};

export const DEAL_CAPABILITY_STATUS_COLORS: Record<DealCapabilityStatus, string> = {
  disabled: "bg-red-100 text-red-800",
  enabled: "bg-emerald-100 text-emerald-800",
  pending: "bg-slate-100 text-slate-800",
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
  externalBeneficiary: "Внешний получатель",
  incomingReceipt: "Ожидаемое поступление",
  moneyRequest: "Денежный запрос",
  settlementDestination: "Назначение расчета",
};

export const DEAL_TIMELINE_EVENT_LABELS: Record<string, string> = {
  attachment_deleted: "Вложение удалено",
  attachment_uploaded: "Вложение загружено",
  calculation_attached: "Расчет привязан",
  deal_created: "Сделка создана",
  document_created: "Документ создан",
  document_status_changed: "Статус документа изменен",
  intake_saved: "Интейк сохранен",
  leg_state_changed: "Состояние этапа изменено",
  participant_changed: "Участники изменены",
  quote_accepted: "Котировка принята",
  quote_created: "Котировка создана",
  quote_expired: "Котировка истекла",
  quote_used: "Котировка исполнена",
  status_changed: "Статус сделки изменен",
};
