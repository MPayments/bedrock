import { defineProvider, type Provider } from "@bedrock/core";
import { DbToken } from "@multihansa/common/bedrock";
import { createAccountingRuntime } from "./runtime";
import {
  listCorrespondenceRules,
  listTemplateAccounts,
  replaceCorrespondenceRules,
  validatePostingMatrix,
} from "./runtime-service";

import {
  AccountingDomainServiceToken,
  AccountingPackDefinitionToken,
} from "./tokens";

export function createAccountingProviders(): Provider[] {
  return [
    defineProvider({
      provide: AccountingDomainServiceToken,
      scope: "singleton",
      deps: {
        db: DbToken,
        defaultPackDefinition: AccountingPackDefinitionToken,
      },
      useFactory: ({ db, defaultPackDefinition }) => {
        const runtime = createAccountingRuntime({
          db,
          defaultPackDefinition,
        });

        return {
          ...runtime,
          listTemplateAccounts: () => listTemplateAccounts(db),
          listCorrespondenceRules: () => listCorrespondenceRules(db),
          replaceCorrespondenceRules: (input: Parameters<
            typeof replaceCorrespondenceRules
          >[1]) => replaceCorrespondenceRules(db, input),
          validatePostingMatrix: () => validatePostingMatrix(db),
        };
      },
    }),
  ];
}
