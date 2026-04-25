import { formatCompactId } from "@bedrock/shared/core/uuid";

const TREASURY_OPERATION_KIND_LABELS = {
  fx_conversion: "Конвертация",
  intercompany_funding: "Межкомпанейское фондирование",
  intracompany_transfer: "Внутренний перевод",
  payin: "Поступление",
  payout: "Выплата",
} as const;

function getTreasuryOperationKindLabel(value: string | null | undefined) {
  if (!value) {
    return "Операция";
  }

  return (
    TREASURY_OPERATION_KIND_LABELS[
      value as keyof typeof TREASURY_OPERATION_KIND_LABELS
    ] ?? value
  );
}

export function getTreasuryOperationDisplayTitle(input: {
  applicantName?: string | null;
  dealId?: string | null;
  id: string;
  kind: string;
}) {
  const label =
    input.applicantName?.trim().length
      ? input.applicantName.trim()
      : `#${formatCompactId(input.dealId ?? input.id)}`;

  return `${getTreasuryOperationKindLabel(input.kind)} • ${label}`;
}
