import { z } from "zod";

import { API_BASE_URL } from "@/lib/constants";

export const CrmDocumentDetailSchema = z.object({
  id: z.string(),
  docType: z.string(),
  docNo: z.string(),
  title: z.string().nullish(),
  payload: z.record(z.string(), z.unknown()).nullish(),
  submissionStatus: z.string(),
  approvalStatus: z.string(),
  postingStatus: z.string(),
  lifecycleStatus: z.string(),
  allowedActions: z
    .array(
      z.enum(["edit", "submit", "approve", "reject", "post", "cancel", "repost"]),
    )
    .default([]),
  occurredAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  amount: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
});

export type CrmDocumentDetail = z.infer<typeof CrmDocumentDetailSchema>;

export async function fetchCrmDocumentById(input: {
  docType: string;
  documentId: string;
}): Promise<CrmDocumentDetail | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/documents/${encodeURIComponent(input.docType)}/${encodeURIComponent(input.documentId)}`,
      {
        cache: "no-store",
        credentials: "include",
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    return CrmDocumentDetailSchema.parse(payload);
  } catch {
    return null;
  }
}
