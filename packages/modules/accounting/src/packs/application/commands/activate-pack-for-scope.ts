import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  ActivatePackForScopeInputSchema,
  type ActivatePackForScopeInput,
} from "../contracts/commands";
import type { CompiledPackCache } from "../ports/compiled-pack.cache";
import type { PacksCommandUnitOfWork } from "../ports/packs.uow";
import type { CompiledPack } from "../../domain";
import { AccountingPackNotFoundError } from "../../../errors";

export const PACK_SCOPE_TYPE_BOOK = "book";

export class ActivatePackForScopeCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: PacksCommandUnitOfWork,
    private readonly loadPackByChecksum: (
      checksum: string,
    ) => Promise<CompiledPack | null>,
    private readonly cache?: CompiledPackCache,
  ) {}

  async execute(input: ActivatePackForScopeInput) {
    const validated = ActivatePackForScopeInputSchema.parse(input);
    const pack = await this.loadPackByChecksum(validated.packChecksum);
    if (!pack) {
      throw new AccountingPackNotFoundError(validated.packChecksum);
    }

    const scopeType = validated.scopeType ?? PACK_SCOPE_TYPE_BOOK;
    const effectiveAt = validated.effectiveAt ?? this.runtime.now();

    await this.uow.run(async (tx) => {
      await tx.packs.insertAssignment({
        scopeType,
        scopeId: validated.scopeId,
        packChecksum: validated.packChecksum,
        effectiveAt,
      });
    });

    this.cache?.write(
      `scope:${scopeType}:${validated.scopeId}:${effectiveAt.toISOString()}`,
      pack,
    );

    return {
      packChecksum: validated.packChecksum,
      scopeId: validated.scopeId,
      scopeType,
      effectiveAt,
    };
  }
}
