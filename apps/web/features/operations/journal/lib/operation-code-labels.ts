const OPERATION_CODE_LABELS: Record<string, string> = {
  TRANSFER_APPROVE_IMMEDIATE_INTRA: "Подтверждение перевода (внутри организации, сразу)",
  TRANSFER_APPROVE_PENDING_INTRA: "Подтверждение перевода (внутри организации, с удержанием)",
  TRANSFER_APPROVE_IMMEDIATE_CROSS: "Подтверждение перевода между организациями (сразу)",
  TRANSFER_APPROVE_PENDING_CROSS: "Подтверждение перевода между организациями (с удержанием)",
  TRANSFER_SETTLE_PENDING: "Проведение удержанного перевода",
  TRANSFER_VOID_PENDING: "Отмена удержанного перевода",
  TREASURY_FX_EXECUTE_IMMEDIATE: "Казначейский FX (сразу)",
  TREASURY_FX_EXECUTE_PENDING: "Казначейский FX (с удержанием)",
  TREASURY_FX_SETTLE_PENDING: "Проведение удержанного казначейского FX",
  TREASURY_FX_VOID_PENDING: "Отмена удержанного казначейского FX",
  TREASURY_FUNDING_SETTLED: "Зачисление фондирования",
  TREASURY_EXTERNAL_FUNDING: "Внешнее пополнение / ввод остатка",
  TREASURY_FX_EXECUTED: "Исполнение FX-сделки",
  TREASURY_PAYOUT_INIT: "Инициация выплаты",
  TREASURY_PAYOUT_SETTLE: "Проведение выплаты",
  TREASURY_PAYOUT_VOID: "Отмена выплаты",
  TREASURY_FEE_PAYMENT_INIT: "Инициация выплаты комиссии",
  TREASURY_FEE_PAYMENT_SETTLE: "Проведение выплаты комиссии",
  TREASURY_FEE_PAYMENT_VOID: "Отмена выплаты комиссии",
  COMMERCIAL_INCOMING_INVOICE_OPEN: "Открытие входящего invoice",
  COMMERCIAL_PAYMENT_ORDER_INITIATE: "Инициация платежного поручения",
  COMMERCIAL_PAYMENT_ORDER_SETTLE: "Исполнение платежного поручения",
  COMMERCIAL_PAYMENT_ORDER_VOID: "Отмена платежного поручения",
  COMMERCIAL_OUTGOING_INVOICE_OPEN: "Открытие исходящего invoice",
};

export function getOperationCodeLabel(operationCode: string): string {
  return OPERATION_CODE_LABELS[operationCode] ?? operationCode;
}
