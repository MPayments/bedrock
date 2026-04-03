import { describe, expect, it } from "vitest";

import {
  formatCapabilityIssue,
  formatDealNextAction,
  formatDealWorkflowMessage,
  getDealCapabilityLabel,
  getDealTimelineEventLabel,
  getFinanceDealDisplayTitle,
  getFinanceDealQueueLabel,
  getFinanceDealStatusLabel,
  getFinanceDealTypeLabel,
  isPrimaryOperationalPositionVisible,
} from "@/features/treasury/deals/labels";

describe("treasury deal labels", () => {
  it("matches CRM wording for deal statuses and types", () => {
    expect(getFinanceDealStatusLabel("closing_documents")).toBe(
      "Закрывающие документы",
    );
    expect(getFinanceDealStatusLabel("awaiting_funds")).toBe(
      "Ожидание средств",
    );
    expect(getFinanceDealTypeLabel("payment")).toBe("Платеж поставщику");
    expect(getFinanceDealTypeLabel("currency_exchange")).toBe(
      "Обмен валюты",
    );
  });

  it("uses Russian wording for queues and derived labels", () => {
    expect(getFinanceDealQueueLabel("funding")).toBe("Фондирование");
    expect(getFinanceDealQueueLabel("failed_instruction")).toBe(
      "Блокеры исполнения",
    );
    expect(getDealCapabilityLabel("can_fx")).toBe("Конвертация");
    expect(getDealTimelineEventLabel("quote_used")).toBe(
      "Котировка исполнена",
    );
  });

  it("localizes next actions and workflow messages", () => {
    expect(formatDealNextAction("Create calculation from accepted quote")).toBe(
      "Создать расчет по принятой котировке",
    );
    expect(formatDealWorkflowMessage("Required intake sections are incomplete")).toBe(
      "Анкета заполнена не полностью.",
    );
    expect(
      formatDealWorkflowMessage(
        "Required participant is unresolved: external_beneficiary",
      ),
    ).toBe("Не заполнен обязательный участник: получатель выплаты.");
  });

  it("formats finance-only blockers without raw technical codes", () => {
    expect(
      formatCapabilityIssue({
        kind: "can_payout",
        status: "pending",
      }),
    ).toBe("Нужно настроить: выплата.");
    expect(isPrimaryOperationalPositionVisible("provider_payable")).toBe(true);
    expect(isPrimaryOperationalPositionVisible("spread_revenue")).toBe(false);
  });

  it("uses compact uppercase ids when applicant name is unavailable", () => {
    expect(
      getFinanceDealDisplayTitle({
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        type: "payment",
      }),
    ).toBe("Платеж поставщику • #614FB6EB");
  });
});
