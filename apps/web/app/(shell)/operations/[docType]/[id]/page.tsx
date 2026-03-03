import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import { Badge } from "@bedrock/ui/components/badge";
import { Separator } from "@bedrock/ui/components/separator";

import { formatDate } from "@/lib/format";
import { getDocumentDetails } from "@/features/operations/documents/lib/queries";

interface PageProps {
  params: Promise<{ docType: string; id: string }>;
}

function StatusBadges({
  submissionStatus,
  approvalStatus,
  postingStatus,
  lifecycleStatus,
}: {
  submissionStatus: string;
  approvalStatus: string;
  postingStatus: string;
  lifecycleStatus: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{submissionStatus}</Badge>
      <Badge variant="outline">{approvalStatus}</Badge>
      <Badge variant="outline">{postingStatus}</Badge>
      <Badge variant="outline">{lifecycleStatus}</Badge>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export default async function OperationDocumentPage({ params }: PageProps) {
  const { docType, id } = await params;

  const details = await getDocumentDetails(docType, id);

  if (!details) {
    notFound();
  }

  const document = details.document;
  const computed = isRecord(details.computed) ? details.computed : null;
  const timeline = Array.isArray(computed?.timeline) ? computed.timeline : null;
  const separateFeeComponents = Array.isArray(computed?.separateFeeComponents)
    ? computed.separateFeeComponents
    : null;

  return (
    <div className="space-y-6">
      <Card className="rounded-sm">
        <CardHeader className="gap-4 border-b">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{document.docNo}</CardTitle>
              <CardDescription>{document.title}</CardDescription>
              <StatusBadges
                submissionStatus={document.submissionStatus}
                approvalStatus={document.approvalStatus}
                postingStatus={document.postingStatus}
                lifecycleStatus={document.lifecycleStatus}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 py-6 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Тип:</span> {document.docType}
            </div>
            <div>
              <span className="text-muted-foreground">Дата:</span>{" "}
              {formatDate(document.occurredAt)}
            </div>
            <div>
              <span className="text-muted-foreground">Создан:</span>{" "}
              {formatDate(document.createdAt)}
            </div>
            {document.postingOperationId ? (
              <div>
                <span className="text-muted-foreground">Ledger:</span>{" "}
                <Link
                  href={`/operations/journal/${document.postingOperationId}`}
                  className="font-mono hover:underline"
                >
                  {document.postingOperationId}
                </Link>
              </div>
            ) : null}
          </div>
          <div className="space-y-2 text-sm">
            {document.currency ? (
              <div>
                <span className="text-muted-foreground">Валюта:</span>{" "}
                {document.currency}
              </div>
            ) : null}
            {document.amountMinor ? (
              <div>
                <span className="text-muted-foreground">Сумма minor:</span>{" "}
                {document.amountMinor}
              </div>
            ) : null}
            {document.memo ? (
              <div>
                <span className="text-muted-foreground">Memo:</span> {document.memo}
              </div>
            ) : null}
            {document.postingError ? (
              <div className="text-destructive">
                <span className="text-muted-foreground">Posting error:</span>{" "}
                {document.postingError}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Payload</CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <pre className="bg-muted overflow-x-auto rounded-sm p-4 text-xs">
            {JSON.stringify(document.payload, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {timeline ? (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-6">
            {timeline.length === 0 ? (
              <div className="text-muted-foreground text-sm">Этапы еще не созданы.</div>
            ) : (
              timeline.map((item) => {
                if (!isRecord(item)) {
                  return null;
                }

                const itemId = typeof item.id === "string" ? item.id : "";
                const itemDocType =
                  typeof item.docType === "string" ? item.docType : "document";
                const itemDocNo = typeof item.docNo === "string" ? item.docNo : itemId;
                const itemTitle =
                  typeof item.title === "string" ? item.title : itemDocType;
                const itemPostingStatus =
                  typeof item.postingStatus === "string"
                    ? item.postingStatus
                    : "unknown";

                return (
                  <div
                    key={itemId}
                    className="flex flex-col gap-2 rounded-sm border p-3 text-sm md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <Link
                        href={`/operations/${itemDocType}/${itemId}`}
                        className="font-medium hover:underline"
                      >
                        {itemDocNo}
                      </Link>
                      <div className="text-muted-foreground">{itemTitle}</div>
                    </div>
                    <Badge variant="outline">{itemPostingStatus}</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : null}

      {separateFeeComponents ? (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Separate Fee Components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-6">
            {separateFeeComponents.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                Отдельных fee payout компонентов нет.
              </div>
            ) : (
              separateFeeComponents.map((item, index) => {
                if (!isRecord(item)) {
                  return null;
                }

                return (
                  <div key={`${String(item.componentId ?? index)}`} className="rounded-sm border p-3 text-sm">
                    <div className="font-medium">{String(item.componentId ?? "component")}</div>
                    <div className="text-muted-foreground">
                      {String(item.kind ?? "")} / {String(item.currency ?? "")} /{" "}
                      {String(item.amountMinor ?? "")}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : null}

      {details.computed ? (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Computed</CardTitle>
          </CardHeader>
          <CardContent className="py-6">
            <pre className="bg-muted overflow-x-auto rounded-sm p-4 text-xs">
              {JSON.stringify(details.computed, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Связанные документы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 py-6 text-sm">
          {details.parent ? (
            <div>
              <div className="text-muted-foreground mb-2">Parent</div>
              <Link
                href={`/operations/${details.parent.docType}/${details.parent.id}`}
                className="hover:underline"
              >
                {details.parent.docNo}
              </Link>
            </div>
          ) : null}
          {details.dependsOn.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-2">Depends on</div>
              <div className="flex flex-col gap-2">
                {details.dependsOn.map((item) => (
                  <Link
                    key={item.id}
                    href={`/operations/${item.docType}/${item.id}`}
                    className="hover:underline"
                  >
                    {item.docNo}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {details.children.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-2">Children</div>
              <div className="flex flex-col gap-2">
                {details.children.map((item) => (
                  <Link
                    key={item.id}
                    href={`/operations/${item.docType}/${item.id}`}
                    className="hover:underline"
                  >
                    {item.docNo}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {details.compensates.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-2">Compensates</div>
              <div className="flex flex-col gap-2">
                {details.compensates.map((item) => (
                  <Link
                    key={item.id}
                    href={`/operations/${item.docType}/${item.id}`}
                    className="hover:underline"
                  >
                    {item.docNo}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Ledger operations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 py-6">
          {details.documentOperations.length === 0 ? (
            <div className="text-muted-foreground text-sm">Нет связанных операций.</div>
          ) : (
            details.documentOperations.map((operation, index) => (
              <div key={operation.id} className="space-y-2">
                {index > 0 ? <Separator /> : null}
                <div className="text-sm">
                  <Link
                    href={`/operations/journal/${operation.operationId}`}
                    className="font-mono hover:underline"
                  >
                    {operation.operationId}
                  </Link>
                </div>
                <pre className="bg-muted overflow-x-auto rounded-sm p-4 text-xs">
                  {JSON.stringify(details.ledgerOperations[index] ?? null, null, 2)}
                </pre>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
