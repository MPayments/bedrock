import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchRequisiteOptions } from "@bedrock/sdk-documents-form-ui/lib/account-options";

describe("document account options", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts requisites list payloads where bank identity fields are omitted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              ownerType: "organization",
              ownerId: "22222222-2222-4222-8222-222222222222",
              currencyId: "33333333-3333-4333-8333-333333333333",
              providerId: "44444444-4444-4444-8444-444444444444",
              label: "Main RUB",
            },
          ],
          total: 1,
          limit: 100,
          offset: 0,
        }),
      })),
    );

    await expect(
      fetchRequisiteOptions({
        ownerId: "22222222-2222-4222-8222-222222222222",
        ownerType: "organization",
        currencyId: "33333333-3333-4333-8333-333333333333",
        currencyLabelById: new Map([
          ["33333333-3333-4333-8333-333333333333", "RUB"],
        ]),
      }),
    ).resolves.toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        currencyId: "33333333-3333-4333-8333-333333333333",
        label: "Main RUB · RUB",
      },
    ]);
  });
});
