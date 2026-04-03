import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import type { ApiOrganization } from "./types";

type OrganizationCardProps = {
  organization: ApiOrganization;
};

export function OrganizationCard({ organization }: OrganizationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          Организация агента
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            Название
          </div>
          <div className="text-base font-medium">
            {organization.shortName}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            Полное наименование
          </div>
          <div className="text-base">{organization.fullName}</div>
        </div>
        {organization.inn && (
          <div>
            <div className="text-sm font-medium text-muted-foreground">ИНН</div>
            <div className="text-base">{organization.inn}</div>
          </div>
        )}
        {organization.kpp && (
          <div>
            <div className="text-sm font-medium text-muted-foreground">КПП</div>
            <div className="text-base">{organization.kpp}</div>
          </div>
        )}
        {organization.address && (
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Адрес
            </div>
            <div className="text-base">{organization.address}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
