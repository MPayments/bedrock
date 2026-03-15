export {
  createCbrRateSourceProvider,
  type CbrRateSourceProviderDeps,
} from "./infra/providers/sources/cbr";
export {
  createInvestingRateSourceProvider,
  type InvestingRateSourceProviderDeps,
} from "./infra/providers/sources/investing";
export {
  createXeRateSourceProvider,
  type XeRateSourceProviderDeps,
} from "./infra/providers/sources/xe";
export { createDefaultFxRateSourceProviders } from "./infra/providers/defaults";
export { RateSourceSyncError } from "./infra/providers/errors";
export type {
  FxRateRecord,
  FxRateSourceFetchResult,
  FxRateSourceProvider,
  FxRateSourceStatus,
  FxRateSourceSyncResult,
} from "./application/shared/external-ports";
export type { FxRateSource } from "./domain/rate-source";
