export * from "./errors";
export {
  canDealCreateFormalDocuments,
  canDealWriteTreasuryOrFormalDocuments,
} from "./domain/constants";
export {
  computeDealLegState,
  type ComputeDealLegStateInput,
  type ComputedDealLegState,
  type DealLegManualOverride,
} from "./domain/leg-state-projection";
export {
  createDealsModule,
  type DealsModule,
  type DealsModuleDeps,
} from "./module";
export { type DealRouteVersionSnapshot } from "./domain/route-version";
