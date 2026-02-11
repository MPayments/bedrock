import { and, eq, sql } from "drizzle-orm";
import { type Database } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { type Logger, noopLogger } from "@bedrock/kernel";
import { TreasuryOrderStatus } from "./state-machine";

const RECON_SOURCE = "treasury_reconciliation";

type Severity = "critical" | "high" | "medium" | "low";

type ReconIssue = {
    entityType: string;
    entityId: string;
    issueCode: string;
    severity: Severity;
    summary: string;
    details?: string;
};

function dueAtFrom(now: Date, minutes: number): Date {
    return new Date(now.getTime() + minutes * 60 * 1000);
}

function issueKey(issue: Pick<ReconIssue, "entityType" | "entityId" | "issueCode">): string {
    return `${issue.entityType}:${issue.entityId}:${issue.issueCode}`;
}

export function createTreasuryReconciliationWorker(deps: {
    db: Database;
    treasuryOrgId?: string;
    logger?: Logger;
    defaultSlaMinutes?: number;
}) {
    const { db, treasuryOrgId } = deps;
    const log = deps.logger?.child({ svc: "treasury_reconciliation" }) ?? noopLogger;

    async function processOnce(opts?: {
        batchSize?: number;
        slaMinutes?: number;
        finalizationLagMinutes?: number;
    }) {
        const batchSize = opts?.batchSize ?? 200;
        const slaMinutes = opts?.slaMinutes ?? deps.defaultSlaMinutes ?? 30;
        const finalizationLagMinutes = opts?.finalizationLagMinutes ?? Math.max(5, Math.floor(slaMinutes / 3));
        const now = new Date();
        const dueAt = dueAtFrom(now, slaMinutes);
        const scopeKey = treasuryOrgId ?? "all_treasuries";

        const issues: ReconIssue[] = [];

        const stuckPending = await db.execute(sql`
      SELECT
        o.id as order_id,
        o.status as order_status,
        o.updated_at as updated_at,
        j.id as journal_entry_id
      FROM ${schema.paymentOrders} o
      JOIN ${schema.journalEntries} j ON j.id = o.ledger_entry_id
      WHERE o.status LIKE '%_pending_posting'
        AND j.status = 'pending'
        AND o.updated_at <= now() - (${slaMinutes} || ' minutes')::interval
        ${treasuryOrgId ? sql`AND o.treasury_org_id = ${treasuryOrgId}` : sql``}
      ORDER BY o.updated_at
      LIMIT ${batchSize}
    `);

        for (const row of (stuckPending.rows ?? []) as Array<{ order_id: string; order_status: string; updated_at: Date; journal_entry_id: string }>) {
            issues.push({
                entityType: "payment_order",
                entityId: row.order_id,
                issueCode: "ORDER_STUCK_PENDING_POSTING",
                severity: "high",
                summary: `Order ${row.order_id} is stuck in ${row.order_status} while journal ${row.journal_entry_id} is pending`,
                details: `updated_at=${row.updated_at.toISOString()}`,
            });
        }

        const finalizationLag = await db.execute(sql`
      SELECT
        o.id as order_id,
        o.status as order_status,
        j.id as journal_entry_id,
        j.status as journal_status,
        o.updated_at as updated_at
      FROM ${schema.paymentOrders} o
      JOIN ${schema.journalEntries} j ON j.id = o.ledger_entry_id
      WHERE o.status LIKE '%_pending_posting'
        AND j.status IN ('posted', 'failed')
        AND o.updated_at <= now() - (${finalizationLagMinutes} || ' minutes')::interval
        ${treasuryOrgId ? sql`AND o.treasury_org_id = ${treasuryOrgId}` : sql``}
      ORDER BY o.updated_at
      LIMIT ${batchSize}
    `);

        for (const row of (finalizationLag.rows ?? []) as Array<{ order_id: string; order_status: string; journal_entry_id: string; journal_status: string; updated_at: Date }>) {
            issues.push({
                entityType: "payment_order",
                entityId: row.order_id,
                issueCode: "ORDER_FINALIZATION_LAG",
                severity: "high",
                summary: `Order ${row.order_id} remains ${row.order_status} while journal ${row.journal_entry_id} is ${row.journal_status}`,
                details: `updated_at=${row.updated_at.toISOString()}`,
            });
        }

        const missingJournal = await db.execute(sql`
      SELECT
        o.id as order_id,
        o.status as order_status,
        o.ledger_entry_id as ledger_entry_id
      FROM ${schema.paymentOrders} o
      LEFT JOIN ${schema.journalEntries} j ON j.id = o.ledger_entry_id
      WHERE o.ledger_entry_id IS NOT NULL
        AND j.id IS NULL
        ${treasuryOrgId ? sql`AND o.treasury_org_id = ${treasuryOrgId}` : sql``}
      LIMIT ${batchSize}
    `);

        for (const row of (missingJournal.rows ?? []) as Array<{ order_id: string; order_status: string; ledger_entry_id: string }>) {
            issues.push({
                entityType: "payment_order",
                entityId: row.order_id,
                issueCode: "MISSING_JOURNAL_ENTRY",
                severity: "critical",
                summary: `Order ${row.order_id} in ${row.order_status} references missing journal ${row.ledger_entry_id}`,
            });
        }

        const planMismatch = await db.execute(sql`
      SELECT DISTINCT
        o.id as order_id,
        j.id as journal_entry_id
      FROM ${schema.paymentOrders} o
      JOIN ${schema.journalEntries} j ON j.id = o.ledger_entry_id
      JOIN ${schema.tbTransferPlans} p ON p.journal_entry_id = j.id
      WHERE j.status = 'posted'
        AND p.status <> 'posted'
        ${treasuryOrgId ? sql`AND o.treasury_org_id = ${treasuryOrgId}` : sql``}
      LIMIT ${batchSize}
    `);

        for (const row of (planMismatch.rows ?? []) as Array<{ order_id: string; journal_entry_id: string }>) {
            issues.push({
                entityType: "journal_entry",
                entityId: row.journal_entry_id,
                issueCode: "POSTED_JOURNAL_PLAN_MISMATCH",
                severity: "critical",
                summary: `Journal ${row.journal_entry_id} is posted but has non-posted transfer plans (order=${row.order_id})`,
            });
        }

        const railMismatch = await db.execute(sql`
      SELECT
        s.id as settlement_id,
        s.order_id as order_id,
        s.kind as kind,
        o.status as order_status
      FROM ${schema.settlements} s
      JOIN ${schema.paymentOrders} o ON o.id = s.order_id
      WHERE s.status = 'settled'
        AND (
          (s.kind = 'funding' AND o.status IN (${TreasuryOrderStatus.QUOTE}, ${TreasuryOrderStatus.FUNDING_PENDING}))
          OR
          (s.kind = 'payout' AND o.status NOT IN (${TreasuryOrderStatus.CLOSED_PENDING_POSTING}, ${TreasuryOrderStatus.CLOSED}))
        )
        ${treasuryOrgId ? sql`AND o.treasury_org_id = ${treasuryOrgId}` : sql``}
      LIMIT ${batchSize}
    `);

        for (const row of (railMismatch.rows ?? []) as Array<{ settlement_id: string; order_id: string; kind: string; order_status: string }>) {
            issues.push({
                entityType: "settlement",
                entityId: row.settlement_id,
                issueCode: "RAIL_EVENT_ORDER_STATE_MISMATCH",
                severity: "high",
                summary: `Settlement ${row.settlement_id} (${row.kind}) is settled but order ${row.order_id} is ${row.order_status}`,
            });
        }

        const detectedKeys = new Set<string>();
        for (const issue of issues) {
            detectedKeys.add(issueKey(issue));
            await db
                .insert(schema.reconciliationExceptions)
                .values({
                    source: RECON_SOURCE,
                    scopeKey,
                    entityType: issue.entityType,
                    entityId: issue.entityId,
                    issueCode: issue.issueCode,
                    severity: issue.severity,
                    status: "open",
                    summary: issue.summary,
                    details: issue.details ?? null,
                    dueAt,
                })
                .onConflictDoUpdate({
                    target: [
                        schema.reconciliationExceptions.source,
                        schema.reconciliationExceptions.scopeKey,
                        schema.reconciliationExceptions.entityType,
                        schema.reconciliationExceptions.entityId,
                        schema.reconciliationExceptions.issueCode,
                    ],
                    set: {
                        severity: issue.severity,
                        status: "open",
                        summary: issue.summary,
                        details: issue.details ?? null,
                        dueAt,
                        lastSeenAt: sql`now()`,
                        resolvedAt: null,
                    },
                });
        }

        // Mark no-longer-present issues as resolved.
        const openIssues = await db
            .select({
                id: schema.reconciliationExceptions.id,
                entityType: schema.reconciliationExceptions.entityType,
                entityId: schema.reconciliationExceptions.entityId,
                issueCode: schema.reconciliationExceptions.issueCode,
            })
            .from(schema.reconciliationExceptions)
            .where(
                and(
                    eq(schema.reconciliationExceptions.source, RECON_SOURCE),
                    eq(schema.reconciliationExceptions.scopeKey, scopeKey),
                    eq(schema.reconciliationExceptions.status, "open")
                )
            )
            .limit(5000);

        let resolved = 0;
        for (const issue of openIssues) {
            if (detectedKeys.has(issueKey(issue))) continue;
            await db
                .update(schema.reconciliationExceptions)
                .set({
                    status: "resolved",
                    resolvedAt: sql`now()`,
                    lastSeenAt: sql`now()`,
                })
                .where(eq(schema.reconciliationExceptions.id, issue.id));
            resolved++;
        }

        log.info("treasury reconciliation completed", {
            scopeKey,
            detected: issues.length,
            openNow: detectedKeys.size,
            resolved,
            slaMinutes,
            finalizationLagMinutes,
        });

        return {
            detected: issues.length,
            resolved,
            openAfterRun: detectedKeys.size,
        };
    }

    return { processOnce };
}
