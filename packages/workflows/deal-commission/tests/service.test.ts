import { describe, expect, it, vi } from "vitest";

import {
  calculateCommission,
  createDealCommissionWorkflow,
} from "../src/service";

describe("deal commission workflow", () => {
  it("rounds commission components with half-up monetary policy", () => {
    expect(
      calculateCommission({
        totalWithExpensesInBase: "1000.50",
        costPrice: "100.25",
        subAgentCommissionPercent: 1.25,
        agentFeePercent: 1.25,
      }),
    ).toEqual({
      agentBonus: 11.1,
      costPrice: 100.25,
      dealTotalExpenses: 112.76,
      marginality: 887.74,
      subAgentExpenses: 12.51,
      totalWithExpenses: 1000.5,
    });
  });

  it("persists the exact commission string without float toFixed drift", async () => {
    const setAgentBonus = vi.fn(async () => ({ id: "bonus-1" }));
    const workflow = createDealCommissionWorkflow({
      logger: {
        info: vi.fn(),
      } as any,
      setAgentBonus,
    });

    await workflow.processDealCompletionWithCalculation({
      agentFeePercent: 1.25,
      agentId: "agent-1",
      costPrice: "100.25",
      dealId: "deal-1",
      subAgentCommissionPercent: 1.25,
      totalWithExpensesInBase: "1000.50",
    });

    expect(setAgentBonus).toHaveBeenCalledWith({
      agentId: "agent-1",
      commission: "11.10",
      dealId: "deal-1",
    });
  });
});
