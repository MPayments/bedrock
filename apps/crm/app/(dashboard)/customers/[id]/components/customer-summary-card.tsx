"use client";

import { Loader2, Save, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import type {
  CustomerFormData,
  CustomerWorkspaceDetail,
} from "../lib/customer-detail";
import { customerToFormValues } from "../lib/customer-detail";

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
  const customerName = form.watch("name");
  const statusMessage = isDirty
    ? "Есть несохранённые изменения"
    : "Данные актуальны";

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Карточка клиента</CardTitle>
            <CardDescription>
              Внутренние данные CRM: название, внешний идентификатор и
              комментарий менеджера.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          id="customer-summary-form"
          className="grid gap-4 lg:grid-cols-2"
          onSubmit={form.handleSubmit(onSave)}
        >
          <div className="space-y-2">
            <Label htmlFor="customer-display-name">Название клиента</Label>
            <Input
              id="customer-display-name"
              value={customerName}
              onChange={(event) =>
                form.setValue("name", event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            <FieldError message={form.formState.errors.name?.message} />
          </div>

          <div className="space-y-2">
            <Label>Создан</Label>
            <Input
              readOnly
              disabled
              value={new Date(createdAt).toLocaleString("ru-RU")}
            />
          </div>
          <div className="space-y-2">
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
        </form>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-muted-foreground flex items-center gap-3">
          {isDirty ? (
            <div className="h-2 w-2 rounded-full bg-amber-500" />
          ) : null}
          <span>{statusMessage}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            type="button"
            disabled={!isDirty || saving}
            onClick={() => form.reset(customerToFormValues(workspace))}
          >
            <X className="size-4" />
            Отменить
          </Button>
          <Button
            type="submit"
            form="customer-summary-form"
            disabled={!isDirty || saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Сохранить
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}
