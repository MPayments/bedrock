import type { DocumentModule } from "@bedrock/core/documents";

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
import { createPeriodCloseDocumentModule } from "./period-close";
import { createPeriodReopenDocumentModule } from "./period-reopen";
import { createRevaluationAdjustmentDocumentModule } from "./revaluation-adjustment";
import { createTransferIntercompanyDocumentModule } from "./transfer-intercompany";
import { createTransferIntraDocumentModule } from "./transfer-intra";
import { createTransferResolutionDocumentModule } from "./transfer-resolution";
import type { IfrsModuleDeps } from "./internal/types";

export function createIfrsDocumentModules(deps: IfrsModuleDeps): DocumentModule[] {
  return [
    createTransferIntraDocumentModule(deps),
    createTransferIntercompanyDocumentModule(deps),
    createTransferResolutionDocumentModule(deps),
    createCapitalFundingDocumentModule(deps),
    createIntercompanyLoanDrawdownDocumentModule(),
    createIntercompanyLoanRepaymentDocumentModule(),
    createIntercompanyInterestAccrualDocumentModule(),
    createIntercompanyInterestSettlementDocumentModule(),
    createEquityContributionDocumentModule(),
    createEquityDistributionDocumentModule(),
    createAccrualAdjustmentDocumentModule(),
    createRevaluationAdjustmentDocumentModule(),
    createImpairmentAdjustmentDocumentModule(),
    createClosingReclassDocumentModule(),
    createPeriodCloseDocumentModule(),
    createPeriodReopenDocumentModule(),
  ];
}
