import { accrualAdjustmentDocumentDefinition } from "./accrual-adjustment";
import { capitalFundingDocumentDefinition } from "./capital-funding";
import { closingReclassDocumentDefinition } from "./closing-reclass";
import { equityContributionDocumentDefinition } from "./equity-contribution";
import { equityDistributionDocumentDefinition } from "./equity-distribution";
import { fxExecuteDocumentDefinition } from "./fx-execute";
import { fxResolutionDocumentDefinition } from "./fx-resolution";
import { impairmentAdjustmentDocumentDefinition } from "./impairment-adjustment";
import { intercompanyInterestAccrualDocumentDefinition } from "./intercompany-interest-accrual";
import { intercompanyInterestSettlementDocumentDefinition } from "./intercompany-interest-settlement";
import { intercompanyLoanDrawdownDocumentDefinition } from "./intercompany-loan-drawdown";
import { intercompanyLoanRepaymentDocumentDefinition } from "./intercompany-loan-repayment";
import { periodCloseDocumentDefinition } from "./period-close";
import { periodReopenDocumentDefinition } from "./period-reopen";
import { revaluationAdjustmentDocumentDefinition } from "./revaluation-adjustment";
import { transferIntercompanyDocumentDefinition } from "./transfer-intercompany";
import { transferIntraDocumentDefinition } from "./transfer-intra";
import { transferResolutionDocumentDefinition } from "./transfer-resolution";

export const IFRS_DOCUMENT_CATALOG = [
  transferIntraDocumentDefinition,
  transferIntercompanyDocumentDefinition,
  transferResolutionDocumentDefinition,
  fxExecuteDocumentDefinition,
  fxResolutionDocumentDefinition,
  capitalFundingDocumentDefinition,
  intercompanyLoanDrawdownDocumentDefinition,
  intercompanyLoanRepaymentDocumentDefinition,
  intercompanyInterestAccrualDocumentDefinition,
  intercompanyInterestSettlementDocumentDefinition,
  equityContributionDocumentDefinition,
  equityDistributionDocumentDefinition,
  accrualAdjustmentDocumentDefinition,
  revaluationAdjustmentDocumentDefinition,
  impairmentAdjustmentDocumentDefinition,
  closingReclassDocumentDefinition,
  periodCloseDocumentDefinition,
  periodReopenDocumentDefinition,
] as const;
