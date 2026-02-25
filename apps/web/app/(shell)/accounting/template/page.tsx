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

export default async function AccountingTemplatePage() {
  const accounts = await getAccountingTemplateAccounts();

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Template Accounts</CardTitle>
          <CardDescription>
            Глобальный шаблон плана счетов (chart_template_accounts).
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
                <TableHead>Parent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground h-16 text-center">
                    Шаблонные счета не найдены
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.accountNo}>
                    <TableCell className="font-medium">{account.accountNo}</TableCell>
                    <TableCell>{account.name}</TableCell>
                    <TableCell>{account.kind}</TableCell>
                    <TableCell>{account.normalSide}</TableCell>
                    <TableCell>{account.postingAllowed ? "yes" : "no"}</TableCell>
                    <TableCell>{account.parentAccountNo ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
