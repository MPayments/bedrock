import { sql } from "drizzle-orm";

import type { PersistenceContext } from "@bedrock/platform/persistence";

interface SchemaProbeRow {
  sessionAudienceColumn: string | null;
  customerMemberships: string | null;
  portalAccessGrants: string | null;
  sessions: string | null;
  users: string | null;
}

export async function assertApiSchemaReady(
  persistence: PersistenceContext,
): Promise<void> {
  const result = await persistence.db.execute(sql`
    SELECT
      to_regclass('public.customer_memberships') AS "customerMemberships",
      to_regclass('public.portal_access_grants') AS "portalAccessGrants",
      to_regclass('public.session') AS sessions,
      to_regclass('public."user"') AS users,
      (
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'session'
          AND column_name = 'audience'
      ) AS "sessionAudienceColumn"
  `);

  const [row] = (result.rows ?? []) as unknown as SchemaProbeRow[];
  const missingTables = [
    row?.customerMemberships ? null : "customer_memberships",
    row?.portalAccessGrants ? null : "portal_access_grants",
    row?.sessions ? null : "session",
    row?.users ? null : "user",
  ].filter((value): value is string => value !== null);
  const missingColumns = [
    row?.sessionAudienceColumn ? null : "session.audience",
  ].filter((value): value is string => value !== null);

  if (missingTables.length === 0 && missingColumns.length === 0) {
    return;
  }

  throw new Error(
    [
      "API runtime schema is out of date.",
      missingTables.length > 0
        ? `Missing tables: ${missingTables.join(", ")}.`
        : null,
      missingColumns.length > 0
        ? `Missing columns: ${missingColumns.join(", ")}.`
        : null,
      "Apply the current database baseline before starting the API:",
      "  bun run db:nuke",
      "  bun run db:migrate",
      "  bun run db:seed",
    ]
      .filter((value): value is string => value !== null)
      .join("\n"),
  );
}
