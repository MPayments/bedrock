import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DealTimelineCard } from "./deal-timeline-card";
import type { ApiCrmDealWorkbenchProjection } from "./types";

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

describe("DealTimelineCard", () => {
  it("renders execution events with leg context", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(DealTimelineCard, {
        workbench: {
          executionPlan: [
            {
              id: "leg-1",
              idx: 1,
              kind: "collect",
              operationRefs: [
                {
                  kind: "payin",
                  operationId: "operation-1",
                  sourceRef: "deal:1:collect",
                },
              ],
              state: "ready",
            },
          ],
          timeline: [
            {
              actor: {
                label: "alexey",
                userId: "alexey",
              },
              id: "event-1",
              occurredAt: "2026-04-13T10:10:00.000Z",
              payload: {
                operationCount: 1,
              },
              type: "execution_requested",
              visibility: "internal",
            },
            {
              actor: null,
              id: "event-2",
              occurredAt: "2026-04-13T10:11:00.000Z",
              payload: {
                attempt: 2,
                operationId: "operation-1",
              },
              type: "instruction_submitted",
              visibility: "internal",
            },
          ],
        } as unknown as ApiCrmDealWorkbenchProjection,
      }),
    );

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Запущено исполнение сделки");
    expect(normalizedMarkup).toContain("Подготовлено операций: 1 · alexey");
    expect(normalizedMarkup).toContain("Сбор средств: инструкция отправлена");
    expect(normalizedMarkup).toContain("Попытка 2");
  });
});
