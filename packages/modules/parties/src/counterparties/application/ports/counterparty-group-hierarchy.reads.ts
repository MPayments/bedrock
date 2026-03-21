import type { GroupHierarchyNodeSnapshot } from "../../../shared/domain/group-hierarchy";

export interface CounterpartyGroupHierarchyReads {
  listHierarchyNodes(): Promise<GroupHierarchyNodeSnapshot[]>;
}
