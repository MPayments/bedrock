import type { RequisiteBindingRecord } from "./requisite-binding.store";

export interface RequisiteBindingReads {
  findByRequisiteId(requisiteId: string): Promise<RequisiteBindingRecord | null>;
  listByRequisiteId(requisiteIds: string[]): Promise<RequisiteBindingRecord[]>;
}
