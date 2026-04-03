import { Landmark } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import type { ApiRequisite, ApiRequisiteProvider } from "./types";

type OrganizationRequisiteCardProps = {
  requisite: ApiRequisite;
  provider: ApiRequisiteProvider | null;
};

export function OrganizationRequisiteCard({
  requisite,
  provider,
}: OrganizationRequisiteCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-muted-foreground" />
          Реквизиты организации
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            Реквизит
          </div>
          <div className="text-base font-medium">{requisite.label}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">Банк</div>
          <div className="text-base">{provider?.name || "—"}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            Счет / IBAN
          </div>
          <div className="break-all font-mono text-sm">
            {requisite.accountNo || requisite.iban || "—"}
          </div>
        </div>
        {requisite.corrAccount && (
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Корр. счет
            </div>
            <div className="break-all font-mono text-sm">
              {requisite.corrAccount}
            </div>
          </div>
        )}
        {provider?.bic && (
          <div>
            <div className="text-sm font-medium text-muted-foreground">BIC</div>
            <div className="font-mono text-sm">{provider.bic}</div>
          </div>
        )}
        {provider?.swift && (
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              SWIFT
            </div>
            <div className="font-mono text-sm">{provider.swift}</div>
          </div>
        )}
        {provider?.address && (
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Адрес банка
            </div>
            <div className="text-base">{provider.address}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
