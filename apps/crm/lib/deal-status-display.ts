export type DealStatusDisplayStatus =
  | "draft"
  | "submitted"
  | "rejected"
  | "preparing_documents"
  | "awaiting_funds"
  | "awaiting_payment"
  | "closing_documents"
  | "done"
  | "cancelled";

export const DEAL_STATUS_LABELS: Record<DealStatusDisplayStatus, string> = {
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

export const DEAL_STATUS_COLORS: Record<DealStatusDisplayStatus, string> = {
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

export const DEAL_STATUS_DISPLAY: Record<
  DealStatusDisplayStatus,
  { colorClass: string; label: string }
> = {
  awaiting_funds: {
    colorClass: DEAL_STATUS_COLORS.awaiting_funds,
    label: DEAL_STATUS_LABELS.awaiting_funds,
  },
  awaiting_payment: {
    colorClass: DEAL_STATUS_COLORS.awaiting_payment,
    label: DEAL_STATUS_LABELS.awaiting_payment,
  },
  cancelled: {
    colorClass: DEAL_STATUS_COLORS.cancelled,
    label: DEAL_STATUS_LABELS.cancelled,
  },
  closing_documents: {
    colorClass: DEAL_STATUS_COLORS.closing_documents,
    label: DEAL_STATUS_LABELS.closing_documents,
  },
  done: {
    colorClass: DEAL_STATUS_COLORS.done,
    label: DEAL_STATUS_LABELS.done,
  },
  draft: {
    colorClass: DEAL_STATUS_COLORS.draft,
    label: DEAL_STATUS_LABELS.draft,
  },
  preparing_documents: {
    colorClass: DEAL_STATUS_COLORS.preparing_documents,
    label: DEAL_STATUS_LABELS.preparing_documents,
  },
  rejected: {
    colorClass: DEAL_STATUS_COLORS.rejected,
    label: DEAL_STATUS_LABELS.rejected,
  },
  submitted: {
    colorClass: DEAL_STATUS_COLORS.submitted,
    label: DEAL_STATUS_LABELS.submitted,
  },
};
