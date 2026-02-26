"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import type { AccountingTemplateAccount } from "../../lib/queries";

interface AccountingAccountsPageClientProps {
  accounts: AccountingTemplateAccount[];
}

export function AccountingAccountsPageClient({
  accounts,
}: AccountingAccountsPageClientProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Normal side</TableHead>
              <TableHead>Posting allowed</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead>Parent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground h-16 text-center"
                >
                  Счета не найдены
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.accountNo}>
                  <TableCell className="font-medium">
                    {account.accountNo}
                  </TableCell>
                  <TableCell>{account.name}</TableCell>
                  <TableCell>{account.kind}</TableCell>
                  <TableCell>{account.normalSide}</TableCell>
                  <TableCell>{account.postingAllowed ? "yes" : "no"}</TableCell>
                  <TableCell>{account.enabled ? "yes" : "no"}</TableCell>
                  <TableCell>{account.parentAccountNo ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
