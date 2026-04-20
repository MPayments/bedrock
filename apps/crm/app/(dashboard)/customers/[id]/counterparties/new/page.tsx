"use client";

import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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

import { useCrmBreadcrumbs } from "@/components/app/breadcrumbs-provider";
import { CustomerCounterpartyCreateEditor } from "../../components/customer-counterparty-create-editor";
import {
  buildCustomerCounterpartyDetailsHref,
} from "../../lib/customer-detail";
import { getCustomerWorkspace } from "../../lib/customer-workspace-api";

export default function CustomerCounterpartyCreatePage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customerName, setCustomerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [localizedTextVariant, setLocalizedTextVariant] =
    useState<LocalizedTextVariant>("base");

  useCrmBreadcrumbs(
    customerName
      ? [
          {
            href: `/customers/${customerId}`,
            label: customerName,
          },
        ]
      : [],
  );

  const loadCustomer = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const workspace = await getCustomerWorkspace(customerId);
      setCustomerName(workspace.name);
    } catch (loadError) {
      console.error("Failed to load customer for counterparty create page", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить клиента",
      );
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

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
              {error ?? "Клиент не найден"}
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
          <h1 className="text-2xl font-bold">Новый контрагент</h1>
          <p className="text-sm text-muted-foreground">
            Клиент: {customerName}
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

      <CustomerCounterpartyCreateEditor
        customerId={customerId}
        localizedTextVariant={localizedTextVariant}
        onCreated={(counterpartyId) => {
          router.replace(
            buildCustomerCounterpartyDetailsHref(customerId, counterpartyId),
          );
        }}
        onDirtyChange={() => {}}
      />
    </div>
  );
}
