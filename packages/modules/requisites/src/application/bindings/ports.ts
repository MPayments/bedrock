import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type { RequisiteAccountingBinding } from "../../contracts";
import type { RequisitesQueryRepository } from "../requisites/ports";

export interface RequisiteAccountingBindingRecord {
  requisiteId: string;
  bookId: string;
  bookAccountInstanceId: string;
  postingAccountNo: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequisiteAccountingBindingsQueryRepository {
  findBindingByRequisiteId: (
    requisiteId: string,
    tx?: PersistenceSession,
  ) => Promise<RequisiteAccountingBindingRecord | null>;
  listBindingsByRequisiteId: (
    requisiteIds: string[],
    tx?: PersistenceSession,
  ) => Promise<RequisiteAccountingBindingRecord[]>;
}

export interface RequisiteAccountingBindingsCommandRepository {
  upsertBinding: (
    input: {
      requisiteId: string;
      bookId: string;
      bookAccountInstanceId: string;
      postingAccountNo: string;
    },
    tx?: PersistenceSession,
  ) => Promise<RequisiteAccountingBindingRecord | null>;
}

export type RequisiteBindingSubjectPort = Pick<
  RequisitesQueryRepository,
  "findSubjectById" | "listSubjectsById"
>;

export type RequisiteAccountingBindingDto = RequisiteAccountingBinding;
