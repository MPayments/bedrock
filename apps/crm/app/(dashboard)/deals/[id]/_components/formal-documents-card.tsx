import { PackageOpen } from "lucide-react";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import { FORMAL_DOCUMENT_LABELS } from "./constants";
import { formatCurrency, formatDate } from "./format";
import type { ApiFormalDocument } from "./types";

type FormalDocumentsCardProps = {
  documents: ApiFormalDocument[];
};

export function FormalDocumentsCard({ documents }: FormalDocumentsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageOpen className="h-5 w-5 text-muted-foreground" />
          Формальные документы
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            По сделке еще нет формальных документов.
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((document) => (
              <div
                key={document.id}
                className="rounded-lg border p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="font-medium">
                      {document.title ||
                        FORMAL_DOCUMENT_LABELS[document.docType] ||
                        document.docType}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {document.docType} · {formatDate(document.createdAt)}
                    </div>
                    {document.amount && (
                      <div className="text-sm">
                        {formatCurrency(document.amount, document.currency)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      submission: {document.submissionStatus}
                    </Badge>
                    <Badge variant="outline">
                      approval: {document.approvalStatus}
                    </Badge>
                    <Badge variant="outline">
                      posting: {document.postingStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
