import type { Transaction } from "@bedrock/platform/persistence";

import type {
  OrganizationRequisiteAccountingBinding,
} from "../../contracts";

export interface OrganizationRequisiteSubject {
  requisiteId: string;
  ownerType: "organization" | "counterparty";
  ownerId: string;
  organizationId: string | null;
  currencyId: string;
  currencyCode: string;
}

export interface OrganizationsRequisiteSubjectsPort {
  findRequisiteSubjectById: (
    requisiteId: string,
    tx?: Transaction,
  ) => Promise<OrganizationRequisiteSubject | null>;
  listRequisiteSubjectsById: (
    requisiteIds: string[],
    tx?: Transaction,
  ) => Promise<OrganizationRequisiteSubject[]>;
}

export interface OrganizationRequisiteBindingRecord {
  requisiteId: string;
  bookId: string;
  bookAccountInstanceId: string;
  postingAccountNo: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationRequisiteBindingsQueryRepository {
  findBindingByRequisiteId: (
    requisiteId: string,
    tx?: Transaction,
  ) => Promise<OrganizationRequisiteBindingRecord | null>;
  listBindingsByRequisiteId: (
    requisiteIds: string[],
    tx?: Transaction,
  ) => Promise<OrganizationRequisiteBindingRecord[]>;
}

export interface OrganizationRequisiteBindingsCommandTxRepository {
  upsertBinding: (input: {
    requisiteId: string;
    bookId: string;
    bookAccountInstanceId: string;
    postingAccountNo: string;
  }) => Promise<OrganizationRequisiteBindingRecord | null>;
}
