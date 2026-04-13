import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/postgres",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
});

function buildPayloadHash(input: {
  normalizationVersion: number;
  normalizedPayload: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  source: string;
  sourceRecordId: string;
}) {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

export async function reconcileDealOperationsForClose(dealId: string) {
  const operationResult = await pool.query<{ operationId: string }>(
    `
      select distinct o.treasury_operation_id as "operationId"
      from deal_leg_operation_links o
      inner join deal_legs l on l.id = o.deal_leg_id
      where l.deal_id = $1
      order by "operationId"
    `,
    [dealId],
  );
  const operationIds = operationResult.rows.map((row) => row.operationId);

  if (operationIds.length === 0) {
    throw new Error(`Deal ${dealId} has no linked treasury operations`);
  }

  const source = `e2e-deal-payment:${dealId}:${randomUUID()}`;
  const externalRecordIds: string[] = [];

  for (const operationId of operationIds) {
    const sourceRecordId = `statement:${operationId}`;
    const rawPayload = {
      operationId,
      source: "deal-payment-e2e",
      status: "settled",
    };
    const normalizedPayload = {
      operationId,
    };
    const payloadHash = buildPayloadHash({
      normalizationVersion: 1,
      normalizedPayload,
      rawPayload,
      source,
      sourceRecordId,
    });
    const insertResult = await pool.query<{ id: string }>(
      `
        insert into reconciliation_external_records (
          source,
          source_record_id,
          raw_payload,
          normalized_payload,
          payload_hash,
          normalization_version
        )
        values ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
        returning id
      `,
      [
        source,
        sourceRecordId,
        JSON.stringify(rawPayload),
        JSON.stringify(normalizedPayload),
        payloadHash,
        1,
      ],
    );

    externalRecordIds.push(insertResult.rows[0]!.id);
  }

  const runResult = await pool.query<{ id: string }>(
    `
      insert into reconciliation_runs (
        source,
        ruleset_checksum,
        input_query,
        result_summary
      )
      values ($1, $2, $3::jsonb, $4::jsonb)
      returning id
    `,
    [
      source,
      "e2e-deal-payment",
      JSON.stringify({ externalRecordIds }),
      JSON.stringify({
        total: externalRecordIds.length,
        matched: 0,
        unmatched: externalRecordIds.length,
        ambiguous: 0,
      }),
    ],
  );
  const runId = runResult.rows[0]!.id;

  for (const externalRecordId of externalRecordIds) {
    await pool.query(
      `
        insert into reconciliation_exceptions (
          run_id,
          external_record_id,
          reason_code,
          state,
          created_at,
          resolved_at
        )
        values ($1, $2, $3, 'resolved', now(), now())
      `,
      [runId, externalRecordId, "e2e_manual_resolution"],
    );
  }

  const verification = await pool.query<{
    operationId: string;
    state: "ignored" | "open" | "resolved";
  }>(
    `
      select
        er.normalized_payload ->> 'operationId' as "operationId",
        e.state as state
      from reconciliation_exceptions e
      inner join reconciliation_external_records er
        on er.id = e.external_record_id
      where e.run_id = $1
    `,
    [runId],
  );
  const resolvedOperationIds = new Set(
    verification.rows
      .filter((row) => row.state === "resolved")
      .map((row) => row.operationId),
  );

  if (!operationIds.every((operationId) => resolvedOperationIds.has(operationId))) {
    throw new Error(
      `Deal ${dealId} reconciliation artifacts were not created for all operations`,
    );
  }

  return {
    operationIds,
    source,
  };
}

export async function closeDealPaymentBackend() {
  await pool.end();
}
