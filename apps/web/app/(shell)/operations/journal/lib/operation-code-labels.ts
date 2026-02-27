const OPERATION_CODE_LABELS: Record<string, string> = {
  TRANSFER_APPROVE_IMMEDIATE_INTRA: "Подтверждение перевода (внутри организации, сразу)",
  TRANSFER_APPROVE_PENDING_INTRA: "Подтверждение перевода (внутри организации, с удержанием)",
  TRANSFER_APPROVE_IMMEDIATE_CROSS: "Подтверждение перевода между организациями (сразу)",
  TRANSFER_APPROVE_PENDING_CROSS: "Подтверждение перевода между организациями (с удержанием)",
  TRANSFER_SETTLE_PENDING: "Проведение удержанного перевода",
  TRANSFER_VOID_PENDING: "Отмена удержанного перевода",
  TREASURY_FUNDING_SETTLED: "Зачисление фондирования",
  TREASURY_FX_EXECUTED: "Исполнение FX-сделки",
  TREASURY_PAYOUT_INIT: "Инициация выплаты",
  TREASURY_PAYOUT_SETTLE: "Проведение выплаты",
  TREASURY_PAYOUT_VOID: "Отмена выплаты",
  TREASURY_FEE_PAYMENT_INIT: "Инициация выплаты комиссии",
  TREASURY_FEE_PAYMENT_SETTLE: "Проведение выплаты комиссии",
  TREASURY_FEE_PAYMENT_VOID: "Отмена выплаты комиссии",
};

export function getOperationCodeLabel(operationCode: string): string {
  return OPERATION_CODE_LABELS[operationCode] ?? operationCode;
}
