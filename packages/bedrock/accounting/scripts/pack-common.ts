import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  AccountingPackDefinitionSchema,
  compileAccountingPack as compilePack,
  createAccountingRuntime,
  type AccountingPackDefinition,
  type CompiledPack,
} from "@bedrock/accounting";
import { canonicalJson } from "@bedrock/kernel";

import { db } from "../../../db/src/client.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACK_PATH = resolve(
  SCRIPT_DIR,
  "../../../domains/bedrock-app/src/default-pack.ts",
);

function readFlag(name: string): string | undefined {
  const args = process.argv.slice(2);
  const exact = `--${name}`;

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === exact) {
      return args[index + 1];
    }
    if (current?.startsWith(`${exact}=`)) {
      return current.slice(exact.length + 1);
    }
  }

  return undefined;
}

export function readRequiredFlag(name: string): string {
  const value = readFlag(name);
  if (!value) {
    throw new Error(`Missing required flag --${name}`);
  }
  return value;
}

export function readOptionalFlag(name: string): string | undefined {
  return readFlag(name);
}

export async function loadRawPackDefinition(): Promise<{
  packRef: string;
  definition: AccountingPackDefinition;
}> {
  const packPath = readOptionalFlag("pack-path") ?? DEFAULT_PACK_PATH;
  const module = (await import(pathToFileURL(packPath).href)) as {
    rawPackDefinition?: unknown;
  };

  if (!module.rawPackDefinition) {
    throw new Error(`${packPath} does not export rawPackDefinition`);
  }

  return {
    packRef: packPath,
    definition: AccountingPackDefinitionSchema.parse(
      module.rawPackDefinition,
    ) as AccountingPackDefinition,
  };
}

export function createPackRuntime(
  defaultPackDefinition: AccountingPackDefinition,
) {
  return createAccountingRuntime({
    db,
    defaultPackDefinition,
  });
}

export function renderCompiledPack(compiled: CompiledPack) {
  return canonicalJson({
    packKey: compiled.packKey,
    version: compiled.version,
    checksum: compiled.checksum,
    templates: compiled.templates,
  });
}

export { compilePack };
