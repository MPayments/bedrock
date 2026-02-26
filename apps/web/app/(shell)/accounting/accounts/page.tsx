import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";

import { AccountingAccountsPageClient } from "./components/accounting-accounts-page-client";
import { getAccountingTemplateAccounts } from "../lib/queries";

export default async function AccountingAccountsPage() {
  const accounts = await getAccountingTemplateAccounts();

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Accounting Accounts (Global)</CardTitle>
          <CardDescription>
            Глобальный план счетов и статус доступности счетов для проводок.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <AccountingAccountsPageClient accounts={accounts} />
        </CardContent>
      </Card>
    </div>
  );
}
