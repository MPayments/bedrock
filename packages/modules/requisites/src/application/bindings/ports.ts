import type { Transaction } from "@bedrock/platform/persistence";

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
    tx?: Transaction,
  ) => Promise<RequisiteAccountingBindingRecord | null>;
  listBindingsByRequisiteId: (
    requisiteIds: string[],
    tx?: Transaction,
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
    tx?: Transaction,
  ) => Promise<RequisiteAccountingBindingRecord | null>;
}

export interface RequisiteBindingSubjectPort
  extends Pick<RequisitesQueryRepository, "findSubjectById" | "listSubjectsById"> {}

export type RequisiteAccountingBindingDto = RequisiteAccountingBinding;
