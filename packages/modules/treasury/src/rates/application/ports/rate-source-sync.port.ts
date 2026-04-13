import type {
  RateRowRecord,
  RateSourceStatus,
} from "./rates.repository";
import type { RateSource } from "../../../shared/application/external-ports";

export interface RateSourceSyncPort {
  getRateSourceStatuses(now?: Date): Promise<RateSourceStatus[]>;
  ensureSourceFresh(
    source: RateSource,
    now?: Date,
  ): Promise<RateSourceStatus>;
  getLatestRateBySource(
    baseCurrencyId: string,
    quoteCurrencyId: string,
    asOf: Date,
    source: RateSource,
  ): Promise<RateRowRecord | undefined>;
  getLatestManualRate(
    baseCurrencyId: string,
    quoteCurrencyId: string,
    asOf: Date,
  ): Promise<RateRowRecord | undefined>;
}
