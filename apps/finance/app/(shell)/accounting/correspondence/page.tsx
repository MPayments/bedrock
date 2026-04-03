import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { AccountingCorrespondencePageClient } from "./components/accounting-correspondence-page-client";
import { getAccountingCorrespondenceRules } from "@/features/accounting/lib/queries";

export default async function AccountingCorrespondencePage() {
  const rules = await getAccountingCorrespondenceRules();

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Correspondence Matrix</CardTitle>
          <CardDescription>
            Глобальные правила корреспонденции Dr/Cr с атомарной заменой набора.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <AccountingCorrespondencePageClient rules={rules} />
        </CardContent>
      </Card>
    </div>
  );
}
