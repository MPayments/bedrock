"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/ui/components/button";
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
  AccountingCorrespondenceRule,
  AccountingOrgOption,
} from "../../lib/queries";

interface AccountingCorrespondencePageClientProps {
  orgId: string | null;
  orgOptions: AccountingOrgOption[];
  rules: AccountingCorrespondenceRule[];
}

type EditableRule = {
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  enabled: boolean;
};

function toEditableRule(rule: AccountingCorrespondenceRule): EditableRule {
  return {
    postingCode: rule.postingCode,
    debitAccountNo: rule.debitAccountNo,
    creditAccountNo: rule.creditAccountNo,
    enabled: rule.enabled,
  };
}

function isAccountNo(value: string) {
  return /^[0-9]{4}$/.test(value.trim());
}

export function AccountingCorrespondencePageClient({
  orgId,
  orgOptions,
  rules,
}: AccountingCorrespondencePageClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableRule[]>(() => rules.map(toEditableRule));
  const [saving, setSaving] = useState(false);

  const selectedOrg = useMemo(
    () => orgOptions.find((item) => item.id === orgId) ?? null,
    [orgId, orgOptions],
  );

  function changeOrg(nextOrgId: string) {
    const params = new URLSearchParams();
    params.set("orgId", nextOrgId);
    router.push(`/accounting/correspondence?${params.toString()}`);
  }

  function validateRows(): string | null {
    const keys = new Set<string>();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]!;
      const postingCode = row.postingCode.trim();
      const debitAccountNo = row.debitAccountNo.trim();
      const creditAccountNo = row.creditAccountNo.trim();

      if (!postingCode) {
        return `Строка ${index + 1}: postingCode обязателен`;
      }
      if (!isAccountNo(debitAccountNo)) {
        return `Строка ${index + 1}: некорректный debit account`;
      }
      if (!isAccountNo(creditAccountNo)) {
        return `Строка ${index + 1}: некорректный credit account`;
      }

      const key = `${postingCode}::${debitAccountNo}::${creditAccountNo}`;
      if (keys.has(key)) {
        return `Дублирующее правило в строке ${index + 1}`;
      }
      keys.add(key);
    }

    return null;
  }

  async function handleSave() {
    if (!orgId) return;

    const validationError = validateRows();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const result = await executeMutation({
      request: () =>
        apiClient.v1.accounting.orgs[":orgId"]["correspondence-rules"].$put({
          param: { orgId },
          json: {
            rules: rows.map((row) => ({
              postingCode: row.postingCode.trim(),
              debitAccountNo: row.debitAccountNo.trim(),
              creditAccountNo: row.creditAccountNo.trim(),
              enabled: row.enabled,
            })),
          },
        }),
      fallbackMessage: "Не удалось сохранить correspondence rules",
      parseData: async () => undefined,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Correspondence rules обновлены");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="correspondence-org-selector">
            Организация (book org)
          </label>
          <select
            id="correspondence-org-selector"
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
          variant="outline"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              {
                postingCode: "",
                debitAccountNo: "",
                creditAccountNo: "",
                enabled: true,
              },
            ])
          }
        >
          Добавить правило
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!orgId || saving}>
          {saving ? "Сохранение..." : "Сохранить правила"}
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
              <TableHead>Posting code</TableHead>
              <TableHead>Debit</TableHead>
              <TableHead>Credit</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-16 text-center">
                  Правила отсутствуют
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={`${row.postingCode}-${index}`}>
                  <TableCell>
                    <Input
                      value={row.postingCode}
                      onChange={(event) =>
                        setRows((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, postingCode: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.debitAccountNo}
                      onChange={(event) =>
                        setRows((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, debitAccountNo: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.creditAccountNo}
                      onChange={(event) =>
                        setRows((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, creditAccountNo: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(event) =>
                          setRows((prev) =>
                            prev.map((item, idx) =>
                              idx === index
                                ? { ...item, enabled: event.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                      enabled
                    </label>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setRows((prev) => prev.filter((_, idx) => idx !== index))
                      }
                    >
                      Удалить
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
