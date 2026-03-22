import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  AccountingPackVersion,
  compilePack,
  hydrateCompiledPack,
  type ExistingAccountingPackVersionState,
  serializeCompiledPack,
  type CompiledPack,
} from "../../domain";
import {
  StorePackVersionInputSchema,
  type StorePackVersionInput,
} from "../contracts/commands";
import { rethrowAccountingPacksDomainError } from "../map-domain-error";
import type { CompiledPackCache } from "../ports/compiled-pack.cache";
import type { PacksCommandUnitOfWork } from "../ports/packs.uow";

export class StorePackVersionCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: PacksCommandUnitOfWork,
    private readonly defaultCompiledPack: CompiledPack,
    private readonly cache?: CompiledPackCache,
  ) {}

  async execute(input: StorePackVersionInput) {
    const validated = StorePackVersionInputSchema.parse(input);

    try {
      const compiled =
        validated.pack ??
        (validated.definition
          ? compilePack(validated.definition)
          : this.defaultCompiledPack);
      const packVersion = AccountingPackVersion.fromCompiledPack(compiled);
      let replacedChecksum: string | null = null;

      const stored = await this.uow.run(async (tx) => {
        const existing = await tx.packs.findVersion({
          packKey: compiled.packKey,
          version: compiled.version,
        });
        const existingState: ExistingAccountingPackVersionState | null = existing
          ? {
              checksum: existing.checksum,
              pack: hydrateCompiledPack(existing.compiledJson),
            }
          : null;
        const existingChecksumAssigned =
          existing && existing.checksum !== compiled.checksum
            ? await tx.packs.hasAssignmentsForChecksum({
                checksum: existing.checksum,
              })
            : false;
        const storePlan = packVersion.planStore({
          compiledPack: compiled,
          existing: existingState,
          existingChecksumAssigned,
        });

        if (storePlan.action === "reuse") {
          return storePlan.pack;
        }

        const { compiledJson } = serializeCompiledPack(compiled);

        if (storePlan.action === "insert") {
          await tx.packs.insertVersion({
            packKey: compiled.packKey,
            version: compiled.version,
            checksum: compiled.checksum,
            compiledJson,
          });

          return storePlan.pack;
        }

        await tx.packs.updateVersion({
          packKey: compiled.packKey,
          version: compiled.version,
          checksum: compiled.checksum,
          compiledJson,
          compiledAt: this.runtime.now(),
        });

        replacedChecksum = storePlan.replacedChecksum;

        return storePlan.pack;
      });

      if (replacedChecksum) {
        this.cache?.write(replacedChecksum, null);
      }
      this.cache?.write(stored.checksum, stored);
      return stored;
    } catch (error) {
      rethrowAccountingPacksDomainError(error);
    }
  }
}
