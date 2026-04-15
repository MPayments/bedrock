import {
  getFinanceDealExecutionWorkspaceById,
  type FinanceDealExecutionWorkspace,
} from "./execution-workspace";

export type FinanceDealReconciliationWorkspace = FinanceDealExecutionWorkspace;

export const getFinanceDealReconciliationWorkspaceById =
  getFinanceDealExecutionWorkspaceById;
