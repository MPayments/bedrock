import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { TodoStore } from "../../../todos/application/ports/todo.store";
import type { ApplicationStore } from "./application.store";

export interface ApplicationsCommandTx {
  applicationStore: ApplicationStore;
  todoStore: TodoStore;
}

export type ApplicationsCommandUnitOfWork =
  UnitOfWork<ApplicationsCommandTx>;
