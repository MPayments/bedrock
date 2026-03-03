import { accrualAdjustmentDocumentTypeOption } from "./accrual-adjustment";
import { capitalFundingDocumentTypeOption } from "./capital-funding";
import { closingReclassDocumentTypeOption } from "./closing-reclass";
import { equityContributionDocumentTypeOption } from "./equity-contribution";
import { equityDistributionDocumentTypeOption } from "./equity-distribution";
import { impairmentAdjustmentDocumentTypeOption } from "./impairment-adjustment";
import { intercompanyInterestAccrualDocumentTypeOption } from "./intercompany-interest-accrual";
import { intercompanyInterestSettlementDocumentTypeOption } from "./intercompany-interest-settlement";
import { intercompanyLoanDrawdownDocumentTypeOption } from "./intercompany-loan-drawdown";
import { intercompanyLoanRepaymentDocumentTypeOption } from "./intercompany-loan-repayment";
import { periodCloseDocumentTypeOption } from "./period-close";
import { periodReopenDocumentTypeOption } from "./period-reopen";
import { revaluationAdjustmentDocumentTypeOption } from "./revaluation-adjustment";
import { transferIntercompanyDocumentTypeOption } from "./transfer-intercompany";
import { transferIntraDocumentTypeOption } from "./transfer-intra";
import { transferResolutionDocumentTypeOption } from "./transfer-resolution";

export const IFRS_DOCUMENT_TYPE_OPTIONS = [
  transferIntraDocumentTypeOption,
  transferIntercompanyDocumentTypeOption,
  transferResolutionDocumentTypeOption,
  capitalFundingDocumentTypeOption,
  intercompanyLoanDrawdownDocumentTypeOption,
  intercompanyLoanRepaymentDocumentTypeOption,
  intercompanyInterestAccrualDocumentTypeOption,
  intercompanyInterestSettlementDocumentTypeOption,
  equityContributionDocumentTypeOption,
  equityDistributionDocumentTypeOption,
  accrualAdjustmentDocumentTypeOption,
  revaluationAdjustmentDocumentTypeOption,
  impairmentAdjustmentDocumentTypeOption,
  closingReclassDocumentTypeOption,
  periodCloseDocumentTypeOption,
  periodReopenDocumentTypeOption,
] as const;
