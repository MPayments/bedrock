import type { Pool } from "pg";

const REQUIRED_TABLES = [
  { schemaName: "drizzle", tableName: "__drizzle_migrations" },
  { schemaName: "public", tableName: "books" },
  { schemaName: "public", tableName: "organizations" },
  { schemaName: "public", tableName: "requisite_providers" },
  { schemaName: "public", tableName: "requisites" },
  { schemaName: "public", tableName: "organization_requisite_bindings" },
  { schemaName: "public", tableName: "accounting_report_line_mappings" },
  { schemaName: "public", tableName: "accounting_close_packages" },
] as const;

const REQUIRED_COLUMNS = [
  {
    tableName: "books",
    columnName: "owner_id",
  },
  {
    tableName: "requisites",
    columnName: "owner_type",
  },
  {
    tableName: "documents",
    columnName: "organization_requisite_id",
  },
] as const;

const REQUIRED_INDEXES = ["books_default_owner_uq"] as const;

function formatMissing(values: string[]) {
  return values.length === 0 ? "none" : values.join(", ");
}

export async function assertIntegrationDbSchemaState(
  pool: Pick<Pool, "query">,
) {
  const existingTablesResult = await pool.query<{
    table_schema: string;
    table_name: string;
  }>(
    `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = ANY($1::text[])
        AND table_name = ANY($2::text[])
    `,
    [
      Array.from(new Set(REQUIRED_TABLES.map((table) => table.schemaName))),
      Array.from(new Set(REQUIRED_TABLES.map((table) => table.tableName))),
    ],
  );
  const existingTables = new Set(
    existingTablesResult.rows.map(
      (row) => `${row.table_schema}.${row.table_name}`,
    ),
  );
  const missingTables = REQUIRED_TABLES.filter(
    (table) => !existingTables.has(`${table.schemaName}.${table.tableName}`),
  );

  const columnTables = Array.from(
    new Set(REQUIRED_COLUMNS.map((column) => column.tableName)),
  );
  const existingColumnsResult = await pool.query<{
    table_name: string;
    column_name: string;
  }>(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [columnTables],
  );
  const existingColumns = new Set(
    existingColumnsResult.rows.map(
      (row) => `${row.table_name}.${row.column_name}`,
    ),
  );
  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) =>
      !existingColumns.has(`${column.tableName}.${column.columnName}`),
  ).map((column) => `${column.tableName}.${column.columnName}`);

  const existingIndexesResult = await pool.query<{ index_name: string }>(
    `
      SELECT indexname AS index_name
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
    `,
    [REQUIRED_INDEXES],
  );
  const existingIndexes = new Set(
    existingIndexesResult.rows.map((row) => row.index_name),
  );
  const missingIndexes = REQUIRED_INDEXES.filter(
    (name) => !existingIndexes.has(name),
  );

  if (
    missingTables.length > 0 ||
    missingColumns.length > 0 ||
    missingIndexes.length > 0
  ) {
    throw new Error(
      [
        "Integration DB schema preflight failed.",
        `Missing tables: ${formatMissing(
          missingTables.map((table) => `${table.schemaName}.${table.tableName}`),
        )}`,
        `Missing columns: ${formatMissing(missingColumns)}`,
        `Missing indexes: ${formatMissing([...missingIndexes])}`,
        "Run the hard-cutover path: db:nuke -> db:migrate -> db:seed.",
      ].join("\n"),
    );
  }
}
