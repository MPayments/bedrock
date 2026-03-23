import type { RateSourceSyncPort } from "../ports/rate-source-sync.port";
import type { RateSourceStatus } from "../ports/rates.repository";

export class GetRateSourceStatusesQuery {
  constructor(private readonly rateSourceSync: RateSourceSyncPort) {}

  async execute(now?: Date): Promise<RateSourceStatus[]> {
    return this.rateSourceSync.getRateSourceStatuses(now);
  }
}
