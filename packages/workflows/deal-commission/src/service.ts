import type { Logger } from "@bedrock/platform/observability/logger";
import {
  formatDecimalString,
  minorToAmountString,
  mulDivRoundHalfUp,
} from "@bedrock/shared/money";

export interface DealCommissionWorkflowDeps {
  setAgentBonus(input: {
    agentId: string;
    commission: string;
    dealId: string;
  }): Promise<{ id: string | number }>;
  logger: Logger;
}

const BPS_SCALE = 10_000n;
const MONEY_SCALE = 2;

function parseMoneyToMinor(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;

  const normalized = formatDecimalString(value, {
    minimumFractionDigits: MONEY_SCALE,
    maximumFractionDigits: MONEY_SCALE,
    groupSeparator: "",
    decimalSeparator: ".",
  });

  return BigInt(normalized.replace(".", ""));
}

function parsePercentToBps(value: number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;

  const normalized = formatDecimalString(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    groupSeparator: "",
    decimalSeparator: ".",
  });

  return BigInt(normalized.replace(".", ""));
}

function minorToNumber(minor: bigint): number {
  return Number(minorToAmountString(minor, { precision: MONEY_SCALE }));
}

function calculateCommissionMinor(input: CommissionCalculationInput) {
  const totalWithExpensesMinor = parseMoneyToMinor(input.totalWithExpensesInBase);
  const costPriceMinor = parseMoneyToMinor(input.costPrice);
  const subAgentBps = parsePercentToBps(input.subAgentCommissionPercent);
  const agentFeeBps = parsePercentToBps(input.agentFeePercent);

  const subAgentExpensesMinor =
    subAgentBps > 0n
      ? mulDivRoundHalfUp(totalWithExpensesMinor, subAgentBps, BPS_SCALE)
      : 0n;
  const dealTotalExpensesMinor = costPriceMinor + subAgentExpensesMinor;
  const marginalityMinor = totalWithExpensesMinor - dealTotalExpensesMinor;
  const agentBonusMinor =
    marginalityMinor > 0n && agentFeeBps > 0n
      ? mulDivRoundHalfUp(marginalityMinor, agentFeeBps, BPS_SCALE)
      : 0n;

  return {
    agentBonusMinor,
    costPriceMinor,
    dealTotalExpensesMinor,
    marginalityMinor,
    subAgentExpensesMinor,
    totalWithExpensesMinor,
  };
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
  const result = calculateCommissionMinor(input);

  return {
    totalWithExpenses: minorToNumber(result.totalWithExpensesMinor),
    costPrice: minorToNumber(result.costPriceMinor),
    subAgentExpenses: minorToNumber(result.subAgentExpensesMinor),
    dealTotalExpenses: minorToNumber(result.dealTotalExpensesMinor),
    marginality: minorToNumber(result.marginalityMinor),
    agentBonus: minorToNumber(result.agentBonusMinor),
  };
}

export function createDealCommissionWorkflow(
  deps: DealCommissionWorkflowDeps,
) {
  return {
    calculateCommission,

    async processDealCompletion(input: {
      dealId: string;
      agentId: string;
      commission: string;
    }) {
      const { dealId, agentId, commission } = input;

      const bonus = await deps.setAgentBonus({
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
      dealId: string;
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
        const result = calculateCommissionMinor(calcInput);
        commission = formatDecimalString(
          minorToAmountString(result.agentBonusMinor, {
            precision: MONEY_SCALE,
          }),
          {
            minimumFractionDigits: MONEY_SCALE,
            maximumFractionDigits: MONEY_SCALE,
            groupSeparator: "",
            decimalSeparator: ".",
          },
        );
      }

      const bonus = await deps.setAgentBonus({
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
