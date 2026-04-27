import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DealTimelineCard } from "@/features/treasury/deals/components/deal-timeline-card";

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

describe("treasury deal timeline card", () => {
  it("renders execution events with leg context", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(DealTimelineCard, {
        executionPlan: [
          {
            actions: {
              canCreateLegOperation: false,
              exchangeDocument: null,
            },
            fromCurrencyId: null,
            id: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
            idx: 1,
            kind: "collect",
            routeSnapshotLegId: null,
            runtimeState: "ready",
            toCurrencyId: null,
          },
        ],
        timeline: [
          {
            actor: {
              label: "alexey",
            },
            id: "event-1",
            occurredAt: "2026-04-13T10:10:00.000Z",
            payload: {
              operationCount: 1,
            },
            type: "execution_requested",
          },
          {
            actor: null,
            id: "event-2",
            occurredAt: "2026-04-13T10:11:00.000Z",
            payload: {
              attempt: 2,
              legId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              operationId: "operation-1",
            },
            type: "instruction_submitted",
          },
        ],
      }),
    );

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Запущено исполнение сделки");
    expect(normalizedMarkup).toContain("Подготовлено операций: 1 · alexey");
    expect(normalizedMarkup).toContain("Сбор средств: инструкция отправлена");
    expect(normalizedMarkup).toContain("Попытка 2");
  });
});
