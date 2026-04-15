import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import type { ApiCanonicalCounterparty } from "./types";

type CounterpartyCardProps = {
  counterparty: ApiCanonicalCounterparty | null;
};

function pickPrimary<T extends { isPrimary: boolean }>(items: T[]) {
  return items.find((item) => item.isPrimary) ?? items[0] ?? null;
}

function findCounterpartyIdentifier(
  counterparty: ApiCanonicalCounterparty,
  scheme: string,
) {
  return (
    counterparty.partyProfile?.identifiers.find(
      (identifier) => identifier.scheme === scheme,
    )?.value ?? null
  );
}

function findCounterpartyContact(
  counterparty: ApiCanonicalCounterparty,
  type: string,
) {
  return (
    pickPrimary(
      (counterparty.partyProfile?.contacts ?? []).filter(
        (contact) => contact.type === type,
      ),
    )?.value ?? null
  );
}

function findCounterpartyRepresentative(
  counterparty: ApiCanonicalCounterparty,
  roles: string[] = ["director", "signatory", "contact"],
) {
  for (const role of roles) {
    const representative = pickPrimary(
      (counterparty.partyProfile?.representatives ?? []).filter(
        (item) => item.role === role,
      ),
    );

    if (representative) {
      return representative;
    }
  }

  return pickPrimary(counterparty.partyProfile?.representatives ?? []);
}

export function CounterpartyCard({ counterparty }: CounterpartyCardProps) {
  const representative = counterparty
    ? findCounterpartyRepresentative(counterparty)
    : null;
  const inn = counterparty
    ? (findCounterpartyIdentifier(counterparty, "inn") ??
      counterparty.externalRef ??
      null)
    : null;
  const kpp = counterparty
    ? findCounterpartyIdentifier(counterparty, "kpp")
    : null;
  const phone = counterparty ? findCounterpartyContact(counterparty, "phone") : null;
  const email = counterparty ? findCounterpartyContact(counterparty, "email") : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          Контрагент клиента
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {counterparty ? (
          <>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Название
              </div>
              <div className="text-base font-medium">{counterparty.shortName}</div>
            </div>
            {counterparty.fullName !== counterparty.shortName && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Полное наименование
                </div>
                <div className="text-base">{counterparty.fullName}</div>
              </div>
            )}
            {inn && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  ИНН
                </div>
                <div className="text-base">{inn}</div>
              </div>
            )}
            {kpp && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  КПП
                </div>
                <div className="text-base">{kpp}</div>
              </div>
            )}
            {representative?.fullName && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Руководитель
                </div>
                <div className="text-base">{representative.fullName}</div>
                {representative.title && (
                  <div className="text-sm text-muted-foreground">
                    {representative.title}
                  </div>
                )}
              </div>
            )}
            {phone && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Телефон
                </div>
                <div className="text-base">{phone}</div>
              </div>
            )}
            {email && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Email
                </div>
                <div className="text-base">{email}</div>
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
