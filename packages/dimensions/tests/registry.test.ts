import { describe, expect, it, vi } from "vitest";

import { createDimensionRegistry } from "../src/index";

describe("dimension registry", () => {
  it("batch resolves labels and caches negative results", async () => {
    const resolver = vi.fn(async ({ values }: { values: string[] }) => {
      const map = new Map<string, string>();
      if (values.includes("known")) {
        map.set("known", "Known");
      }
      return map;
    });

    const registry = createDimensionRegistry([
      {
        key: "customerId",
        resolveLabels: resolver,
      },
    ]);

    const db = {} as never;

    const first = await registry.resolveLabels({
      db,
      valuesByKey: {
        customerId: ["known", "missing"],
      },
    });
    const second = await registry.resolveLabels({
      db,
      valuesByKey: {
        customerId: ["known", "missing"],
      },
    });

    expect(first).toEqual({
      customerId: {
        known: "Known",
      },
    });
    expect(second).toEqual(first);
    expect(resolver).toHaveBeenCalledTimes(1);
  });
});
