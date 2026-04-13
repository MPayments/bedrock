import { describe, expect, it } from "vitest";

import { DEAL_TIMELINE_EVENT_LABELS } from "./constants";

describe("DEAL_TIMELINE_EVENT_LABELS", () => {
  it("localizes execution workflow timeline events", () => {
    expect(DEAL_TIMELINE_EVENT_LABELS.execution_requested).toBe(
      "Запущено исполнение сделки",
    );
    expect(DEAL_TIMELINE_EVENT_LABELS.instruction_prepared).toBe(
      "Инструкция подготовлена",
    );
    expect(DEAL_TIMELINE_EVENT_LABELS.instruction_submitted).toBe(
      "Инструкция отправлена",
    );
    expect(DEAL_TIMELINE_EVENT_LABELS.instruction_settled).toBe(
      "Инструкция исполнена",
    );
  });
});
