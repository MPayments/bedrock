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

export interface CounterpartiesMutationRepository {
  removeCounterparty: (id: string) => Promise<boolean>;
}

export interface CounterpartiesCommandTxRepository {
  findCounterpartySnapshotById: (
    id: string,
  ) => Promise<CounterpartySnapshot | null>;
  insertCounterparty: (
    counterparty: CounterpartySnapshot,
  ) => Promise<CounterpartySnapshot>;
  updateCounterparty: (
    counterparty: CounterpartySnapshot,
  ) => Promise<CounterpartySnapshot | null>;
  replaceMemberships: (
    counterpartyId: string,
    groupIds: string[],
  ) => Promise<void>;
  listGroupHierarchyNodes: () => Promise<GroupHierarchyNodeSnapshot[]>;
}
