import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

function resolveConnectionConfig() {
    if (process.env.DATABASE_URL) {
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: false,
        };
    }

    return {
        host: process.env.DB_HOST ?? "localhost",
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? "postgres",
        user: process.env.DB_USER ?? "postgres",
        password: process.env.DB_PASSWORD ?? "",
        ssl: false,
    };
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
