import { z } from "zod";

import { resolveApiPath } from "@/lib/api/path";

import { buildTreasuryQuoteDetailsHref } from "./routes";

const FxExecuteDocumentDetailsResponseSchema = z.object({
  document: z.object({
    payload: z.object({
      quoteSnapshot: z.object({
        quoteId: z.string().min(1),
      }),
    }),
  }),
});

export async function resolveTreasuryFxCreatedDocumentHref(input: {
  documentId: string;
  fallbackHref?: string;
}): Promise<string> {
  const fallbackHref = input.fallbackHref ?? "/treasury/quotes";

  try {
    const response = await fetch(
      resolveApiPath(`/v1/documents/fx_execute/${encodeURIComponent(input.documentId)}/details`),
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return fallbackHref;
    }

    const parsed = FxExecuteDocumentDetailsResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return fallbackHref;
    }

    return buildTreasuryQuoteDetailsHref(
      parsed.data.document.payload.quoteSnapshot.quoteId,
    );
  } catch {
    return fallbackHref;
  }
}
