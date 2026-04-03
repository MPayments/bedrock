import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleAgentProfileStore } from "./agent-profile.store";
import { DrizzleCredentialAccountStore } from "./credential-account.store";
import { DrizzleUserAccountRepository } from "./user-account.repository";
import { DrizzleUserSessionsStore } from "./user-sessions.store";
import type {
  IamUsersCommandTx,
  IamUsersCommandUnitOfWork,
} from "../../application/users/ports";

function bindIamUsersTx(tx: Transaction): IamUsersCommandTx {
  return {
    users: new DrizzleUserAccountRepository(tx),
    credentials: new DrizzleCredentialAccountStore(tx),
    sessions: new DrizzleUserSessionsStore(tx),
    agentProfiles: new DrizzleAgentProfileStore(tx),
  };
}

export class DrizzleIamUsersUnitOfWork implements IamUsersCommandUnitOfWork {
  private readonly transactional: TransactionalPort<IamUsersCommandTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindIamUsersTx,
    );
  }

  run<T>(work: (tx: IamUsersCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
