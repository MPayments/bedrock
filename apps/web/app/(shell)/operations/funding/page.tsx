import { Landmark } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import { Separator } from "@bedrock/ui/components/separator";

import { FundingPageClient } from "./components/funding-page-client";
import { getExternalFundingFormOptions } from "./lib/queries";

export default async function OperationsFundingPage() {
  const formOptions = await getExternalFundingFormOptions();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="bg-muted rounded-lg p-2.5">
          <Landmark className="text-muted-foreground h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Внешнее пополнение</h3>
          <p className="text-muted-foreground text-sm">
            Ввод средств извне, депозитов клиентов и начальных остатков.
          </p>
        </div>
      </div>
      <Separator className="h-px w-full" />

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Новая операция</CardTitle>
          <CardDescription>
            Создает ledger operation по сценарию external funding/opening balance.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <FundingPageClient formOptions={formOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
