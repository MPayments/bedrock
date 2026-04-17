import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { readEntityById } from "@/lib/api/query";

function createResponse({
  ok,
  status,
  payload,
}: {
  ok: boolean;
  status: number;
  payload: unknown;
}) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

describe("readEntityById", () => {
  it("accepts UUID v5 identifiers and performs the request", async () => {
    const request = vi.fn(async () =>
      createResponse({
        ok: true,
        status: 200,
        payload: { id: "fa172c66-3a29-530e-a70a-9bcb5faa315b" },
      }),
    );

    await expect(
      readEntityById({
        id: "fa172c66-3a29-530e-a70a-9bcb5faa315b",
        request,
        schema: z.object({ id: z.string() }),
        resourceName: "ресурс",
      }),
    ).resolves.toEqual({
      id: "fa172c66-3a29-530e-a70a-9bcb5faa315b",
    });

    expect(request).toHaveBeenCalledWith("fa172c66-3a29-530e-a70a-9bcb5faa315b");
  });
});
