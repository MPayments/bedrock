import type { DocumentModule } from "@bedrock/documents";

import { createAccrualAdjustmentDocumentModule } from "./accrual-adjustment";
import { createCapitalFundingDocumentModule } from "./capital-funding";
import { createClosingReclassDocumentModule } from "./closing-reclass";
import { createEquityContributionDocumentModule } from "./equity-contribution";
import { createEquityDistributionDocumentModule } from "./equity-distribution";
import { createImpairmentAdjustmentDocumentModule } from "./impairment-adjustment";
import { createIntercompanyInterestAccrualDocumentModule } from "./intercompany-interest-accrual";
import { createIntercompanyInterestSettlementDocumentModule } from "./intercompany-interest-settlement";
import { createIntercompanyLoanDrawdownDocumentModule } from "./intercompany-loan-drawdown";
import { createIntercompanyLoanRepaymentDocumentModule } from "./intercompany-loan-repayment";
import type { IfrsModuleDeps } from "./internal/types";
import { createPeriodCloseDocumentModule } from "./period-close";
import { createPeriodReopenDocumentModule } from "./period-reopen";
import { createRevaluationAdjustmentDocumentModule } from "./revaluation-adjustment";
import { createTransferIntercompanyDocumentModule } from "./transfer-intercompany";
import { createTransferIntraDocumentModule } from "./transfer-intra";
import { createTransferResolutionDocumentModule } from "./transfer-resolution";

export const IFRS_DOCUMENT_MODULE_FACTORIES = {
  transfer_intra: createTransferIntraDocumentModule,
  transfer_intercompany: createTransferIntercompanyDocumentModule,
  transfer_resolution: createTransferResolutionDocumentModule,
  capital_funding: createCapitalFundingDocumentModule,
  intercompany_loan_drawdown: createIntercompanyLoanDrawdownDocumentModule,
  intercompany_loan_repayment: createIntercompanyLoanRepaymentDocumentModule,
  intercompany_interest_accrual: createIntercompanyInterestAccrualDocumentModule,
  intercompany_interest_settlement: createIntercompanyInterestSettlementDocumentModule,
  equity_contribution: createEquityContributionDocumentModule,
  equity_distribution: createEquityDistributionDocumentModule,
  accrual_adjustment: createAccrualAdjustmentDocumentModule,
  revaluation_adjustment: createRevaluationAdjustmentDocumentModule,
  impairment_adjustment: createImpairmentAdjustmentDocumentModule,
  closing_reclass: createClosingReclassDocumentModule,
  period_close: () => createPeriodCloseDocumentModule(),
  period_reopen: () => createPeriodReopenDocumentModule(),
} as const satisfies Record<
  string,
  (deps: IfrsModuleDeps) => DocumentModule
>;
