import { sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import type { LedgerBookRow } from "../../../contracts";
import type { LedgerBooksReads } from "../../application/ports/book.reads";

export class DrizzleBooksReads implements LedgerBooksReads {
  constructor(private readonly db: Queryable) {}

  async listById(ids: string[]): Promise<LedgerBookRow[]> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return [];
    }

    const result = await this.db.execute(sql`
      SELECT
        b.id::text AS id,
        b.name,
        b.owner_id::text AS owner_id
      FROM "books" b
      WHERE b.id IN (${sql.join(
        uniqueIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
    `);

    return (
      (result.rows ?? []) as {
        id: string;
        name: string | null;
        owner_id: string | null;
      }[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
    }));
  }

  async listByOwnerId(ownerId: string): Promise<LedgerBookRow[]> {
    const result = await this.db.execute(sql`
      SELECT
        b.id::text AS id,
        b.name,
        b.owner_id::text AS owner_id
      FROM "books" b
      WHERE b.owner_id = ${ownerId}::uuid
    `);

    return (
      (result.rows ?? []) as {
        id: string;
        name: string | null;
        owner_id: string | null;
      }[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
    }));
  }
}
