import { eq } from "drizzle-orm";

import { defineProvider, LoggerToken, type Provider } from "@bedrock/core";
import {
  adaptBedrockLogger,
  DbToken,
} from "@multihansa/common/bedrock";
import { AccountingDomainServiceToken } from "@multihansa/accounting";
import {
  LedgerEngineToken,
  LedgerReadServiceToken,
} from "@multihansa/ledger";
import { schema } from "@multihansa/documents/schema";

import { createCreateDraftHandler } from "./commands/create-draft";
import { createTransitionHandler } from "./commands/transition";
import { createUpdateDraftHandler } from "./commands/update-draft";
import { createValidateAccountingSourceCoverageHandler } from "./commands/validate-accounting-source-coverage";
import { createDocumentsServiceContext } from "./internal/context";
import { createGetDocumentDetailsQuery } from "./queries/get-document-details";
import { createGetDocumentQuery } from "./queries/get-document";
import { createListDocumentsQuery } from "./queries/list-documents";
import {
  DocumentRegistryToken,
  DocumentsDomainServiceToken,
} from "./tokens";

export function createDocumentsProviders(): Provider[] {
  return [
    defineProvider({
      provide: DocumentsDomainServiceToken,
      scope: "singleton",
      deps: {
        accounting: AccountingDomainServiceToken,
        db: DbToken,
        ledger: LedgerEngineToken,
        ledgerReadService: LedgerReadServiceToken,
        logger: LoggerToken,
        registry: DocumentRegistryToken,
      },
      useFactory: ({
        accounting,
        db,
        ledger,
        ledgerReadService,
        logger,
        registry,
      }) => {
        const context = createDocumentsServiceContext({
          accounting,
          db,
          ledger,
          ledgerReadService,
          logger: adaptBedrockLogger(logger),
          registry,
        });

        return {
          list: createListDocumentsQuery(context),
          get: createGetDocumentQuery(context),
          getDetails: createGetDocumentDetailsQuery(context),
          createDraft: createCreateDraftHandler(context),
          updateDraft: createUpdateDraftHandler(context),
          transition: createTransitionHandler(context),
          validateAccountingSourceCoverage:
            createValidateAccountingSourceCoverageHandler(context),
          async hasDocument(documentId: string) {
            const [document] = await context.db
              .select({ id: schema.documents.id })
              .from(schema.documents)
              .where(eq(schema.documents.id, documentId))
              .limit(1);

            return document !== undefined;
          },
        };
      },
    }),
  ];
}
