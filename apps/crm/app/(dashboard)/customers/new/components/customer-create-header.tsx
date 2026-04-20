"use client";

import { Loader2, Save } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

type CustomerCreateHeaderProps = {
  onCancel: () => void;
  saving: boolean;
};

export function CustomerCreateHeader({
  onCancel,
  saving,
}: CustomerCreateHeaderProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Новый клиент</h1>
        <p className="text-sm text-muted-foreground">
          Создание клиента в CRM, первого субъекта сделки и расчетных данных
        </p>
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end lg:w-auto">
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={saving}
        >
          Отмена
        </Button>
        <Button type="submit" form="customer-create-form" disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Создать клиента
        </Button>
      </div>
    </div>
  );
}
