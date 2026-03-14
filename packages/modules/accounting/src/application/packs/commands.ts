import {
  PACK_SCOPE_TYPE_BOOK,
  requireRepository,
  requireTransactionRunner,
  writeCachedPack,
  type AccountingPacksContext,
} from "./types";
import {
  AccountingPackNotFoundError,
  AccountingPackVersionConflictError,
} from "../../domain/errors";
import {
  compilePack,
  hydrateCompiledPack,
  serializeCompiledPack,
  type CompiledPack,
} from "../../domain/packs";
import type { AccountingPackDefinition } from "../../packs/schema";

export function createStoreCompiledPackVersionCommand(input: {
  context: AccountingPacksContext;
}) {
  const { context } = input;

  return async function storeCompiledPackVersion(command: {
    definition?: AccountingPackDefinition;
    pack?: CompiledPack;
  }) {
    const transact = requireTransactionRunner(context);
    const compiled =
      command.pack ??
      (command.definition
        ? compilePack(command.definition)
        : context.defaultCompiledPack);
    const { compiledJson } = serializeCompiledPack(compiled);
    let replacedChecksum: string | null = null;

    const stored = await transact(async (transactionRepository) => {
      const existing = await transactionRepository.findPackVersion({
        packKey: compiled.packKey,
        version: compiled.version,
      });

      if (!existing) {
        await transactionRepository.insertPackVersion({
          packKey: compiled.packKey,
          version: compiled.version,
          checksum: compiled.checksum,
          compiledJson,
        });
        return compiled;
      }

      const existingPack = hydrateCompiledPack(existing.compiledJson);
      const checksumMatches = existing.checksum === compiled.checksum;
      const payloadMatches = existingPack.checksum === compiled.checksum;

      if (checksumMatches && payloadMatches) {
        return existingPack;
      }

      if (!checksumMatches) {
        const checksumAssigned =
          await transactionRepository.hasAssignmentsForPackChecksum(
            existing.checksum,
          );
        if (checksumAssigned) {
          throw new AccountingPackVersionConflictError(
            compiled.packKey,
            compiled.version,
            existing.checksum,
            compiled.checksum,
          );
        }
      }

      await transactionRepository.updatePackVersion({
        packKey: compiled.packKey,
        version: compiled.version,
        checksum: compiled.checksum,
        compiledJson,
        compiledAt: new Date(),
      });

      if (existing.checksum !== compiled.checksum) {
        replacedChecksum = existing.checksum;
      }

      return compiled;
    });

    if (replacedChecksum) {
      writeCachedPack(context, replacedChecksum, null);
    }
    writeCachedPack(context, stored.checksum, stored);
    return stored;
  };
}

export function createActivatePackForScopeCommand(input: {
  context: AccountingPacksContext;
  loadCompiledPackByChecksum: (
    checksum: string,
  ) => Promise<CompiledPack | null>;
}) {
  const { context, loadCompiledPackByChecksum } = input;

  return async function activatePackForScope(command: {
    scopeId: string;
    packChecksum: string;
    effectiveAt?: Date;
    scopeType?: string;
  }) {
    const runtimeRepository = requireRepository(context);
    const pack = await loadCompiledPackByChecksum(command.packChecksum);
    if (!pack) {
      throw new AccountingPackNotFoundError(command.packChecksum);
    }

    const scopeType = command.scopeType ?? PACK_SCOPE_TYPE_BOOK;
    const effectiveAt = command.effectiveAt ?? new Date();

    await runtimeRepository.insertPackAssignment({
      scopeType,
      scopeId: command.scopeId,
      packChecksum: command.packChecksum,
      effectiveAt,
    });

    writeCachedPack(
      context,
      `scope:${scopeType}:${command.scopeId}:${effectiveAt.toISOString()}`,
      pack,
    );

    return {
      packChecksum: command.packChecksum,
      scopeId: command.scopeId,
      scopeType,
      effectiveAt,
    };
  };
}
