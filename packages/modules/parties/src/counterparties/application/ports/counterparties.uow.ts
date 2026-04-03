import type { CounterpartyGroupHierarchyReads } from "./counterparty-group-hierarchy.reads";
import type { CounterpartyGroupRepository } from "./counterparty-group.repository";
import type { CounterpartyRepository } from "./counterparty.repository";
import type { CustomerStore } from "../../../customers/application/ports/customer.store";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface CounterpartiesCommandTx {
  customerStore: Pick<CustomerStore, "findById">;
  counterparties: CounterpartyRepository;
  counterpartyGroupHierarchy: CounterpartyGroupHierarchyReads;
  counterpartyGroups: CounterpartyGroupRepository;
}

export type CounterpartiesCommandUnitOfWork =
  UnitOfWork<CounterpartiesCommandTx>;
