export {
  createRequisitesService,
  createRequisitesServiceFromContext,
  createRequisitesServiceFromTransaction,
  type RequisitesService,
} from "./service";
export type { RequisitesServiceDeps } from "./application/shared/context";
export type { RequisitesServiceTransactionDeps } from "./service";
export * from "./errors";
