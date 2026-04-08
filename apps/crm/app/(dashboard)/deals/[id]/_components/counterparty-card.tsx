import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import type { ApiCustomerCounterparty } from "./types";

type CounterpartyCardProps = {
  partyProfile: ApiCustomerCounterparty | null;
};

export function CounterpartyCard({ partyProfile }: CounterpartyCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          Контрагент клиента
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {partyProfile ? (
          <>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Название
              </div>
              <div className="text-base font-medium">{partyProfile.orgName}</div>
            </div>
            {partyProfile.fullName !== partyProfile.orgName && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Полное наименование
                </div>
                <div className="text-base">{partyProfile.fullName}</div>
              </div>
            )}
            {partyProfile.inn && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  ИНН
                </div>
                <div className="text-base">{partyProfile.inn}</div>
              </div>
            )}
            {partyProfile.kpp && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  КПП
                </div>
                <div className="text-base">{partyProfile.kpp}</div>
              </div>
            )}
            {partyProfile.directorName && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Руководитель
                </div>
                <div className="text-base">{partyProfile.directorName}</div>
                {partyProfile.position && (
                  <div className="text-sm text-muted-foreground">
                    {partyProfile.position}
                  </div>
                )}
              </div>
            )}
            {partyProfile.phone && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Телефон
                </div>
                <div className="text-base">{partyProfile.phone}</div>
              </div>
            )}
            {partyProfile.email && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Email
                </div>
                <div className="text-base">{partyProfile.email}</div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            Для сделки еще не выбран контрагент клиента.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
