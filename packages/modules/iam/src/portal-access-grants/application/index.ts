import { ConsumePortalAccessGrantCommand } from "./commands/consume-portal-access-grant";
import { CreatePortalAccessGrantCommand } from "./commands/create-portal-access-grant";
import { RevokePortalAccessGrantCommand } from "./commands/revoke-portal-access-grant";
import type { PortalAccessGrantReads } from "./ports/portal-access-grant.reads";
import type { PortalAccessGrantsUnitOfWork } from "./ports/portal-access-grants.uow";
import { GetPortalAccessGrantByUserIdQuery } from "./queries/get-portal-access-grant-by-user-id";
import { HasPendingPortalAccessGrantQuery } from "./queries/has-pending-portal-access-grant";

export interface PortalAccessGrantsServiceDeps {
  commandUow: PortalAccessGrantsUnitOfWork;
  reads: PortalAccessGrantReads;
}

export function createPortalAccessGrantsService(
  deps: PortalAccessGrantsServiceDeps,
) {
  const createPortalAccessGrant = new CreatePortalAccessGrantCommand(
    deps.commandUow,
  );
  const consumePortalAccessGrant = new ConsumePortalAccessGrantCommand(
    deps.commandUow,
  );
  const revokePortalAccessGrant = new RevokePortalAccessGrantCommand(
    deps.commandUow,
  );
  const getPortalAccessGrantByUserId = new GetPortalAccessGrantByUserIdQuery(
    deps.reads,
  );
  const hasPendingPortalAccessGrant = new HasPendingPortalAccessGrantQuery(
    deps.reads,
  );

  return {
    commands: {
      consume: consumePortalAccessGrant.execute.bind(consumePortalAccessGrant),
      create: createPortalAccessGrant.execute.bind(createPortalAccessGrant),
      revoke: revokePortalAccessGrant.execute.bind(revokePortalAccessGrant),
    },
    queries: {
      findByUserId: getPortalAccessGrantByUserId.execute.bind(
        getPortalAccessGrantByUserId,
      ),
      hasPendingGrant: hasPendingPortalAccessGrant.execute.bind(
        hasPendingPortalAccessGrant,
      ),
    },
  };
}

export type PortalAccessGrantsService = ReturnType<
  typeof createPortalAccessGrantsService
>;
