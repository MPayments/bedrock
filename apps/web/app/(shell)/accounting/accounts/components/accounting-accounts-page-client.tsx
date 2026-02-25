"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/ui/components/dialog";
import { Input } from "@bedrock/ui/components/input";
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

import type {
  AccountingOrgAccount,
  AccountingOrgOption,
} from "../../lib/queries";

interface AccountingAccountsPageClientProps {
  orgId: string | null;
  orgOptions: AccountingOrgOption[];
  accounts: AccountingOrgAccount[];
}

type OverrideDialogState = {
  accountNo: string;
  enabled: boolean;
  nameOverride: string;
} | null;

export function AccountingAccountsPageClient({
  orgId,
  orgOptions,
  accounts,
}: AccountingAccountsPageClientProps) {
  const router = useRouter();
  const [overrideDialog, setOverrideDialog] =
    useState<OverrideDialogState>(null);
  const [savingOverride, setSavingOverride] = useState(false);
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  const selectedOrg = useMemo(
    () => orgOptions.find((item) => item.id === orgId) ?? null,
    [orgId, orgOptions],
  );

  function changeOrg(nextOrgId: string) {
    const params = new URLSearchParams();
    params.set("orgId", nextOrgId);
    router.push(`/accounting/accounts?${params.toString()}`);
  }

  async function handleSaveOverride() {
    if (!orgId || !overrideDialog) return;

    setSavingOverride(true);
    const result = await executeMutation({
      request: () =>
        apiClient.v1.accounting.orgs[":orgId"].accounts[":accountNo"].$put({
          param: {
            orgId,
            accountNo: overrideDialog.accountNo,
          },
          json: {
            enabled: overrideDialog.enabled,
            nameOverride: overrideDialog.nameOverride.trim() || null,
          },
        }),
      fallbackMessage: "Не удалось сохранить override",
      parseData: async () => undefined,
    });
    setSavingOverride(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Override сохранен");
    setOverrideDialog(null);
    router.refresh();
  }

  async function handleSeedDefaults() {
    if (!orgId) return;

    setSeedingDefaults(true);
    const result = await executeMutation({
      request: () =>
        apiClient.v1.accounting.orgs[":orgId"]["seed-defaults"].$post({
          param: { orgId },
        }),
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
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="org-selector">
            Организация (book org)
          </label>
          <select
            id="org-selector"
            value={orgId ?? ""}
            onChange={(event) => changeOrg(event.target.value)}
            className="border-input bg-background h-9 min-w-80 rounded-md border px-3 text-sm"
          >
            {orgOptions.map((org) => (
              <option key={org.id} value={org.id}>
                {org.shortName}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          onClick={handleSeedDefaults}
          disabled={!orgId || seedingDefaults}
        >
          {seedingDefaults ? "Seeding..." : "Seed defaults"}
        </Button>
      </div>

      <div className="text-muted-foreground text-sm">
        {selectedOrg
          ? `Текущая организация: ${selectedOrg.shortName}`
          : "Организация не выбрана"}
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
              <TableHead className="text-right">Action</TableHead>
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
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setOverrideDialog({
                          accountNo: account.accountNo,
                          enabled: account.enabled,
                          nameOverride: account.name,
                        })
                      }
                    >
                      Override
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!overrideDialog}
        onOpenChange={(open) => !open && setOverrideDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override счета</DialogTitle>
            <DialogDescription>
              Изменение org-level override для выбранного accountNo.
            </DialogDescription>
          </DialogHeader>
          {overrideDialog ? (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-sm font-medium">Account no</label>
                <Input value={overrideDialog.accountNo} disabled />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Name override</label>
                <Input
                  value={overrideDialog.nameOverride}
                  onChange={(event) =>
                    setOverrideDialog((prev) =>
                      prev
                        ? {
                            ...prev,
                            nameOverride: event.target.value,
                          }
                        : prev,
                    )
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={overrideDialog.enabled}
                  onChange={(event) =>
                    setOverrideDialog((prev) =>
                      prev
                        ? {
                            ...prev,
                            enabled: event.target.checked,
                          }
                        : prev,
                    )
                  }
                />
                Enabled
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOverrideDialog(null)}
              disabled={savingOverride}
            >
              Отмена
            </Button>
            <Button onClick={handleSaveOverride} disabled={savingOverride}>
              {savingOverride ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
