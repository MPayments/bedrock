import type { Transaction } from "@bedrock/platform/persistence";

import type {
  CounterpartyGroup,
  ListCounterpartyGroupsQuery,
} from "../../contracts";
import type { CounterpartyGroupSnapshot } from "../../domain/counterparty-group";
import type { GroupHierarchyNodeSnapshot } from "../../domain/group-hierarchy";

export interface CounterpartyGroupsQueryRepository {
  listCounterpartyGroups: (input: ListCounterpartyGroupsQuery) => Promise<CounterpartyGroup[]>;
}

export interface CounterpartyGroupsCommandRepository {
  findCounterpartyGroupSnapshotById: (
    id: string,
    tx?: Transaction,
  ) => Promise<CounterpartyGroupSnapshot | null>;
  insertCounterpartyGroup: (group: CounterpartyGroupSnapshot) => Promise<CounterpartyGroupSnapshot>;
  updateCounterpartyGroup: (group: CounterpartyGroupSnapshot) => Promise<CounterpartyGroupSnapshot | null>;
  listGroupHierarchyNodes: (tx?: Transaction) => Promise<GroupHierarchyNodeSnapshot[]>;
  reparentCounterpartyChildrenTx: (
    tx: Transaction,
    input: {
      id: string;
      parentId: string | null;
    },
  ) => Promise<void>;
  removeCounterpartyGroupTx: (tx: Transaction, id: string) => Promise<boolean>;
}
