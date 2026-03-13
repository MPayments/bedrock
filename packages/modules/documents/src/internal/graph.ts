import { sql } from "drizzle-orm";

import {
  schema,
  type Document,
  type DocumentLinkType,
} from "@bedrock/documents/schema";
import type { Transaction } from "@bedrock/persistence";

import { DocumentGraphError } from "../errors";
import type { DocumentInitialLink } from "../types";

async function assertNoLinkCycle(
  tx: Transaction,
  fromDocumentId: string,
  toDocumentId: string,
  linkType: DocumentLinkType,
) {
  if (fromDocumentId === toDocumentId) {
    throw new DocumentGraphError(`Self-links are not allowed for ${linkType}`);
  }

  if (linkType !== "parent" && linkType !== "depends_on") {
    return;
  }

  const result = await tx.execute(sql`
    WITH RECURSIVE reach(id) AS (
      SELECT ${toDocumentId}::uuid
      UNION
      SELECT dl.to_document_id
      FROM ${schema.documentLinks} dl
      JOIN reach r ON dl.from_document_id = r.id
      WHERE dl.link_type = ${linkType}
    )
    SELECT 1
    FROM reach
    WHERE id = ${fromDocumentId}::uuid
    LIMIT 1
  `);

  if ((result.rows?.length ?? 0) > 0) {
    throw new DocumentGraphError(
      `Link ${linkType} would create a cycle between ${fromDocumentId} and ${toDocumentId}`,
    );
  }
}

export async function insertInitialLinks(
  tx: Transaction,
  document: Document,
  links: DocumentInitialLink[],
) {
  for (const link of links) {
    await assertNoLinkCycle(tx, document.id, link.toDocumentId, link.linkType);

    await tx
      .insert(schema.documentLinks)
      .values({
        fromDocumentId: document.id,
        toDocumentId: link.toDocumentId,
        linkType: link.linkType,
        role: link.role ?? null,
      })
      .onConflictDoNothing();
  }
}
