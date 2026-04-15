import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";

import { ArchiveAgreementCommand } from "./commands/archive-agreement";
import { CreateAgreementCommand } from "./commands/create-agreement";
import { UpdateAgreementCommand } from "./commands/update-agreement";
import type { AgreementReads } from "./ports/agreement.reads";
import type { AgreementsCommandUnitOfWork } from "./ports/agreements.uow";
import type { AgreementReferencesPort } from "./ports/references.port";
import { FindActiveAgreementByCustomerIdQuery } from "./queries/find-active-agreement-by-customer-id";
import { FindAgreementByIdQuery } from "./queries/find-agreement-by-id";
import { ListAgreementsQuery } from "./queries/list-agreements";
import { ResolveAgreementRouteDefaultsQueryHandler } from "./queries/resolve-agreement-route-defaults";

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
  const updateAgreement = new UpdateAgreementCommand(
    deps.runtime,
    deps.commandUow,
    deps.idempotency,
    deps.references,
  );
  const archiveAgreement = new ArchiveAgreementCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findActiveAgreementByCustomerId = new FindActiveAgreementByCustomerIdQuery(
    deps.reads,
  );
  const findAgreementById = new FindAgreementByIdQuery(deps.reads);
  const listAgreements = new ListAgreementsQuery(deps.reads);
  const resolveAgreementRouteDefaults = new ResolveAgreementRouteDefaultsQueryHandler(
    deps.reads,
  );

  return {
    commands: {
      archive: archiveAgreement.execute.bind(archiveAgreement),
      create: createAgreement.execute.bind(createAgreement),
      update: updateAgreement.execute.bind(updateAgreement),
    },
    queries: {
      findActiveByCustomerId: findActiveAgreementByCustomerId.execute.bind(
        findActiveAgreementByCustomerId,
      ),
      findById: findAgreementById.execute.bind(findAgreementById),
      list: listAgreements.execute.bind(listAgreements),
      resolveRouteDefaults:
        resolveAgreementRouteDefaults.execute.bind(
          resolveAgreementRouteDefaults,
        ),
    },
  };
}

export type AgreementsService = ReturnType<typeof createAgreementsService>;
