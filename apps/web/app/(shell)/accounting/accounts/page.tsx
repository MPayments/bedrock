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

import { getAccountingTemplateAccounts } from "@/features/accounting/lib/queries";

const ACCOUNT_NAME_OVERRIDES: Record<string, string> = {
  "2140": "Резерв по ордерам",
  "5120": "Расход по комиссии провайдера",
};

const ACCOUNT_KIND_LABELS: Record<string, string> = {
  asset: "Актив",
  liability: "Обязательство",
  equity: "Капитал",
  revenue: "Доход",
  expense: "Расход",
  active_passive: "Активно-пассивный",
};

const NORMAL_SIDE_LABELS: Record<string, string> = {
  debit: "Дебет",
  credit: "Кредит",
  both: "Обе",
};

function formatAccountName(accountNo: string, name: string): string {
  return ACCOUNT_NAME_OVERRIDES[accountNo] ?? name;
}

function formatAccountKind(kind: string): string {
  return ACCOUNT_KIND_LABELS[kind] ?? kind;
}

function formatNormalSide(normalSide: string): string {
  return NORMAL_SIDE_LABELS[normalSide] ?? normalSide;
}

function computeAccountDepths(
  accounts: { accountNo: string; parentAccountNo: string | null }[],
): Map<string, number> {
  const parentMap = new Map<string, string | null>();
  for (const a of accounts) {
    parentMap.set(a.accountNo, a.parentAccountNo);
  }

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
            Глобальный план счетов, иерархия и статус доступности.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Счет</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Сторона</TableHead>
                <TableHead>Разрешено проводить операции</TableHead>
                <TableHead>Включен</TableHead>
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
                        {formatAccountName(account.accountNo, account.name)}
                      </TableCell>
                      <TableCell>{formatAccountKind(account.kind)}</TableCell>
                      <TableCell>
                        {formatNormalSide(account.normalSide)}
                      </TableCell>
                      <TableCell>
                        {account.postingAllowed ? "Да" : "Нет"}
                      </TableCell>
                      <TableCell>{account.enabled ? "Да" : "Нет"}</TableCell>
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
