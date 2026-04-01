import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import type { ApiCustomerLegalEntity } from "./types";

type LegalEntityCardProps = {
  legalEntity: ApiCustomerLegalEntity | null;
};

export function LegalEntityCard({ legalEntity }: LegalEntityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          Юридическое лицо клиента
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {legalEntity ? (
          <>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Название
              </div>
              <div className="text-base font-medium">{legalEntity.orgName}</div>
            </div>
            {legalEntity.fullName !== legalEntity.orgName && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Полное наименование
                </div>
                <div className="text-base">{legalEntity.fullName}</div>
              </div>
            )}
            {legalEntity.inn && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  ИНН
                </div>
                <div className="text-base">{legalEntity.inn}</div>
              </div>
            )}
            {legalEntity.kpp && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  КПП
                </div>
                <div className="text-base">{legalEntity.kpp}</div>
              </div>
            )}
            {legalEntity.directorName && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Руководитель
                </div>
                <div className="text-base">{legalEntity.directorName}</div>
                {legalEntity.position && (
                  <div className="text-sm text-muted-foreground">
                    {legalEntity.position}
                  </div>
                )}
              </div>
            )}
            {legalEntity.phone && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Телефон
                </div>
                <div className="text-base">{legalEntity.phone}</div>
              </div>
            )}
            {legalEntity.email && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Email
                </div>
                <div className="text-base">{legalEntity.email}</div>
              </div>
            )}
            {legalEntity.subAgent && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Субагент
                </div>
                <div className="text-base">
                  {legalEntity.subAgent.shortName} ·{" "}
                  {legalEntity.subAgent.commissionRate}%
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            Для сделки еще не выбрано юридическое лицо клиента.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
