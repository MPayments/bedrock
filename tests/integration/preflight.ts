import type { Pool } from "pg";

const REQUIRED_TABLES = [
  { schemaName: "drizzle", tableName: "__drizzle_migrations" },
  { schemaName: "public", tableName: "books" },
  { schemaName: "public", tableName: "organizations" },
  { schemaName: "public", tableName: "customer_memberships" },
  { schemaName: "public", tableName: "requisite_providers" },
  { schemaName: "public", tableName: "requisites" },
  { schemaName: "public", tableName: "organization_requisite_bindings" },
  { schemaName: "public", tableName: "deals" },
  { schemaName: "public", tableName: "deal_participants" },
  { schemaName: "public", tableName: "deal_legs" },
  { schemaName: "public", tableName: "deal_routes" },
  { schemaName: "public", tableName: "deal_route_versions" },
  { schemaName: "public", tableName: "deal_calculation_links" },
  { schemaName: "public", tableName: "deal_capability_states" },
  { schemaName: "public", tableName: "deal_operational_positions" },
  { schemaName: "public", tableName: "deal_timeline_events" },
  { schemaName: "public", tableName: "treasury_execution_fills" },
  { schemaName: "public", tableName: "treasury_execution_fees" },
  { schemaName: "public", tableName: "treasury_cash_movements" },
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
  {
    tableName: "counterparties",
    columnName: "customer_id",
  },
  {
    tableName: "deals",
    columnName: "next_action",
  },
  {
    tableName: "deals",
    columnName: "header_revision",
  },
  {
    tableName: "deals",
    columnName: "header_snapshot",
  },
  {
    tableName: "deal_legs",
    columnName: "state",
  },
  {
    tableName: "deal_calculation_links",
    columnName: "source_quote_id",
  },
  {
    tableName: "calculation_snapshots",
    columnName: "quote_snapshot",
  },
  {
    tableName: "treasury_execution_fills",
    columnName: "calculation_snapshot_id",
  },
  {
    tableName: "treasury_execution_fees",
    columnName: "component_code",
  },
  {
    tableName: "treasury_cash_movements",
    columnName: "value_date",
  },
] as const;

const REQUIRED_INDEXES = ["books_default_owner_uq"] as const;
const REQUIRED_ENUM_VALUES = [
  {
    enumName: "deal_status",
    values: [
      "pricing",
      "quoted",
      "approved_for_execution",
      "reconciling",
      "closed",
    ],
  },
  {
    enumName: "deal_timeline_event_type",
    values: ["deal_header_updated", "calculation_accepted", "leg_state_changed"],
  },
] as const;

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
  const existingEnumValuesResult = await pool.query<{
    enum_name: string;
    enum_value: string;
  }>(
    `
      SELECT
        t.typname AS enum_name,
        e.enumlabel AS enum_value
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = ANY($1::text[])
    `,
    [REQUIRED_ENUM_VALUES.map((entry) => entry.enumName)],
  );
  const existingEnumValues = new Set(
    existingEnumValuesResult.rows.map(
      (row) => `${row.enum_name}.${row.enum_value}`,
    ),
  );
  const missingEnumValues = REQUIRED_ENUM_VALUES.flatMap((entry) =>
    entry.values
      .filter((value) => !existingEnumValues.has(`${entry.enumName}.${value}`))
      .map((value) => `${entry.enumName}.${value}`),
  );

  if (
    missingTables.length > 0 ||
    missingColumns.length > 0 ||
    missingIndexes.length > 0 ||
    missingEnumValues.length > 0
  ) {
    throw new Error(
      [
        "Integration DB schema preflight failed.",
        `Missing tables: ${formatMissing(
          missingTables.map((table) => `${table.schemaName}.${table.tableName}`),
        )}`,
        `Missing columns: ${formatMissing(missingColumns)}`,
        `Missing indexes: ${formatMissing([...missingIndexes])}`,
        `Missing enum values: ${formatMissing(missingEnumValues)}`,
        "Run the hard-cutover path: db:nuke -> db:migrate -> db:seed.",
      ].join("\n"),
    );
  }
}
