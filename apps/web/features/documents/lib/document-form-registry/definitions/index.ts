import type { DocumentFormDefinition } from "../types";
import { createAccrualAdjustmentDefinition } from "./accrual-adjustment";
import { createCapitalFundingDefinition } from "./capital-funding";
import { createClosingReclassDefinition } from "./closing-reclass";
import { createEquityContributionDefinition } from "./equity-contribution";
import { createEquityDistributionDefinition } from "./equity-distribution";
import { createImpairmentAdjustmentDefinition } from "./impairment-adjustment";
import { createIntercompanyInterestAccrualDefinition } from "./intercompany-interest-accrual";
import { createIntercompanyInterestSettlementDefinition } from "./intercompany-interest-settlement";
import { createIntercompanyLoanDrawdownDefinition } from "./intercompany-loan-drawdown";
import { createIntercompanyLoanRepaymentDefinition } from "./intercompany-loan-repayment";
import { createPeriodReopenDefinition } from "./period-reopen";
import { createRevaluationAdjustmentDefinition } from "./revaluation-adjustment";
import { createTransferIntercompanyDefinition } from "./transfer-intercompany";
import { createTransferIntraDefinition } from "./transfer-intra";
import { createTransferResolutionDefinition } from "./transfer-resolution";

export const DOCUMENT_FORM_DEFINITIONS: DocumentFormDefinition[] = [
  createTransferIntraDefinition(),
  createTransferIntercompanyDefinition(),
  createTransferResolutionDefinition(),
  createCapitalFundingDefinition(),
  createIntercompanyLoanDrawdownDefinition(),
  createIntercompanyLoanRepaymentDefinition(),
  createIntercompanyInterestAccrualDefinition(),
  createIntercompanyInterestSettlementDefinition(),
  createEquityContributionDefinition(),
  createEquityDistributionDefinition(),
  createAccrualAdjustmentDefinition(),
  createRevaluationAdjustmentDefinition(),
  createImpairmentAdjustmentDefinition(),
  createClosingReclassDefinition(),
  createPeriodReopenDefinition(),
];
