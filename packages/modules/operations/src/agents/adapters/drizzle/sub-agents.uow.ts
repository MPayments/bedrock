import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import type {
  SubAgentsCommandTx,
  SubAgentsCommandUnitOfWork,
} from "../../application/ports/sub-agents.uow";
import { DrizzleSubAgentStore } from "./sub-agent.store";

function bindSubAgentsTx(tx: Transaction): SubAgentsCommandTx {
  return {
    subAgentStore: new DrizzleSubAgentStore(tx),
  };
}

export class DrizzleSubAgentsUnitOfWork implements SubAgentsCommandUnitOfWork {
  private readonly transactional: TransactionalPort<SubAgentsCommandTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindSubAgentsTx,
    );
  }

  run<T>(work: (tx: SubAgentsCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
