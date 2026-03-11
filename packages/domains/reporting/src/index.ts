export { createIfrsDocumentsWorkerModule } from "./worker";
export {
  AccountingReportingDomainServiceToken,
  DimensionRegistryToken,
} from "./tokens";
export { reportingModule } from "./module";
export { accountingReportsModule } from "./accounting-reporting/module";
export { documentsJournalModule } from "./documents-journal/module";
export * as accountingReporting from "./accounting-reporting/index";
export * as ifrsDocuments from "./ifrs-documents/index";
