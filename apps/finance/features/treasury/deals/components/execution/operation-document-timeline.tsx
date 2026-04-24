"use client";

import Link from "next/link";

import { DOCUMENT_KIND_TO_OPERATION_PROJECTION } from "@bedrock/treasury/contracts";
import type { TreasuryOperationKind } from "@bedrock/treasury/contracts";

import { Badge } from "@bedrock/sdk-ui/components/badge";

import { buildDocumentDetailsHref } from "@/features/documents/lib/routes";
import { getDocumentTypeLabel } from "@/features/documents/lib/doc-types";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

type FormalDocument = FinanceDealWorkbench["relatedResources"]["formalDocuments"][number];

export interface OperationDocumentTimelineProps {
  formalDocuments: readonly FormalDocument[];
  operationKind: TreasuryOperationKind;
}

function isRelevantToOperation(docType: string, kind: TreasuryOperationKind) {
  const entry = DOCUMENT_KIND_TO_OPERATION_PROJECTION[docType];
  return entry?.applicableOpKind === kind;
}

export function OperationDocumentTimeline({
  formalDocuments,
  operationKind,
}: OperationDocumentTimelineProps) {
  const relevant = formalDocuments.filter((doc) =>
    isRelevantToOperation(doc.docType, operationKind),
  );

  if (relevant.length === 0) {
    return null;
  }

  return (
    <ul className="mt-2 flex flex-col gap-1 text-xs">
      {relevant.map((doc) => {
        const href = buildDocumentDetailsHref(doc.docType, doc.id);
        const label = getDocumentTypeLabel(doc.docType);
        const isPosted = doc.postingStatus === "posted";

        return (
          <li
            key={doc.id}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <Badge variant={isPosted ? "default" : "outline"}>{label}</Badge>
            <span>{isPosted ? "запостен" : (doc.postingStatus ?? "черновик")}</span>
            {href ? (
              <Link
                className="text-primary hover:underline"
                href={href}
              >
                Открыть
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
