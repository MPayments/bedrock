import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateAgreementCommand } from "./commands/create-agreement";
import type { AgreementReads } from "./ports/agreement.reads";
import type { AgreementsCommandUnitOfWork } from "./ports/agreements.uow";
import type { AgreementReferencesPort } from "./ports/references.port";
import { FindAgreementByIdQuery } from "./queries/find-agreement-by-id";
import { ListAgreementsQuery } from "./queries/list-agreements";

export interface AgreementsServiceDeps {
  commandUow: AgreementsCommandUnitOfWork;
  idempotency: IdempotencyPort;
  reads: AgreementReads;
  references: AgreementReferencesPort;
  runtime: ModuleRuntime;
}

export function createAgreementsService(deps: AgreementsServiceDeps) {
  const createAgreement = new CreateAgreementCommand(
    deps.runtime,
    deps.commandUow,
    deps.idempotency,
    deps.references,
  );
  const findAgreementById = new FindAgreementByIdQuery(deps.reads);
  const listAgreements = new ListAgreementsQuery(deps.reads);

  return {
    commands: {
      create: createAgreement.execute.bind(createAgreement),
    },
    queries: {
      findById: findAgreementById.execute.bind(findAgreementById),
      list: listAgreements.execute.bind(listAgreements),
    },
  };
}

export type AgreementsService = ReturnType<typeof createAgreementsService>;
