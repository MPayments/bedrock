"use client";

import { Loader2, Save, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import type { CustomerFormData, CustomerWorkspaceDetail } from "../_lib/customer-detail";
import { customerToFormValues } from "../_lib/customer-detail";

type CustomerSummaryCardProps = {
  createdAt: string;
  form: UseFormReturn<CustomerFormData>;
  onSave: (data: CustomerFormData) => void;
  saving: boolean;
  workspace: CustomerWorkspaceDetail | null;
};

export function CustomerSummaryCard({
  createdAt,
  form,
  onSave,
  saving,
  workspace,
}: CustomerSummaryCardProps) {
  const isDirty = form.formState.isDirty;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>Данные клиента</CardTitle>
          {isDirty ? (
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                form="customer-summary-form"
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Сохранить
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={saving}
                onClick={() => form.reset(customerToFormValues(workspace))}
              >
                <X className="size-4" />
                Отменить
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <form
          id="customer-summary-form"
          className="grid gap-4 lg:grid-cols-3"
          onSubmit={form.handleSubmit(onSave)}
        >
          <div className="space-y-2">
            <Label htmlFor="customer-display-name">Название клиента</Label>
            <Input
              id="customer-display-name"
              value={form.watch("displayName")}
              onChange={(event) =>
                form.setValue("displayName", event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            <FieldError message={form.formState.errors.displayName?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-external-ref">Внешний ID</Label>
            <Input
              id="customer-external-ref"
              value={form.watch("externalRef")}
              onChange={(event) =>
                form.setValue("externalRef", event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              placeholder="Например: crm-0001"
            />
            <FieldError message={form.formState.errors.externalRef?.message} />
          </div>
          <div className="space-y-2">
            <Label>Создан</Label>
            <Input
              readOnly
              disabled
              value={new Date(createdAt).toLocaleString("ru-RU")}
            />
          </div>
          <div className="space-y-2 lg:col-span-3">
            <Label htmlFor="customer-description">Описание</Label>
            <Textarea
              id="customer-description"
              value={form.watch("description")}
              onChange={(event) =>
                form.setValue("description", event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              placeholder="Описание клиента"
              rows={3}
            />
            <FieldError message={form.formState.errors.description?.message} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}
