import { describe, expect, it } from "vitest";

import { listAvailableWorkerIds, parseSelectedWorkerIds } from "../src/selection";

describe("worker selection", () => {
  it("returns undefined when no ids are provided", () => {
    expect(parseSelectedWorkerIds([])).toBeUndefined();
  });

  it("returns undefined when all is requested", () => {
    expect(parseSelectedWorkerIds(["all"])).toBeUndefined();
  });

  it("parses comma-delimited worker ids", () => {
    expect(parseSelectedWorkerIds(["ledger,fx-rates"])).toEqual([
      "ledger",
      "fx-rates",
    ]);
  });

  it("deduplicates requested worker ids", () => {
    expect(parseSelectedWorkerIds(["ledger", "ledger"])).toEqual(["ledger"]);
  });

  it("throws on unknown worker ids", () => {
    expect(() => parseSelectedWorkerIds(["not-a-worker"])).toThrow(
      /Unknown worker ids/,
    );
  });

  it("lists available worker ids", () => {
    expect(listAvailableWorkerIds()).toEqual(
      expect.arrayContaining([
        "ledger",
        "documents",
        "documents-period-close",
        "balances",
        "fx-rates",
        "reconciliation",
      ]),
    );
  });
});
