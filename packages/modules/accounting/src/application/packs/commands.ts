import {
  PACK_SCOPE_TYPE_BOOK,
  requirePacksCommandRepository,
  requirePacksTransactionRunner,
  writeCachedPack,
  type AccountingPacksContext,
} from "./context";
import { rethrowAccountingPacksDomainError } from "./map-domain-error";
import {
  AccountingPackVersion,
  type AccountingPackDefinition,
  compilePack,
  hydrateCompiledPack,
  serializeCompiledPack,
  type CompiledPack,
} from "../../domain/packs";
import { AccountingPackNotFoundError } from "../../errors";

export function createStoreCompiledPackVersionCommand(input: {
  context: AccountingPacksContext;
}) {
  const { context } = input;

  return async function storeCompiledPackVersion(command: {
    definition?: AccountingPackDefinition;
    pack?: CompiledPack;
  }) {
    try {
      const repository = requirePacksCommandRepository(context);
      const runInTransaction = requirePacksTransactionRunner(context);
      const compiled =
        command.pack ??
        (command.definition
          ? compilePack(command.definition)
          : context.defaultCompiledPack);
      const packVersion = AccountingPackVersion.fromCompiledPack(compiled);
      const { compiledJson } = serializeCompiledPack(compiled);
      let replacedChecksum: string | null = null;

      const stored = await runInTransaction(async (tx) => {
        const existing = await repository.findPackVersion({
          packKey: compiled.packKey,
          version: compiled.version,
          tx,
        });

        if (!existing) {
          await repository.insertPackVersion({
            packKey: compiled.packKey,
            version: compiled.version,
            checksum: compiled.checksum,
            compiledJson,
            tx,
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
          const checksumAssigned = await repository.hasAssignmentsForPackChecksum({
            checksum: existing.checksum,
            tx,
          });
          packVersion.assertCanReplace(existing.checksum, checksumAssigned);
        }

        await repository.updatePackVersion({
          packKey: compiled.packKey,
          version: compiled.version,
          checksum: compiled.checksum,
          compiledJson,
          compiledAt: context.now(),
          tx,
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
    } catch (error) {
      rethrowAccountingPacksDomainError(error);
    }
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
    const repository = requirePacksCommandRepository(context);
    const runInTransaction = requirePacksTransactionRunner(context);
    const pack = await loadCompiledPackByChecksum(command.packChecksum);
    if (!pack) {
      throw new AccountingPackNotFoundError(command.packChecksum);
    }

    const scopeType = command.scopeType ?? PACK_SCOPE_TYPE_BOOK;
    const effectiveAt = command.effectiveAt ?? context.now();

    await runInTransaction(async (tx) => {
      await repository.insertPackAssignment({
        scopeType,
        scopeId: command.scopeId,
        packChecksum: command.packChecksum,
        effectiveAt,
        tx,
      });
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
