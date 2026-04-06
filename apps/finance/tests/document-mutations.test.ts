import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDealScopedDocumentDraft } from "@/features/operations/documents/lib/mutations";

const fetchMock = vi.fn();

describe("document mutations", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("posts deal-scoped document creates with an idempotency header and input body", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          docNo: "INV-001",
          docType: "invoice",
          id: "00000000-0000-4000-8000-000000000001",
        }),
        {
          headers: {
            "content-type": "application/json",
          },
          status: 201,
        },
      ),
    );

    const result = await createDealScopedDocumentDraft({
      dealId: "00000000-0000-4000-8000-000000000999",
      docType: "invoice",
      payload: {
        memo: "test payload",
      },
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(
      "/v1/deals/00000000-0000-4000-8000-000000000999/formal-documents/invoice",
    );
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers).toMatchObject({
      "Idempotency-Key": expect.stringMatching(/^deals\.docs\.create:/),
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      input: {
        memo: "test payload",
      },
    });
  });
});
