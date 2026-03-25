import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { TodoStore } from "./todo.store";

export interface TodosCommandTx {
  todoStore: TodoStore;
}

export type TodosCommandUnitOfWork = UnitOfWork<TodosCommandTx>;
