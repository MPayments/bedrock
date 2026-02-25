import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";

import { isUuid } from "@/lib/resources/http";

import { AccountingCorrespondencePageClient } from "./components/accounting-correspondence-page-client";
import {
  getAccountingCorrespondenceRules,
  getAccountingOrgOptions,
} from "../lib/queries";

interface AccountingCorrespondencePageProps {
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

export default async function AccountingCorrespondencePage({
  searchParams,
}: AccountingCorrespondencePageProps) {
  const rawSearchParams = await searchParams;
  const orgOptions = await getAccountingOrgOptions();
  const selectedOrgIdFromQuery = getOrgIdFromSearchParams(rawSearchParams);
  const selectedOrgId = selectedOrgIdFromQuery ?? orgOptions[0]?.id ?? null;

  const rules = selectedOrgId
    ? await getAccountingCorrespondenceRules(selectedOrgId)
    : [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Correspondence Matrix</CardTitle>
          <CardDescription>
            Org-level правила корреспонденции Dr/Cr с атомарной заменой набора.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <AccountingCorrespondencePageClient
            orgId={selectedOrgId}
            orgOptions={orgOptions}
            rules={rules}
          />
        </CardContent>
      </Card>
    </div>
  );
}
