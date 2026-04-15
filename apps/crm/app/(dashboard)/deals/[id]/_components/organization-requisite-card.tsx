import { Landmark } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import type { ApiRequisite, ApiRequisiteProvider } from "./types";

type OrganizationRequisiteCardProps = {
  requisite: ApiRequisite | null;
  provider: ApiRequisiteProvider | null;
};

function findRequisiteIdentifier(
  requisite: ApiRequisite,
  scheme: string,
) {
  return (
    requisite.identifiers.find((identifier) => identifier.scheme === scheme)
      ?.value ?? null
  );
}

function getPrimaryProviderBranch(provider: ApiRequisiteProvider) {
  return provider.branches.find((branch) => branch.isPrimary) ?? provider.branches[0] ?? null;
}

function findProviderIdentifier(
  provider: ApiRequisiteProvider,
  scheme: string,
) {
  const primaryBranch = getPrimaryProviderBranch(provider);

  return (
    primaryBranch?.identifiers.find((identifier) => identifier.scheme === scheme)
      ?.value ??
    provider.identifiers.find((identifier) => identifier.scheme === scheme)
      ?.value ??
    null
  );
}

function formatProviderAddress(provider: ApiRequisiteProvider) {
  const primaryBranch = getPrimaryProviderBranch(provider);

  if (!primaryBranch) {
    return null;
  }

  if (primaryBranch.rawAddress) {
    return primaryBranch.rawAddress;
  }

  const parts = [
    primaryBranch.line1,
    primaryBranch.line2,
    primaryBranch.city,
    primaryBranch.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

export function OrganizationRequisiteCard({
  requisite,
  provider,
}: OrganizationRequisiteCardProps) {
  const accountNo = requisite
    ? findRequisiteIdentifier(requisite, "local_account_number")
    : null;
  const iban = requisite ? findRequisiteIdentifier(requisite, "iban") : null;
  const corrAccount = requisite
    ? findRequisiteIdentifier(requisite, "corr_account")
    : null;
  const providerName = provider?.displayName ?? provider?.legalName ?? "—";
  const bic = provider ? findProviderIdentifier(provider, "bic") : null;
  const swift = provider ? findProviderIdentifier(provider, "swift") : null;
  const providerAddress = provider ? formatProviderAddress(provider) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-muted-foreground" />
          Реквизиты организации
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requisite ? (
          <>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Реквизит
              </div>
              <div className="text-base font-medium">{requisite.label}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Банк</div>
              <div className="text-base">{providerName}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Счет / IBAN
              </div>
              <div className="break-all font-mono text-sm">
                {accountNo || iban || "—"}
              </div>
            </div>
            {corrAccount && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Корр. счет
                </div>
                <div className="break-all font-mono text-sm">
                  {corrAccount}
                </div>
              </div>
            )}
            {bic && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">BIC</div>
                <div className="font-mono text-sm">{bic}</div>
              </div>
            )}
            {swift && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  SWIFT
                </div>
                <div className="font-mono text-sm">{swift}</div>
              </div>
            )}
            {providerAddress && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Адрес банка
                </div>
                <div className="text-base">{providerAddress}</div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            Реквизиты организации для сделки пока не определены.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
