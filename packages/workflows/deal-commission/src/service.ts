import type { OperationsModule } from "@bedrock/operations";
import type { Logger } from "@bedrock/platform/observability/logger";

export interface DealCommissionWorkflowDeps {
  operations: Pick<OperationsModule, "deals">;
  logger: Logger;
}

function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  return Number.isFinite(n) ? n : 0;
}

export interface CommissionCalculationInput {
  totalWithExpensesInBase: string;
  costPrice?: string | null;
  subAgentCommissionPercent?: number | null;
  agentFeePercent?: number | null;
}

export interface CommissionCalculationResult {
  totalWithExpenses: number;
  costPrice: number;
  subAgentExpenses: number;
  dealTotalExpenses: number;
  marginality: number;
  agentBonus: number;
}

export function calculateCommission(
  input: CommissionCalculationInput,
): CommissionCalculationResult {
  const totalWithExpenses = parseNumber(input.totalWithExpensesInBase);
  const costPrice = parseNumber(input.costPrice);

  let subAgentExpenses = 0;
  if (
    input.subAgentCommissionPercent != null &&
    input.subAgentCommissionPercent > 0
  ) {
    subAgentExpenses =
      totalWithExpenses * (input.subAgentCommissionPercent / 100);
  }

  const dealTotalExpenses = costPrice + subAgentExpenses;
  const marginality = totalWithExpenses - dealTotalExpenses;

  let agentBonus = 0;
  if (marginality > 0 && input.agentFeePercent != null) {
    agentBonus = marginality * (input.agentFeePercent / 100);
  }

  return {
    totalWithExpenses,
    costPrice,
    subAgentExpenses,
    dealTotalExpenses,
    marginality,
    agentBonus,
  };
}

export function createDealCommissionWorkflow(
  deps: DealCommissionWorkflowDeps,
) {
  return {
    calculateCommission,

    async processDealCompletion(input: {
      dealId: number;
      agentId: string;
      commission: string;
    }) {
      const { dealId, agentId, commission } = input;

      const bonus = await deps.operations.deals.commands.setAgentBonus({
        dealId,
        agentId,
        commission,
      });

      deps.logger.info("Deal commission processed", {
        dealId,
        agentId,
        commission,
        bonusId: bonus.id,
      });

      return bonus;
    },

    async processDealCompletionWithCalculation(input: {
      dealId: number;
      agentId: string;
      totalWithExpensesInBase: string;
      costPrice?: string | null;
      subAgentCommissionPercent?: number | null;
      agentFeePercent?: number | null;
      explicitCommission?: string | null;
    }) {
      const { dealId, agentId, explicitCommission, ...calcInput } = input;

      let commission: string;

      if (explicitCommission != null) {
        commission = explicitCommission;
      } else {
        const result = calculateCommission(calcInput);
        commission = result.agentBonus.toFixed(2);
      }

      const bonus = await deps.operations.deals.commands.setAgentBonus({
        dealId,
        agentId,
        commission,
      });

      deps.logger.info("Deal commission calculated and set", {
        dealId,
        agentId,
        commission,
        bonusId: bonus.id,
      });

      return bonus;
    },
  };
}

export type DealCommissionWorkflow = ReturnType<
  typeof createDealCommissionWorkflow
>;
