import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import { getAccountingTemplateAccounts } from "../lib/queries";

function computeAccountDepths(
  accounts: { accountNo: string; parentAccountNo: string | null }[],
): Map<string, number> {
  const parentMap = new Map<string, string | null>();
  for (const a of accounts) parentMap.set(a.accountNo, a.parentAccountNo);

  const depthCache = new Map<string, number>();
  function getDepth(accountNo: string): number {
    if (depthCache.has(accountNo)) return depthCache.get(accountNo)!;
    const parent = parentMap.get(accountNo);
    const depth = parent ? getDepth(parent) + 1 : 0;
    depthCache.set(accountNo, depth);
    return depth;
  }
  for (const a of accounts) getDepth(a.accountNo);
  return depthCache;
}

export default async function AccountingAccountsPage() {
  const accounts = await getAccountingTemplateAccounts();
  const depths = computeAccountDepths(accounts);

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>План счетов</CardTitle>
          <CardDescription>
            Глобальный план счетов (chart of accounts), иерархия и статус
            доступности.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Normal side</TableHead>
                <TableHead>Posting allowed</TableHead>
                <TableHead>Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground h-16 text-center"
                  >
                    Счета не найдены
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => {
                  const depth = depths.get(account.accountNo) ?? 0;
                  const isGroup = !account.postingAllowed;
                  return (
                    <TableRow key={account.accountNo}>
                      <TableCell
                        className={isGroup ? "font-semibold" : "font-medium"}
                        style={{ paddingLeft: `${1 + depth * 1.5}rem` }}
                      >
                        {account.accountNo}
                      </TableCell>
                      <TableCell className={isGroup ? "font-semibold" : ""}>
                        {account.name}
                      </TableCell>
                      <TableCell>{account.kind}</TableCell>
                      <TableCell>{account.normalSide}</TableCell>
                      <TableCell>
                        {account.postingAllowed ? "yes" : "no"}
                      </TableCell>
                      <TableCell>{account.enabled ? "yes" : "no"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
