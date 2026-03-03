import { describe, expect, it } from "vitest";

import { buildOptionsResponse } from "../../src/common/options";

describe("buildOptionsResponse", () => {
  it("supports paginated lists", () => {
    const result = buildOptionsResponse(
      {
        data: [{ id: "1", name: "One" }],
      },
      (item) => ({ value: item.id, label: item.name }),
    );

    expect(result).toEqual({
      data: [{ value: "1", label: "One" }],
    });
  });

  it("supports plain arrays", () => {
    const result = buildOptionsResponse([{ id: "2", name: "Two" }], (item) => ({
      value: item.id,
      label: item.name,
    }));

    expect(result).toEqual({
      data: [{ value: "2", label: "Two" }],
    });
  });
});
