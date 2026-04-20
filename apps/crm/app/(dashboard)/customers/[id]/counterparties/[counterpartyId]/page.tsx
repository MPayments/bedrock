"use client";

import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LOCALIZED_TEXT_VARIANTS,
  type LocalizedTextVariant,
} from "@bedrock/sdk-parties-ui/lib/localized-text";
import {
  Card,
  CardContent,
} from "@bedrock/sdk-ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

import {
  resolveCounterpartyBreadcrumbLabel,
} from "@/components/app/crm-breadcrumbs";
import { useCrmBreadcrumbs } from "@/components/app/crm-breadcrumbs-provider";
import { CustomerCounterpartyEditor } from "../../components/customer-counterparty-editor";
import { getCustomerWorkspace } from "../../lib/customer-workspace-api";

export default function CustomerCounterpartyDetailsPage() {
  const params = useParams();
  const customerId = params.id as string;
  const counterpartyId = params.counterpartyId as string;

  const [customerName, setCustomerName] = useState<string | null>(null);
  const [counterpartyName, setCounterpartyName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [localizedTextVariant, setLocalizedTextVariant] =
    useState<LocalizedTextVariant>("base");

  useCrmBreadcrumbs([
    ...(customerName
      ? [
          {
            href: `/customers/${customerId}`,
            label: customerName,
          },
        ]
      : []),
    ...(counterpartyName
      ? [
          {
            href: `/customers/${customerId}/counterparties/${counterpartyId}`,
            label: counterpartyName,
          },
        ]
      : []),
  ]);

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCustomerName(null);
      setCounterpartyName(null);
      const workspace = await getCustomerWorkspace(customerId);
      const counterparty = workspace.counterparties.find(
        (item) => item.counterpartyId === counterpartyId,
      );

      if (!counterparty) {
        throw new Error("Контрагент не найден у этого клиента");
      }

      setCustomerName(workspace.name);
      setCounterpartyName(resolveCounterpartyBreadcrumbLabel(counterparty));
    } catch (loadError) {
      console.error("Failed to load customer counterparty details page", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить контрагента",
      );
    } finally {
      setLoading(false);
    }
  }, [counterpartyId, customerId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const pageTitle = useMemo(() => {
    if (customerName) {
      return `Контрагент клиента ${customerName}`;
    }

    return "Карточка контрагента";
  }, [customerName]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customerName) {
    return (
      <div className="space-y-4">
        <Card className="border-destructive">
          <CardContent className="py-6">
            <p className="text-sm text-destructive">
              {error ?? "Контрагент не найден"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Изменения сохраняются прямо в карточке контрагента.
          </p>
        </div>

        <div className="w-full max-w-[220px] space-y-1">
          <Select
            value={localizedTextVariant}
            onValueChange={(value) =>
              setLocalizedTextVariant((value as LocalizedTextVariant) ?? "base")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {
                  LOCALIZED_TEXT_VARIANTS.find(
                    (option) => option.value === localizedTextVariant,
                  )?.label
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LOCALIZED_TEXT_VARIANTS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <CustomerCounterpartyEditor
        counterpartyId={counterpartyId}
        localizedTextVariant={localizedTextVariant}
        onDirtyChange={() => {}}
        onSaved={() => {
          void loadWorkspace();
        }}
        resetSignal={0}
      />
    </div>
  );
}
