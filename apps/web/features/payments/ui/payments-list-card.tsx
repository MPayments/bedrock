import Link from "next/link";

import { Badge } from "@bedrock/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import { formatAmountByCurrency, formatDate } from "@/lib/format";

import type { PaymentDocumentDto } from "../lib/api";

function formatAmount(document: PaymentDocumentDto) {
  if (!document.amount) {
    return "—";
  }
  if (!document.currency) {
    return document.amount;
  }
  return `${formatAmountByCurrency(document.amount, document.currency)} ${document.currency}`;
}

export function PaymentsListCard({
  title,
  description,
  rows,
  detailsBasePath,
}: {
  title: string;
  description: string;
  rows: PaymentDocumentDto[];
  detailsBasePath?: string;
}) {
  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="py-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Документ</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Сумма</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Обновлен</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-12 text-center">
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {detailsBasePath ? (
                      <Link
                        href={`${detailsBasePath}/${row.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.docNo}
                      </Link>
                    ) : (
                      <span className="font-medium">{row.docNo}</span>
                    )}
                    <div className="text-muted-foreground mt-1 text-xs">{row.title}</div>
                  </TableCell>
                  <TableCell>{row.docType}</TableCell>
                  <TableCell>{formatAmount(row)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{row.submissionStatus}</Badge>
                      <Badge variant="outline">{row.approvalStatus}</Badge>
                      <Badge variant="outline">{row.postingStatus}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(row.updatedAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
