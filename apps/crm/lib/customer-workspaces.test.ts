import { describe, expect, it, vi } from "vitest";

const workspaceGet = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    v1: {
      customers: {
        ":id": {
          workspace: {
            $get: workspaceGet,
          },
        },
      },
    },
  },
}));

import {
  buildDealDraftCustomerContext,
  requestCustomerWorkspace,
} from "@/lib/customer-workspaces";

describe("customer workspace transport", () => {
  it("loads the CRM customer workspace projection from the canonical API route", async () => {
    workspaceGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        counterparties: [],
        counterpartyCount: 0,
        createdAt: "2026-04-18T08:00:00.000Z",
        description: "Customer workspace",
        externalRef: "C-1",
        hasActiveAgreement: true,
        id: "00000000-0000-4000-8000-000000000101",
        name: "Customer",
        primaryCounterpartyId: null,
        updatedAt: "2026-04-18T08:00:00.000Z",
      }),
    });

    const result = await requestCustomerWorkspace(
      "00000000-0000-4000-8000-000000000101",
    );

    expect(workspaceGet).toHaveBeenCalledWith({
      param: { id: "00000000-0000-4000-8000-000000000101" },
    });
    expect(result).toMatchObject({
      hasActiveAgreement: true,
      id: "00000000-0000-4000-8000-000000000101",
      name: "Customer",
    });
  });

  it("maps workspace counterparties into the deal draft customer context", () => {
    const result = buildDealDraftCustomerContext({
      counterparties: [
        {
          counterpartyId: "00000000-0000-4000-8000-000000000201",
          country: "RU",
          createdAt: "2026-04-18T08:00:00.000Z",
          externalRef: "CP-1",
          fullName: "Customer One LLC",
          inn: "7701234567",
          orgName: "Customer One",
          relationshipKind: "customer_owned",
          shortName: "Customer One",
          subAgent: null,
          subAgentCounterpartyId: null,
          updatedAt: "2026-04-18T08:00:00.000Z",
        },
      ],
      counterpartyCount: 1,
      createdAt: "2026-04-18T08:00:00.000Z",
      description: null,
      externalRef: "C-1",
      hasActiveAgreement: false,
      id: "00000000-0000-4000-8000-000000000101",
      name: "Customer",
      primaryCounterpartyId: "00000000-0000-4000-8000-000000000201",
      updatedAt: "2026-04-18T08:00:00.000Z",
    });

    expect(result).toEqual({
      counterparties: [
        {
          counterpartyId: "00000000-0000-4000-8000-000000000201",
          fullName: "Customer One LLC",
          inn: "7701234567",
          orgName: "Customer One",
          shortName: "Customer One",
        },
      ],
      id: "00000000-0000-4000-8000-000000000101",
      primaryCounterpartyId: "00000000-0000-4000-8000-000000000201",
    });
  });
});
