import { OpenAPIHono, z } from "@hono/zod-openapi";

import { ValidationError } from "@bedrock/common/errors";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";

// The accounting router is composed through helper functions that currently
// erase the accumulated Hono schema. Keep this sub-router typed as `any`
// so the generated API client still exposes `/v1/accounting`.
export type AccountingRoutesApp = OpenAPIHono<{ Variables: AuthVariables }, any>;

export interface PaginatedPayload<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export async function readAllPages<T>(
  firstPage: PaginatedPayload<T>,
  loadPage: (input: {
    limit: number;
    offset: number;
  }) => Promise<PaginatedPayload<T>>,
): Promise<T[]> {
  const rows: T[] = [...firstPage.data];
  let offset = firstPage.offset + firstPage.data.length;
  const pageSize = firstPage.limit;

  while (true) {
    if (rows.length >= firstPage.total) {
      break;
    }

    const page = await loadPage({ limit: pageSize, offset });
    if (page.data.length === 0) {
      break;
    }

    rows.push(...page.data);
    offset += page.data.length;
  }

  return rows;
}

export function logReportMetrics(
  ctx: AppContext,
  input: {
    reportKey: string;
    startedAt: number;
    rowCount: number;
    scopeType?: string;
    attributionMode?: string;
    resolvedCounterpartyCount?: number;
  },
) {
  ctx.logger.info("Accounting report generated", {
    reportKey: input.reportKey,
    scopeType: input.scopeType ?? "n/a",
    attributionMode: input.attributionMode ?? "n/a",
    resolvedCounterpartyCount: input.resolvedCounterpartyCount ?? 0,
    durationMs: Date.now() - input.startedAt,
    rowCount: input.rowCount,
  });
}

export function handleAccountingRouteError(
  c: { json: (body: { error: string }, status: 400) => Response },
  error: unknown,
): never {
  if (error instanceof ValidationError || error instanceof z.ZodError) {
    return c.json({ error: error.message }, 400) as never;
  }

  throw error;
}
