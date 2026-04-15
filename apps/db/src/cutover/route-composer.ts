import dotenv from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPostgresPool } from "@bedrock/platform/persistence/postgres";

const dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(dir, "../../../.env") });

export const ROUTE_COMPOSER_REQUIRED_TABLES = [
  "customers",
  "counterparties",
  "agreements",
  "deals",
  "deal_routes",
  "deal_route_versions",
  "calculations",
  "file_assets",
  "file_links",
] as const;

export const ROUTE_COMPOSER_BACKUP_TABLES = [
  "customers",
  "counterparties",
  "party_profiles",
  "party_identifiers",
  "party_addresses",
  "party_contacts",
  "party_representatives",
  "party_licenses",
  "agreements",
  "agreement_versions",
  "agreement_fee_rules",
  "agreement_parties",
  "organizations",
  "organization_requisite_bindings",
  "requisites",
  "requisite_identifiers",
  "requisite_providers",
  "requisite_provider_identifiers",
  "requisite_provider_branches",
  "requisite_provider_branch_identifiers",
  "deals",
  "deal_participants",
  "deal_intake_snapshots",
  "deal_legs",
  "deal_approvals",
  "deal_timeline_events",
  "deal_routes",
  "deal_route_versions",
  "deal_route_participants",
  "deal_route_legs",
  "deal_route_cost_components",
  "deal_calculation_links",
  "calculations",
  "calculation_snapshots",
  "calculation_lines",
  "file_assets",
  "file_versions",
  "file_links",
] as const;

export const ROUTE_COMPOSER_LEGACY_COMMERCIAL_TABLE_NAMES = [
  "applications",
] as const;

export const ROUTE_COMPOSER_LEGACY_COMMERCIAL_TABLE_PREFIXES = [
  "application_",
] as const;

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

export function resolveRouteComposerCutoverOutputDir() {
  const configured = process.env.ROUTE_COMPOSER_CUTOVER_DIR?.trim();

  if (configured) {
    return resolve(configured);
  }

  return resolve(
    dir,
    "../../../artifacts/route-composer-cutover",
    timestampSlug(),
  );
}

async function createPool() {
  return createPostgresPool();
}

async function listPublicTablesWithPool(pool: Awaited<ReturnType<typeof createPool>>) {
  const result = await pool.query<{
    tablename: string;
  }>(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  return result.rows.map((row) => row.tablename);
}

async function listPublicTablesWithClient(client: {
  query: Awaited<ReturnType<typeof createPool>>["query"];
}) {
  const result = await client.query<{
    tablename: string;
  }>(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  return result.rows.map((row) => row.tablename);
}

function listLegacyCommercialTablesFrom(input: string[]) {
  return input.filter(
    (table) =>
      ROUTE_COMPOSER_LEGACY_COMMERCIAL_TABLE_NAMES.includes(
        table as (typeof ROUTE_COMPOSER_LEGACY_COMMERCIAL_TABLE_NAMES)[number],
      ) ||
      ROUTE_COMPOSER_LEGACY_COMMERCIAL_TABLE_PREFIXES.some((prefix) =>
        table.startsWith(prefix),
      ),
  );
}

export async function listPublicTables() {
  const pool = await createPool();

  try {
    return await listPublicTablesWithPool(pool);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function backupRouteComposerTables(outputDir: string) {
  const pool = await createPool();

  try {
    const existingTables = await listPublicTablesWithPool(pool);
    const existingTableSet = new Set(existingTables);
    const tables = [
      ...ROUTE_COMPOSER_BACKUP_TABLES.filter((table) =>
        existingTableSet.has(table),
      ),
      ...listLegacyCommercialTablesFrom(existingTables),
    ];
    const manifest: {
      generatedAt: string;
      outputDir: string;
      tables: Record<string, { rowCount: number }>;
    } = {
      generatedAt: new Date().toISOString(),
      outputDir,
      tables: {},
    };

    await mkdir(outputDir, { recursive: true });

    for (const table of tables) {
      const query = `SELECT * FROM public.${quoteIdentifier(table)} ORDER BY 1`;
      const result = await pool.query(query);

      manifest.tables[table] = { rowCount: result.rowCount ?? result.rows.length };
      await writeFile(
        resolve(outputDir, `${table}.json`),
        `${JSON.stringify(result.rows, null, 2)}\n`,
        "utf8",
      );
    }

    await writeFile(
      resolve(outputDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    return manifest;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function runRouteComposerEtl() {
  const pool = await createPool();

  try {
    const client = await pool.connect();

    try {
      const existingTables = await listPublicTablesWithClient(client);
      const legacyCommercialTables =
        listLegacyCommercialTablesFrom(existingTables);
      const legacyGeneratedFileSummary = await client.query<{
        assetCount: string;
        linkCount: string;
        versionCount: string;
      }>(`
        WITH legacy_assets AS (
          SELECT DISTINCT file_asset_id
          FROM public.file_links
          WHERE link_kind::text = 'deal_application'
        )
        SELECT
          (SELECT count(*)::text FROM legacy_assets) AS "assetCount",
          (
            SELECT count(*)::text
            FROM public.file_links
            WHERE link_kind::text = 'deal_application'
          ) AS "linkCount",
          (
            SELECT count(*)::text
            FROM public.file_versions
            WHERE file_asset_id IN (SELECT file_asset_id FROM legacy_assets)
          ) AS "versionCount"
      `);
      const {
        assetCount = "0",
        linkCount = "0",
        versionCount = "0",
      } = legacyGeneratedFileSummary.rows[0] ?? {};

      await client.query("BEGIN");

      try {
        await client.query(`
          DELETE FROM public.file_assets AS file_asset
          USING public.file_links AS file_link
          WHERE file_link.file_asset_id = file_asset.id
            AND file_link.link_kind::text = 'deal_application'
        `);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      }

      return {
        completedAt: new Date().toISOString(),
        deletedLegacyGeneratedApplicationAssets: Number(assetCount),
        deletedLegacyGeneratedApplicationFileLinks: Number(linkCount),
        deletedLegacyGeneratedApplicationVersions: Number(versionCount),
        legacyCommercialTables,
      };
    } finally {
      client.release();
    }
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function assertRouteComposerCutoverInvariants() {
  const pool = await createPool();

  try {
    const existingTables = await listPublicTablesWithPool(pool);
    const existingTableSet = new Set(existingTables);
    const missingTables = ROUTE_COMPOSER_REQUIRED_TABLES.filter(
      (table) => !existingTableSet.has(table),
    );
    const legacyCommercialTables =
      listLegacyCommercialTablesFrom(existingTables);

    if (missingTables.length > 0) {
      throw new Error(
        `Route composer cutover is missing final tables: ${missingTables.join(", ")}`,
      );
    }

    const legacyGeneratedFileResult = await pool.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM public.file_links
      WHERE link_kind = 'deal_application'
    `);
    const legacyGeneratedFileCount = Number(
      legacyGeneratedFileResult.rows[0]?.count ?? "0",
    );

    if (legacyCommercialTables.length > 0) {
      throw new Error(
        `Legacy application tables still exist: ${legacyCommercialTables.join(", ")}`,
      );
    }

    if (legacyGeneratedFileCount > 0) {
      throw new Error(
        `Legacy deal_application generated files still exist: ${legacyGeneratedFileCount}`,
      );
    }

    return {
      checkedAt: new Date().toISOString(),
      legacyCommercialTables,
      legacyGeneratedFileCount,
      missingTables,
      requiredTables: [...ROUTE_COMPOSER_REQUIRED_TABLES],
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}
