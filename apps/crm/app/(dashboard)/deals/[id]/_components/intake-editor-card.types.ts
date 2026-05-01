import type {
  CrmApplicantRequisiteOption,
  CrmCurrencyOption,
  CrmCustomerCounterpartyOption,
  CrmDealIntakeDraft,
} from "../../_components/deal-intake-form";
import type {
  ApiAttachment,
  ApiDealAttachmentIngestion,
  ApiDealSectionCompleteness,
} from "./types";

export type IntakeEditorCardProps = {
  applicantRequisites: CrmApplicantRequisiteOption[];
  attachments: ApiAttachment[];
  attachmentIngestions: ApiDealAttachmentIngestion[];
  currencyOptions: CrmCurrencyOption[];
  intake: CrmDealIntakeDraft;
  isDirty: boolean;
  isSaving: boolean;
  counterparties: CrmCustomerCounterpartyOption[];
  deletingAttachmentId: string | null;
  reingestingAttachmentId: string | null;
  onChange: (next: CrmDealIntakeDraft) => void;
  onReset: () => void;
  onSave: () => void;
  onAttachmentDelete: (attachmentId: string) => void;
  onAttachmentDownload: (attachmentId: string) => void;
  onAttachmentReingest: (attachmentId: string) => void;
  onAttachmentUpload: () => void;
  readOnly: boolean;
  sectionCompleteness: ApiDealSectionCompleteness[];
};
