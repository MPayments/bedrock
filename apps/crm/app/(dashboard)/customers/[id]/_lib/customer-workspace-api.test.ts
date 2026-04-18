import { describe, expect, it, vi } from "vitest";

const requestCustomerWorkspace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/customer-workspaces", () => ({
  requestCustomerWorkspace,
}));

import { getCustomerWorkspace } from "./customer-workspace-api";

describe("customer workspace api", () => {
  it("hydrates customer detail from the single workspace projection route", async () => {
    requestCustomerWorkspace.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000101",
      name: "Customer",
    });

    const result = await getCustomerWorkspace(
      "00000000-0000-4000-8000-000000000101",
    );

    expect(requestCustomerWorkspace).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000101",
    );
    expect(result).toEqual({
      id: "00000000-0000-4000-8000-000000000101",
      name: "Customer",
    });
  });
});
