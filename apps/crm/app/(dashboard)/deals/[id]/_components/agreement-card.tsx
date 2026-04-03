import { FileText } from "lucide-react";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import { formatDateShort } from "./format";
import type { ApiAgreementDetails } from "./types";
import { formatAgreementFeeRuleLabel } from "@/lib/utils/agreement-fee-format";

type AgreementCardProps = {
  agreement: ApiAgreementDetails;
};

export function AgreementCard({ agreement }: AgreementCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          Агентский договор
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant={agreement.isActive ? "default" : "secondary"}>
            {agreement.isActive ? "Действует" : "Не активен"}
          </Badge>
          <div className="text-sm text-muted-foreground">
            Версия {agreement.currentVersion.versionNumber}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            Номер договора
          </div>
          <div className="text-base">
            {agreement.currentVersion.contractNumber || "—"}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            Дата договора
          </div>
          <div className="text-base">
            {formatDateShort(agreement.currentVersion.contractDate)}
          </div>
        </div>
        {agreement.currentVersion.feeRules.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Условия
            </div>
            {agreement.currentVersion.feeRules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                {formatAgreementFeeRuleLabel(rule)}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
