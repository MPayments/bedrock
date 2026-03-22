import { PackChecksumSchema } from "../contracts/queries";
import type { CompiledPackCache } from "../ports/compiled-pack.cache";
import type { PackReads } from "../ports/pack.reads";
import { hydrateCompiledPack } from "../../domain";
import { rethrowAccountingPacksDomainError } from "../map-domain-error";

export class LoadPackByChecksumQuery {
  constructor(
    private readonly reads: PackReads,
    private readonly cache?: CompiledPackCache,
  ) {}

  async execute(checksum: string) {
    const validatedChecksum = PackChecksumSchema.parse(checksum);

    try {
      const cached = this.cache?.read(validatedChecksum);
      if (typeof cached !== "undefined") {
        return cached;
      }

      const row = await this.reads.findByChecksum(validatedChecksum);
      if (!row) {
        this.cache?.write(validatedChecksum, null);
        return null;
      }

      const pack = hydrateCompiledPack(row.compiledJson);
      this.cache?.write(validatedChecksum, pack);
      if (pack.checksum !== validatedChecksum) {
        this.cache?.write(pack.checksum, pack);
      }

      return pack;
    } catch (error) {
      rethrowAccountingPacksDomainError(error);
    }
  }
}
