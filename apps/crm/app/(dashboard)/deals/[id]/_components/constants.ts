import type { DealStatus, DealType } from "./types";

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

export const VALID_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  awaiting_funds: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["closing_documents", "cancelled"],
  cancelled: [],
  closing_documents: ["done", "cancelled"],
  done: [],
  draft: ["submitted", "rejected", "cancelled"],
  preparing_documents: ["awaiting_funds", "cancelled"],
  rejected: [],
  submitted: ["preparing_documents", "rejected", "cancelled"],
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
