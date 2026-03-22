import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  LoadActivePackForBookInputSchema,
  type LoadActivePackForBookInput,
} from "../contracts/queries";
import type { CompiledPackCache } from "../ports/compiled-pack.cache";
import type { PackReads } from "../ports/pack.reads";
import type { CompiledPack } from "../../domain";
import { AccountingPackNotFoundError, AccountingPostingPlanValidationError } from "../../../errors";
import { PACK_SCOPE_TYPE_BOOK } from "../commands/activate-pack-for-scope";

export class LoadActivePackForBookQuery {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly reads: PackReads | undefined,
    private readonly defaultCompiledPack: CompiledPack,
    private readonly loadPackByChecksum: (checksum: string) => Promise<CompiledPack | null>,
    private readonly cache?: CompiledPackCache,
  ) {}

  async execute(input?: LoadActivePackForBookInput) {
    const validated = LoadActivePackForBookInputSchema.safeParse(input ?? {});
    if (!validated.success) {
      throw new AccountingPostingPlanValidationError(
        "Active pack lookup requires bookId",
      );
    }

    if (!this.reads) {
      return this.defaultCompiledPack;
    }

    const at = validated.data.at ?? this.runtime.now();
    const scopeCacheKey = `scope:${PACK_SCOPE_TYPE_BOOK}:${validated.data.bookId}:${at.toISOString()}`;
    const cached = this.cache?.read(scopeCacheKey);
    if (typeof cached !== "undefined" && cached) {
      return cached;
    }

    const assignment = await this.reads.findActiveAssignment({
      scopeType: PACK_SCOPE_TYPE_BOOK,
      scopeId: validated.data.bookId,
      effectiveAt: at,
    });

    if (!assignment) {
      this.cache?.write(scopeCacheKey, this.defaultCompiledPack);
      return this.defaultCompiledPack;
    }

    const pack = await this.loadPackByChecksum(assignment.packChecksum);
    if (!pack) {
      throw new AccountingPackNotFoundError(assignment.packChecksum);
    }

    this.cache?.write(scopeCacheKey, pack);
    return pack;
  }
}
