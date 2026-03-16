import type {
  CounterpartyGroup,
  ListCounterpartyGroupsQuery,
} from "../../contracts";
import type { CounterpartyGroupSnapshot } from "../../domain/counterparty-group";
import type { GroupHierarchyNodeSnapshot } from "../../domain/group-hierarchy";

export interface CounterpartyGroupsQueryRepository {
  listCounterpartyGroups: (input: ListCounterpartyGroupsQuery) => Promise<CounterpartyGroup[]>;
}

export interface CounterpartyGroupsMutableRepository {
  findCounterpartyGroupSnapshotById: (
    id: string,
  ) => Promise<CounterpartyGroupSnapshot | null>;
  insertCounterpartyGroup: (
    group: CounterpartyGroupSnapshot,
  ) => Promise<CounterpartyGroupSnapshot>;
  updateCounterpartyGroup: (
    group: CounterpartyGroupSnapshot,
  ) => Promise<CounterpartyGroupSnapshot | null>;
  listGroupHierarchyNodes: () => Promise<GroupHierarchyNodeSnapshot[]>;
}

export interface CounterpartyGroupsCommandTxRepository {
  findCounterpartyGroupSnapshotById: (
    id: string,
  ) => Promise<CounterpartyGroupSnapshot | null>;
  reparentCounterpartyChildren: (input: {
    id: string;
    parentId: string | null;
  }) => Promise<void>;
  removeCounterpartyGroup: (id: string) => Promise<boolean>;
}
