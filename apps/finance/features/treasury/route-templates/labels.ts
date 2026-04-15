import type { FinanceDealType } from "@/features/treasury/deals/labels";
import { getFinanceDealTypeLabel } from "@/features/treasury/deals/labels";

export const FINANCE_ROUTE_TEMPLATE_STATUS_VALUES = [
  "draft",
  "published",
  "archived",
] as const;

export type FinanceRouteTemplateStatus =
  (typeof FINANCE_ROUTE_TEMPLATE_STATUS_VALUES)[number];

export const ROUTE_TEMPLATE_STATUS_LABELS: Record<
  FinanceRouteTemplateStatus,
  string
> = {
  archived: "В архиве",
  draft: "Черновик",
  published: "Опубликован",
};

export const ROUTE_TEMPLATE_BINDING_LABELS: Record<string, string> = {
  deal_applicant: "Юрлицо клиента из сделки",
  deal_beneficiary: "Получатель из сделки",
  deal_customer: "Клиент сделки",
  deal_payer: "Плательщик из сделки",
  fixed_party: "Фиксированный участник",
};

export const ROUTE_TEMPLATE_BINDING_HINTS: Record<string, string> = {
  deal_applicant:
    "Система подставит applicant counterparty из deal intake.",
  deal_beneficiary:
    "Система подставит beneficiary counterparty из deal intake.",
  deal_customer: "Система подставит customer root сделки.",
  deal_payer: "Система подставит payer counterparty из deal intake.",
  fixed_party: "Выберите конкретную customer / organization / counterparty запись.",
};

export function getRouteTemplateStatusLabel(
  value: FinanceRouteTemplateStatus,
) {
  return ROUTE_TEMPLATE_STATUS_LABELS[value];
}

export function getRouteTemplateStatusVariant(
  value: FinanceRouteTemplateStatus,
): "default" | "destructive" | "outline" | "secondary" {
  switch (value) {
    case "published":
      return "default";
    case "archived":
      return "outline";
    default:
      return "secondary";
  }
}

export function getRouteTemplateBindingLabel(value: string) {
  return ROUTE_TEMPLATE_BINDING_LABELS[value] ?? value;
}

export function getRouteTemplateBindingHint(value: string) {
  return ROUTE_TEMPLATE_BINDING_HINTS[value] ?? "Привязка участника маршрута.";
}

export function getRouteTemplateDisplayTitle(input: {
  dealType: FinanceDealType;
  name: string;
}) {
  return `${input.name} • ${getFinanceDealTypeLabel(input.dealType)}`;
}
