export const TREASURY_ACCOUNT_KIND_LABELS: Record<string, string> = {
  bank: "Банк",
  wallet: "Кошелёк",
  exchange: "Биржа",
  custodial: "Кастодиан",
  virtual: "Виртуальный",
  internal_control: "Внутренний",
};

export const TREASURY_OPERATION_KIND_LABELS: Record<string, string> = {
  collection: "Поступление",
  payout: "Выплата",
  intracompany_transfer: "Внутренний перевод",
  intercompany_funding: "Внутригрупповое финансирование",
  fx_conversion: "Конверсия валюты",
  sweep: "Переброска ликвидности",
  return: "Возврат",
  adjustment: "Корректировка",
};

export const TREASURY_INSTRUCTION_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  approved: "Одобрено",
  reserved: "Зарезервировано",
  submitted: "Отправлено",
  partially_settled: "Частично исполнено",
  settled: "Исполнено",
  failed: "Ошибка",
  returned: "Возврат",
  void: "Аннулировано",
};

export const TREASURY_EVENT_KIND_LABELS: Record<string, string> = {
  submitted: "Отправлено",
  accepted: "Принято",
  settled: "Исполнено",
  failed: "Ошибка",
  returned: "Возврат",
  voided: "Аннулировано",
  fee_charged: "Комиссия списана",
  manual_adjustment: "Ручная корректировка",
};

export const TREASURY_POSITION_KIND_LABELS: Record<string, string> = {
  customer_liability: "Обязательство перед клиентом",
  intercompany_due_from: "Требование к компании группы",
  intercompany_due_to: "Обязательство перед компанией группы",
  in_transit: "В пути",
  suspense: "Невыясненные",
};

export const TREASURY_SETTLEMENT_MODEL_LABELS: Record<string, string> = {
  direct: "Прямой расчет",
  pobo: "Платеж через казначейство",
  robo: "Получение через казначейство",
};

export const BENEFICIAL_OWNER_TYPE_LABELS: Record<string, string> = {
  customer: "Клиент",
  legal_entity: "Юрлицо",
  counterparty: "Контрагент",
};

export const EXECUTION_EVENT_KIND_OPTIONS = [
  "submitted",
  "accepted",
  "settled",
  "failed",
  "returned",
  "voided",
  "fee_charged",
  "manual_adjustment",
] as const;

export function getStatusBadgeVariant(status: string) {
  if (status === "settled") {
    return "default" as const;
  }

  if (
    status === "approved" ||
    status === "reserved" ||
    status === "submitted" ||
    status === "accepted" ||
    status === "partially_settled"
  ) {
    return "secondary" as const;
  }

  if (status === "failed" || status === "returned" || status === "void") {
    return "destructive" as const;
  }

  return "outline" as const;
}
