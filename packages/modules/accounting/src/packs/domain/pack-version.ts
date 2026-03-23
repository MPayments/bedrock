import { DomainError, Entity, invariant } from "@bedrock/shared/core/domain";

import { type CompiledPack } from "./compiled-pack";

export interface ExistingAccountingPackVersionState {
  checksum: string;
  pack: CompiledPack;
}

export interface AccountingPackVersionStorePlan {
  action: "insert" | "reuse" | "update";
  pack: CompiledPack;
  replacedChecksum: string | null;
}

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

  planStore(input: {
    compiledPack: CompiledPack;
    existing: ExistingAccountingPackVersionState | null;
    existingChecksumAssigned?: boolean;
  }): AccountingPackVersionStorePlan {
    if (!input.existing) {
      return {
        action: "insert",
        pack: input.compiledPack,
        replacedChecksum: null,
      };
    }

    const checksumMatches = input.existing.checksum === this.checksum;
    const payloadMatches = input.existing.pack.checksum === this.checksum;

    if (checksumMatches && payloadMatches) {
      return {
        action: "reuse",
        pack: input.existing.pack,
        replacedChecksum: null,
      };
    }

    if (!checksumMatches) {
      this.assertCanReplace(
        input.existing.checksum,
        input.existingChecksumAssigned ?? false,
      );
    }

    return {
      action: "update",
      pack: input.compiledPack,
      replacedChecksum: checksumMatches ? null : input.existing.checksum,
    };
  }
}
