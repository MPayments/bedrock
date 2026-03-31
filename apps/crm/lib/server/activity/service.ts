import "server-only";

import { headers } from "next/headers";
import { z } from "zod";

import {
  CrmActivityItemSchema,
  type CrmActivityResponse,
} from "@/lib/activity/contracts";

const ACTIVITY_ENTITY_TYPE_MAP = {
  calculation: "calculation",
  client: "customer",
  contract: "agreement",
  deal: "deal",
  document: "document",
  todo: "task",
} as const;

const upstreamActivityPayloadSchema = z.object({
  data: z.array(
    z.object({
      id: z.union([z.string(), z.number()]),
      action: z.string(),
      entityType: z.string(),
      entityId: z.union([z.string(), z.number()]).nullable().optional(),
      entityTitle: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      metadata: z.record(z.string(), z.unknown()).nullable().optional(),
      createdAt: z.string(),
      userId: z.string().nullable().optional(),
      userName: z.string().nullable().optional(),
    }),
  ),
});

function normalizeActivityRow(row: {
  id: number | string;
  action: string;
  entityType: string;
  entityId?: number | string | null;
  entityTitle?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  userId?: string | null;
  userName?: string | null;
}) {
  const normalizedEntityType =
    ACTIVITY_ENTITY_TYPE_MAP[
      row.entityType as keyof typeof ACTIVITY_ENTITY_TYPE_MAP
    ];

  if (!normalizedEntityType) {
    return null;
  }

  return CrmActivityItemSchema.parse({
    id: String(row.id),
    action: row.action,
    entityType: normalizedEntityType,
    entityId:
      row.entityId === undefined || row.entityId === null
        ? null
        : String(row.entityId),
    entityTitle: row.entityTitle ?? null,
    source: row.source ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
    userId: row.userId ?? null,
    userName: row.userName ?? null,
  });
}

export async function loadCrmActivity(limit: number): Promise<CrmActivityResponse> {
  const requestHeaders = await headers();
  const apiUrl =
    process.env.CRM_ACTIVITY_UPSTREAM_URL ??
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/v1/activity`;
  const url = new URL(apiUrl);
  url.searchParams.set("limit", String(limit));

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        cookie: requestHeaders.get("cookie") ?? "",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return {
        data: [],
        unavailable: true,
      };
    }

    const payload = await response.json();
    const parsed = upstreamActivityPayloadSchema.safeParse(payload);

    if (!parsed.success) {
      return {
        data: [],
        unavailable: true,
      };
    }

    return {
      data: parsed.data.data
        .map(normalizeActivityRow)
        .filter((value): value is NonNullable<typeof value> => value !== null),
      unavailable: false,
    };
  } catch {
    return {
      data: [],
      unavailable: true,
    };
  }
}
