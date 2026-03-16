import type { Transaction } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  Customer,
  ListCustomersQuery,
} from "../../contracts";
import type { CustomerSnapshot } from "../../domain/customer";
import type { GroupHierarchyNodeSnapshot } from "../../domain/group-hierarchy";

export interface CustomersQueryRepository {
  findCustomerById: (id: string) => Promise<Customer | null>;
  listCustomers: (input: ListCustomersQuery) => Promise<PaginatedList<Customer>>;
  listCustomerDisplayNamesById: (ids: string[]) => Promise<Map<string, string>>;
}

export interface CustomersCommandRepository {
  findCustomerSnapshotById: (id: string, tx?: Transaction) => Promise<CustomerSnapshot | null>;
  insertCustomerTx: (
    tx: Transaction,
    customer: CustomerSnapshot,
  ) => Promise<CustomerSnapshot>;
  updateCustomerTx: (
    tx: Transaction,
    customer: CustomerSnapshot,
  ) => Promise<CustomerSnapshot | null>;
  removeCustomerTx: (tx: Transaction, id: string) => Promise<boolean>;
  listExistingCustomerIds: (ids: string[], tx?: Transaction) => Promise<string[]>;
  findManagedCustomerGroup: (
    customerId: string,
    tx?: Transaction,
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
  listCounterpartiesByCustomerId: (customerId: string, tx?: Transaction) => Promise<{ id: string }[]>;
  listGroupHierarchyNodes: (tx?: Transaction) => Promise<GroupHierarchyNodeSnapshot[]>;
  listMembershipRowsByCounterpartyIds: (
    counterpartyIds: string[],
    tx?: Transaction,
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
}
