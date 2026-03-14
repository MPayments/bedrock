import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(dir, "../../../.env") });

function parseConnectionString(connectionString) {
    const parsed = new URL(connectionString);

    return {
        host: parsed.hostname || "localhost",
        port: parsed.port ? Number(parsed.port) : 5432,
        database: parsed.pathname.replace(/^\//, "") || "postgres",
        user: decodeURIComponent(parsed.username || "postgres"),
        password: decodeURIComponent(parsed.password || process.env.DB_PASSWORD || ""),
        ssl: false,
    };
}

function resolveConnectionConfig() {
    const hasExplicitDbConfig =
        process.env.DB_HOST ||
        process.env.DB_PORT ||
        process.env.DB_NAME ||
        process.env.DB_USER ||
        typeof process.env.DB_PASSWORD === "string";

    if (hasExplicitDbConfig) {
        return {
            host: process.env.DB_HOST ?? "localhost",
            port: Number(process.env.DB_PORT ?? 5432),
            database: process.env.DB_NAME ?? "postgres",
            user: process.env.DB_USER ?? "postgres",
            password: process.env.DB_PASSWORD ?? "",
            ssl: false,
        };
    }

    if (process.env.DATABASE_URL) {
        return parseConnectionString(process.env.DATABASE_URL);
    }

    return parseConnectionString("postgresql://postgres:postgres@localhost:5432/postgres");
}

const client = new Client(resolveConnectionConfig());

const getTablesSql = `
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      AND schemaname NOT LIKE 'pg_toast%'
      AND schemaname NOT LIKE 'pg_temp_%'
    ORDER BY schemaname, tablename;
`;

const dropTablesSql = `
DO $$
DECLARE
    row RECORD;
BEGIN
    FOR row IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          AND schemaname NOT LIKE 'pg_toast%'
          AND schemaname NOT LIKE 'pg_temp_%'
    LOOP
        EXECUTE format(
            'DROP TABLE IF EXISTS %I.%I CASCADE',
            row.schemaname,
            row.tablename
        );
    END LOOP;
END $$;
`;

const dropEnumsSql = `
DO $$
DECLARE
    row RECORD;
BEGIN
    FOR row IN
        SELECT n.nspname AS schema_name, t.typname AS type_name
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE t.typtype = 'e'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        EXECUTE format(
            'DROP TYPE IF EXISTS %I.%I CASCADE',
            row.schema_name,
            row.type_name
        );
    END LOOP;
END $$;
`;

async function main() {
    await client.connect();

    const before = await client.query(getTablesSql);
    const tableNames = before.rows.map(
        (row) => `${row.schemaname}.${row.tablename}`,
    );

    if (tableNames.length === 0) {
        console.log("[db:nuke] No user tables found.");
        return;
    }

    await client.query(dropTablesSql);
    await client.query(dropEnumsSql);

    const after = await client.query(getTablesSql);
    console.log(
        `[db:nuke] Dropped ${tableNames.length} table(s): ${tableNames.join(", ")}`,
    );
    console.log(
        `[db:nuke] Remaining user tables: ${after.rows.length}`,
    );
}

try {
    await main();
} catch (error) {
    console.error("[db:nuke] Failed to nuke database.");
    console.error(error);
    process.exitCode = 1;
} finally {
    await client.end().catch(() => undefined);
}
