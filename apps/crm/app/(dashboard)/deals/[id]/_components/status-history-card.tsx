import { FileText } from "lucide-react";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import { STATUS_COLORS, STATUS_LABELS } from "./constants";
import { formatDate } from "./format";
import type { ApiDealStatusHistory } from "./types";

type StatusHistoryCardProps = {
  statusHistory: ApiDealStatusHistory[];
};

export function StatusHistoryCard({ statusHistory }: StatusHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          История статусов
        </CardTitle>
      </CardHeader>
      <CardContent>
        {statusHistory.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            История статусов отсутствует.
          </div>
        ) : (
          <div className="space-y-3">
            {statusHistory.map((entry) => (
              <div key={entry.id} className="border-l-2 pl-3">
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_COLORS[entry.status]}>
                    {STATUS_LABELS[entry.status]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
                {entry.comment && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {entry.comment}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
