import { describe, expect, it } from "vitest";

import { aggregateOrganizationRequisiteLiquidityRows } from "../src/balances/adapters/drizzle/balance-reporting.repository";

describe("organization requisite liquidity aggregation", () => {
  it("aggregates multiple books into one requisite and currency row", () => {
    const rows = aggregateOrganizationRequisiteLiquidityRows([
      {
        organizationId: "org-1",
        requisiteId: "req-1",
        currency: "USD",
        ledgerBalanceMinor: "1000",
        availableMinor: "700",
        reservedMinor: "200",
        pendingMinor: "100",
      },
      {
        organizationId: "org-1",
        requisiteId: "req-1",
        currency: "USD",
        ledgerBalanceMinor: "500",
        availableMinor: "300",
        reservedMinor: "100",
        pendingMinor: "100",
      },
      {
        organizationId: "org-2",
        requisiteId: "req-2",
        currency: "EUR",
        ledgerBalanceMinor: "900",
        availableMinor: "900",
        reservedMinor: "0",
        pendingMinor: "0",
      },
    ]);

    expect(rows).toEqual([
      {
        organizationId: "org-1",
        requisiteId: "req-1",
        currency: "USD",
        ledgerBalanceMinor: "1500",
        availableMinor: "1000",
        reservedMinor: "300",
        pendingMinor: "200",
      },
      {
        organizationId: "org-2",
        requisiteId: "req-2",
        currency: "EUR",
        ledgerBalanceMinor: "900",
        availableMinor: "900",
        reservedMinor: "0",
        pendingMinor: "0",
      },
    ]);
  });
});
