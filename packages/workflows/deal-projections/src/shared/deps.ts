import type { AgreementsModule } from "@bedrock/agreements";
import type { CalculationsModule } from "@bedrock/calculations";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DealsModule as DealsModuleRoot } from "@bedrock/deals";
import type { DocumentsReadModel } from "@bedrock/documents/read-model";
import type { FilesModule } from "@bedrock/files";
import type { IamService } from "@bedrock/iam";
import type { PartiesModule as PartiesModuleRoot } from "@bedrock/parties";
import type { ReconciliationService } from "@bedrock/reconciliation";
import type { TreasuryModule } from "@bedrock/treasury";

export interface DealProjectionsWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  calculations: Pick<CalculationsModule, "calculations">;
  currencies: Pick<CurrenciesService, "findById">;
  deals: Pick<DealsModuleRoot, "deals">;
  documentsReadModel: Pick<DocumentsReadModel, "listDealTraceRowsByDealId">;
  files: Pick<FilesModule, "files">;
  iam: {
    queries: Pick<IamService["queries"], "findById">;
  };
  parties: Pick<
    PartiesModuleRoot,
    "counterparties" | "customers" | "organizations" | "requisites"
  >;
  reconciliation: Pick<ReconciliationService, "links">;
  treasury: Pick<TreasuryModule, "paymentSteps" | "quoteExecutions" | "quotes">;
}

export type CalculationDetailsLike = NonNullable<
  Awaited<ReturnType<CalculationsModule["calculations"]["queries"]["findById"]>>
>;
export type CurrencyDetailsLike = Awaited<
  ReturnType<DealProjectionsWorkflowDeps["currencies"]["findById"]>
>;
export type DealListRecord = Awaited<
  ReturnType<DealsModuleRoot["deals"]["queries"]["list"]>
>["data"][number];
export type CustomerListItemLike = Awaited<
  ReturnType<PartiesModuleRoot["customers"]["queries"]["listByIds"]>
>[number];
export type TreasuryQuoteRecord = Awaited<
  ReturnType<TreasuryModule["quotes"]["queries"]["listQuotes"]>
>["data"][number];
export type UserDetailsLike = Awaited<
  ReturnType<DealProjectionsWorkflowDeps["iam"]["queries"]["findById"]>
>;
export type DealAttachmentRecord = Awaited<
  ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
>[number];
