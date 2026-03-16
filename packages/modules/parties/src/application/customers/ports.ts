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

export interface CustomersCommandTxRepository {
  findCustomerSnapshotById: (id: string) => Promise<CustomerSnapshot | null>;
  insertCustomer: (customer: CustomerSnapshot) => Promise<CustomerSnapshot>;
  updateCustomer: (customer: CustomerSnapshot) => Promise<CustomerSnapshot | null>;
  removeCustomer: (id: string) => Promise<boolean>;
  listExistingCustomerIds: (ids: string[]) => Promise<string[]>;
  findManagedCustomerGroup: (
    customerId: string,
  ) => Promise<{ id: string; name: string } | null>;
  ensureManagedCustomerGroup: (input: {
    customerId: string;
    displayName: string;
  }) => Promise<{ id: string }>;
  renameManagedCustomerGroup: (input: {
    customerId: string;
    displayName: string;
  }) => Promise<void>;
  listCounterpartiesByCustomerId: (customerId: string) => Promise<{ id: string }[]>;
  listGroupHierarchyNodes: () => Promise<GroupHierarchyNodeSnapshot[]>;
  listMembershipRowsByCounterpartyIds: (
    counterpartyIds: string[],
  ) => Promise<
    {
      counterpartyId: string;
      groupId: string;
    }[]
  >;
  deleteMembershipsByCounterpartyAndGroupIds: (input: {
    counterpartyIds: string[];
    groupIds: string[];
  }) => Promise<void>;
  clearCounterpartyCustomerLink: (counterpartyIds: string[]) => Promise<void>;
  deleteCounterpartyGroupsByIds: (groupIds: string[]) => Promise<void>;
}
