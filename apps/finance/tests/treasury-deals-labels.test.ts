import { describe, expect, it } from "vitest";

import {
  getDealCapabilityLabel,
  getDealTimelineEventLabel,
  getFinanceDealQueueLabel,
  getFinanceDealStatusLabel,
  getFinanceDealTypeLabel,
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
});

