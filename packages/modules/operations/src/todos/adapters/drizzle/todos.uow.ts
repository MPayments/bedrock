import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import type {
  TodosCommandTx,
  TodosCommandUnitOfWork,
} from "../../application/ports/todos.uow";
import { DrizzleTodoStore } from "./todo.store";

function bindTodosTx(tx: Transaction): TodosCommandTx {
  return {
    todoStore: new DrizzleTodoStore(tx),
  };
}

export class DrizzleTodosUnitOfWork implements TodosCommandUnitOfWork {
  private readonly transactional: TransactionalPort<TodosCommandTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindTodosTx,
    );
  }

  run<T>(work: (tx: TodosCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
