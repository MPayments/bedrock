import { capitalFundingDocumentTypeOption } from "./capital-funding";
import { periodCloseDocumentTypeOption } from "./period-close";
import { periodReopenDocumentTypeOption } from "./period-reopen";
import { transferIntercompanyDocumentTypeOption } from "./transfer-intercompany";
import { transferIntraDocumentTypeOption } from "./transfer-intra";
import { transferResolutionDocumentTypeOption } from "./transfer-resolution";

export const IFRS_DOCUMENT_TYPE_OPTIONS = [
  transferIntraDocumentTypeOption,
  transferIntercompanyDocumentTypeOption,
  transferResolutionDocumentTypeOption,
  capitalFundingDocumentTypeOption,
  periodCloseDocumentTypeOption,
  periodReopenDocumentTypeOption,
] as const;
