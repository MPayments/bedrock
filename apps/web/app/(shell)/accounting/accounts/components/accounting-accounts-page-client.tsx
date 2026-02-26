"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/ui/components/button";
import { toast } from "@bedrock/ui/components/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import type { AccountingTemplateAccount } from "../../lib/queries";

interface AccountingAccountsPageClientProps {
  accounts: AccountingTemplateAccount[];
}

export function AccountingAccountsPageClient({
  accounts,
}: AccountingAccountsPageClientProps) {
  const router = useRouter();
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  async function handleSeedDefaults() {
    setSeedingDefaults(true);
    const result = await executeMutation({
      request: () => apiClient.v1.accounting["seed-defaults"].$post({}),
      fallbackMessage: "Не удалось запустить seed defaults",
      parseData: async () => undefined,
    });
    setSeedingDefaults(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Seed defaults выполнен");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Button
          size="sm"
          onClick={handleSeedDefaults}
          disabled={seedingDefaults}
        >
          {seedingDefaults ? "Seeding..." : "Seed defaults"}
        </Button>
      </div>

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
