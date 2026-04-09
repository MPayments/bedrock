import type {
  CrmApplicantRequisiteOption,
  CrmCurrencyOption,
  CrmCustomerCounterpartyOption,
  CrmDealIntakeDraft,
} from "../../_components/deal-intake-form";
import type { ApiDealSectionCompleteness } from "./types";

export type IntakeEditorCardProps = {
  applicantRequisites: CrmApplicantRequisiteOption[];
  currencyOptions: CrmCurrencyOption[];
  intake: CrmDealIntakeDraft;
  isDirty: boolean;
  isSaving: boolean;
  counterparties: CrmCustomerCounterpartyOption[];
  onChange: (next: CrmDealIntakeDraft) => void;
  onReset: () => void;
  onSave: () => void;
  readOnly: boolean;
  sectionCompleteness: ApiDealSectionCompleteness[];
};
