import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  Counterparty,
  CounterpartyGroup,
  CreateCounterpartyInput,
  CreateCounterpartyGroupInput,
  CreateCustomerInput,
  Customer,
  ListCounterpartiesQuery,
  ListCounterpartyGroupsQuery,
  ListCustomersQuery,
  UpdateCounterpartyGroupInput,
  UpdateCounterpartyInput,
  UpdateCustomerInput,
} from "../contracts";
import type { GroupNode } from "../domain/group-rules";

export interface PartiesDocumentsReadPort {
  hasDocumentsForCustomer: (
    customerId: string,
    queryable?: Queryable,
  ) => Promise<boolean>;
}

export type StoredCounterparty = Omit<Counterparty, "groupIds">;
export type StoredCounterpartyGroup = Omit<CounterpartyGroup, "customerLabel">;

export interface PartiesRepository {
  findCustomerById: (
    id: string,
    queryable?: Queryable,
  ) => Promise<Customer | null>;
  listCustomers: (
    input: ListCustomersQuery,
    queryable?: Queryable,
  ) => Promise<PaginatedList<Customer>>;
  insertCustomerTx: (
    tx: Transaction,
    input: CreateCustomerInput,
  ) => Promise<Customer>;
  updateCustomerTx: (
    tx: Transaction,
    id: string,
    input: UpdateCustomerInput,
  ) => Promise<Customer | null>;
  removeCustomerTx: (tx: Transaction, id: string) => Promise<boolean>;
  listCustomerDisplayNamesById: (
    ids: string[],
    queryable?: Queryable,
  ) => Promise<Map<string, string>>;
  listExistingCustomerIds: (
    ids: string[],
    queryable?: Queryable,
  ) => Promise<string[]>;

  findManagedCustomerGroup: (
    customerId: string,
    queryable?: Queryable,
  ) => Promise<{ id: string; name: string } | null>;
  ensureManagedCustomerGroupTx: (
    tx: Transaction,
    input: {
      customerId: string;
      displayName: string;
    },
  ) => Promise<{ id: string }>;
  renameManagedCustomerGroupTx: (
    tx: Transaction,
    input: {
      customerId: string;
      displayName: string;
    },
  ) => Promise<void>;
  listCounterpartiesByCustomerId: (
    customerId: string,
    queryable?: Queryable,
  ) => Promise<{ id: string }[]>;
  listGroupNodes: (queryable?: Queryable) => Promise<GroupNode[]>;
  listMembershipRowsByCounterpartyIds: (
    counterpartyIds: string[],
    queryable?: Queryable,
  ) => Promise<
    {
      counterpartyId: string;
      groupId: string;
    }[]
  >;
  deleteMembershipsByCounterpartyAndGroupIdsTx: (
    tx: Transaction,
    input: {
      counterpartyIds: string[];
      groupIds: string[];
    },
  ) => Promise<void>;
  clearCounterpartyCustomerLinkTx: (
    tx: Transaction,
    counterpartyIds: string[],
  ) => Promise<void>;
  deleteCounterpartyGroupsByIdsTx: (
    tx: Transaction,
    groupIds: string[],
  ) => Promise<void>;

  findCounterpartyById: (
    id: string,
    queryable?: Queryable,
  ) => Promise<Counterparty | null>;
  listCounterparties: (
    input: ListCounterpartiesQuery,
    queryable?: Queryable,
  ) => Promise<PaginatedList<Counterparty>>;
  insertCounterpartyTx: (
    tx: Transaction,
    input: Omit<CreateCounterpartyInput, "groupIds"> & { customerId: string | null },
  ) => Promise<StoredCounterparty>;
  updateCounterpartyTx: (
    tx: Transaction,
    id: string,
    input: Partial<Omit<StoredCounterparty, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<StoredCounterparty | null>;
  removeCounterparty: (id: string) => Promise<boolean>;
  readMembershipIds: (
    counterpartyId: string,
    queryable?: Queryable,
  ) => Promise<string[]>;
  readMembershipMap: (
    counterpartyIds: string[],
    queryable?: Queryable,
  ) => Promise<Map<string, string[]>>;
  replaceMembershipsTx: (
    tx: Transaction,
    counterpartyId: string,
    groupIds: string[],
  ) => Promise<void>;
  listCounterpartyShortNamesById: (
    ids: string[],
    queryable?: Queryable,
  ) => Promise<Map<string, string>>;
  listGroupMembers: (
    input: {
      groupIds: string[];
      includeDescendants: boolean;
    },
    queryable?: Queryable,
  ) => Promise<
    {
      rootGroupId: string;
      counterpartyId: string;
    }[]
  >;

  listCounterpartyGroups: (
    input: ListCounterpartyGroupsQuery,
    queryable?: Queryable,
  ) => Promise<CounterpartyGroup[]>;
  findCounterpartyGroupById: (
    id: string,
    queryable?: Queryable,
  ) => Promise<StoredCounterpartyGroup | null>;
  insertCounterpartyGroup: (
    input: {
      code: string;
      name: string;
      description: string | null;
      parentId: string | null;
      customerId: string | null;
      isSystem: boolean;
    },
    queryable?: Queryable,
  ) => Promise<StoredCounterpartyGroup>;
  updateCounterpartyGroup: (
    id: string,
    input: {
      code?: string;
      name?: string;
      description?: string | null;
      parentId?: string | null;
      customerId?: string | null;
    },
    queryable?: Queryable,
  ) => Promise<StoredCounterpartyGroup | null>;
  reparentCounterpartyChildrenTx: (
    tx: Transaction,
    input: {
      id: string;
      parentId: string | null;
    },
  ) => Promise<void>;
  removeCounterpartyGroupTx: (
    tx: Transaction,
    id: string,
  ) => Promise<boolean>;
}
