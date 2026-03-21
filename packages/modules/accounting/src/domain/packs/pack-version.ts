import { DomainError, Entity, invariant } from "@bedrock/shared/core/domain";

import { type CompiledPack } from "./compiled-pack";

export class AccountingPackVersion extends Entity<string> {
  private constructor(
    public readonly packKey: string,
    public readonly version: number,
    public readonly checksum: string,
  ) {
    super({ id: `${packKey}:${version}`, props: {} });
  }

  static fromCompiledPack(pack: CompiledPack) {
    invariant(
      pack.packKey.trim().length > 0,
      "Accounting pack version requires packKey",
      {
        code: "accounting_pack.version_pack_key_required",
        meta: { packKey: pack.packKey },
      },
    );

    return new AccountingPackVersion(pack.packKey, pack.version, pack.checksum);
  }

  assertCanReplace(
    existingChecksum: string,
    existingChecksumAssigned: boolean,
  ) {
    if (
      existingChecksumAssigned &&
      existingChecksum.trim() !== this.checksum &&
      existingChecksum.trim().length > 0
    ) {
      throw new DomainError(
        `Accounting pack ${this.packKey}@${this.version} already exists with checksum ${existingChecksum}; cannot replace with ${this.checksum} because existing checksum is already assigned`,
        {
          code: "accounting_pack.version_conflict",
          meta: {
            packKey: this.packKey,
            version: String(this.version),
            existingChecksum,
            nextChecksum: this.checksum,
          },
        },
      );
    }
  }
}
