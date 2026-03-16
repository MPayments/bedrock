import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiRequestError, readJsonWithSchema, requestOk } from "@/lib/api/response";

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

describe("api response helpers", () => {
  it("parses response bodies with a schema", async () => {
    const response = createResponse({
      ok: true,
      status: 200,
      payload: { data: [{ id: "1" }] },
    });

    const schema = z.object({
      data: z.array(z.object({ id: z.string() })),
    });

    await expect(readJsonWithSchema(response, schema)).resolves.toEqual({
      data: [{ id: "1" }],
    });
  });

  it("normalizes api errors into ApiRequestError", async () => {
    const response = createResponse({
      ok: false,
      status: 403,
      payload: { error: "Forbidden" },
    });

    await expect(requestOk(response, "fallback")).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
});
