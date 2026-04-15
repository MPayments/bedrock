import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import type { ApiOrganization } from "./types";

type OrganizationCardProps = {
  organization: ApiOrganization | null;
};

function findOrganizationIdentifier(
  organization: ApiOrganization,
  scheme: string,
) {
  return (
    organization.partyProfile?.identifiers.find(
      (identifier) => identifier.scheme === scheme,
    )?.value ?? null
  );
}

export function OrganizationCard({ organization }: OrganizationCardProps) {
  const inn = organization
    ? findOrganizationIdentifier(organization, "inn")
    : null;
  const kpp = organization
    ? findOrganizationIdentifier(organization, "kpp")
    : null;
  const address = organization?.partyProfile?.address?.fullAddress ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          Организация агента
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {organization ? (
          <>
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
            {inn && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">ИНН</div>
                <div className="text-base">{inn}</div>
              </div>
            )}
            {kpp && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">КПП</div>
                <div className="text-base">{kpp}</div>
              </div>
            )}
            {address && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Адрес
                </div>
                <div className="text-base">{address}</div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            Организация агента для сделки пока не определена.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
