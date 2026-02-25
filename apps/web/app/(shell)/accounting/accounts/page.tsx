import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";

import { isUuid } from "@/lib/resources/http";

import { AccountingAccountsPageClient } from "./components/accounting-accounts-page-client";
import {
  getAccountingOrgAccounts,
  getAccountingOrgOptions,
} from "../lib/queries";

interface AccountingAccountsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getOrgIdFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const value = searchParams.orgId;
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || !isUuid(candidate)) {
    return null;
  }

  return candidate;
}

export default async function AccountingAccountsPage({
  searchParams,
}: AccountingAccountsPageProps) {
  const rawSearchParams = await searchParams;
  const orgOptions = await getAccountingOrgOptions();
  const selectedOrgIdFromQuery = getOrgIdFromSearchParams(rawSearchParams);
  const selectedOrgId =
    selectedOrgIdFromQuery ??
    orgOptions[0]?.id ??
    null;

  const accounts = selectedOrgId
    ? await getAccountingOrgAccounts(selectedOrgId)
    : [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Accounting Accounts (Org Overlay)</CardTitle>
          <CardDescription>
            Управление effective планом счетов организации и org overrides.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <AccountingAccountsPageClient
            orgId={selectedOrgId}
            orgOptions={orgOptions}
            accounts={accounts}
          />
        </CardContent>
      </Card>
    </div>
  );
}
