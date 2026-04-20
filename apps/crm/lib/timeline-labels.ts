import type { ApiDealTimelineEvent } from "@/app/(dashboard)/deals/[id]/_components/types";

type TimelineEventType = ApiDealTimelineEvent["type"];

export const KEY_DATE_LABELS: Partial<Record<TimelineEventType, string>> = {
  deal_created: "CREATED",
  quote_created: "QUOTED",
  quote_accepted: "ACCEPTED",
  calculation_attached: "CALC LOCKED",
  execution_requested: "EXECUTION",
  deal_closed: "SETTLED",
};

export const KEY_DATE_ORDER: TimelineEventType[] = [
  "deal_created",
  "quote_created",
  "quote_accepted",
  "calculation_attached",
  "execution_requested",
  "deal_closed",
];

export const ACTIVITY_EVENT_LABELS: Record<TimelineEventType, string> = {
  deal_created: "Создал сделку",
  intake_saved: "Обновил параметры сделки",
  participant_changed: "Изменил участников",
  status_changed: "Сменил статус",
  leg_state_changed: "Обновил статус шага",
  execution_requested: "Запросил исполнение",
  leg_operation_created: "Создал операцию для шага",
  instruction_prepared: "Подготовил платёжное поручение",
  instruction_submitted: "Отправил платёжное поручение",
  instruction_settled: "Поручение исполнено",
  instruction_failed: "Ошибка исполнения поручения",
  instruction_retried: "Повторная отправка поручения",
  instruction_voided: "Отменил поручение",
  return_requested: "Запросил возврат",
  instruction_returned: "Платёж возвращён",
  deal_closed: "Закрыл сделку",
  quote_created: "Сформировал индикативное предложение",
  quote_accepted: "Клиент принял предложение",
  quote_expired: "Срок действия котировки истёк",
  quote_used: "Котировка использована",
  calculation_attached: "Зафиксировал калькуляцию",
  attachment_uploaded: "Загрузил документ",
  attachment_deleted: "Удалил документ",
  attachment_ingested: "Проанализировал документ",
  attachment_ingestion_failed: "Ошибка анализа документа",
  document_created: "Создал официальный документ",
  document_status_changed: "Обновил статус документа",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

export function formatKeyDate(date: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!Number.isFinite(d.getTime())) return "—";
  return dateFormatter.format(d).replace(/,?\s?(\d{2}:\d{2})$/, " · $1");
}

export function findFirstEventOfType(
  timeline: ApiDealTimelineEvent[],
  type: TimelineEventType,
): ApiDealTimelineEvent | null {
  return timeline.find((event) => event.type === type) ?? null;
}
