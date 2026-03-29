import type { UnitOfWork } from "../../../shared/application/unit-of-work";
import type { TodoStore } from "../../../todos/application/ports/todo.store";
import type { ClientStore } from "../../../clients/application/ports/client.store";
import type { ApplicationStore } from "./application.store";

export interface ApplicationsCommandTx {
  applicationStore: ApplicationStore;
  clientStore: Pick<ClientStore, "findActiveByCounterpartyId">;
  todoStore: TodoStore;
}

export type ApplicationsCommandUnitOfWork =
  UnitOfWork<ApplicationsCommandTx>;
