import type { Transaction } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  Counterparty,
  ListCounterpartiesQuery,
} from "../../contracts";
import type { CounterpartySnapshot } from "../../domain/counterparty";
import type { GroupHierarchyNodeSnapshot } from "../../domain/group-hierarchy";

export interface CounterpartiesQueryRepository {
  findCounterpartyById: (id: string) => Promise<Counterparty | null>;
  listCounterparties: (
    input: ListCounterpartiesQuery,
  ) => Promise<PaginatedList<Counterparty>>;
  listCounterpartyShortNamesById: (ids: string[]) => Promise<Map<string, string>>;
  listGroupMembers: (
    input: {
      groupIds: string[];
      includeDescendants: boolean;
    },
  ) => Promise<
    {
      rootGroupId: string;
      counterpartyId: string;
    }[]
  >;
}

export interface CounterpartiesCommandRepository {
  findCounterpartySnapshotById: (
    id: string,
    tx?: Transaction,
  ) => Promise<CounterpartySnapshot | null>;
  insertCounterpartyTx: (
    tx: Transaction,
    counterparty: CounterpartySnapshot,
  ) => Promise<CounterpartySnapshot>;
  updateCounterpartyTx: (
    tx: Transaction,
    counterparty: CounterpartySnapshot,
  ) => Promise<CounterpartySnapshot | null>;
  removeCounterparty: (id: string) => Promise<boolean>;
  replaceMembershipsTx: (
    tx: Transaction,
    counterpartyId: string,
    groupIds: string[],
  ) => Promise<void>;
  listGroupHierarchyNodes: (tx?: Transaction) => Promise<GroupHierarchyNodeSnapshot[]>;
}
