import type { CustomerStore } from "./customer.store";
import type { CounterpartyGroupHierarchyReads } from "../../../counterparties/application/ports/counterparty-group-hierarchy.reads";
import type { CounterpartyGroupRepository } from "../../../counterparties/application/ports/counterparty-group.repository";
import type { CounterpartyRepository } from "../../../counterparties/application/ports/counterparty.repository";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface CustomersCommandTx {
  customerStore: CustomerStore;
  counterparties: Pick<CounterpartyRepository, "findByCustomerId" | "save">;
  counterpartyGroupHierarchy: CounterpartyGroupHierarchyReads;
  counterpartyGroups: CounterpartyGroupRepository;
}

export type CustomersCommandUnitOfWork = UnitOfWork<CustomersCommandTx>;
