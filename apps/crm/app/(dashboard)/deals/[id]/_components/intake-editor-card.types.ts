import type {
  CrmApplicantRequisiteOption,
  CrmCurrencyOption,
  CrmCustomerLegalEntityOption,
  CrmDealIntakeDraft,
} from "../../_components/deal-intake-form";
import type { ApiDealSectionCompleteness } from "./types";

export type IntakeEditorCardProps = {
  applicantRequisites: CrmApplicantRequisiteOption[];
  currencyOptions: CrmCurrencyOption[];
  intake: CrmDealIntakeDraft;
  isDirty: boolean;
  isSaving: boolean;
  legalEntities: CrmCustomerLegalEntityOption[];
  onChange: (next: CrmDealIntakeDraft) => void;
  onReset: () => void;
  onSave: () => void;
  readOnly: boolean;
  sectionCompleteness: ApiDealSectionCompleteness[];
};
