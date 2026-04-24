"use client";

import { Loader2, Plus, Save } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

import {
  EntityPageHeader,
  getEntityInitials,
} from "@/components/app/entity-page-header";

type CustomerCreateHeaderProps = {
  customerName?: string;
  onCancel: () => void;
  saving: boolean;
};

export function CustomerCreateHeader({
  customerName,
  onCancel,
  saving,
}: CustomerCreateHeaderProps) {
  const trimmedName = customerName?.trim() ?? "";
  const title = trimmedName || "Новый клиент";
  const avatar = trimmedName
    ? { initials: getEntityInitials(trimmedName) }
    : { icon: <Plus className="size-4" /> };

  return (
    <EntityPageHeader
      avatar={avatar}
      title={title}
      infoItems={["Новый клиент", "Создание клиента, контрагента и реквизитов"]}
      actions={
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
      }
    />
  );
}
