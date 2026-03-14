import { drizzle } from "drizzle-orm/node-postgres";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";

import type { Database } from "@bedrock/platform/persistence/drizzle";
import { canonicalJson } from "@bedrock/shared/core/canon";

import { PACK_PACKAGE_NAME } from "../src/packs/bedrock-core-default";
import {
  AccountingPackDefinitionSchema,
  type AccountingPackDefinition,
} from "../src/packs/schema";
import {
  compilePack,
  createAccountingRuntime,
  type CompiledPack,
} from "../src/runtime";


const DEFAULT_PACK_URL = new URL(
  "../src/packs/bedrock-core-default.ts",
  import.meta.url,
);

const db: Database = drizzle(
  new Pool({
    host: process.env.DB_HOST ?? "localhost",
    port: +(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? "postgres",
    user: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD ?? "",
    ssl:
      process.env.DB_SSL === "true"
        ? { rejectUnauthorized: true }
        : false,
    allowExitOnIdle: true,
  }),
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
  const packPath = readOptionalFlag("pack-path");
  const packRef = packPath
    ? resolve(process.cwd(), packPath)
    : PACK_PACKAGE_NAME;
  const module = (packPath
    ? await import(pathToFileURL(packRef).href)
    : await import(DEFAULT_PACK_URL.href)) as {
    rawPackDefinition?: unknown;
  };

  if (!module.rawPackDefinition) {
    throw new Error(`${packRef} does not export rawPackDefinition`);
  }

  return {
    packRef,
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
