"use client";

import { useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  FieldLabel,
  FieldGroup,
  FieldSet,
  Field,
  FieldDescription,
  FieldSeparator,
  FieldContent,
  FieldTitle,
} from "@bedrock/ui/components/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@bedrock/ui/components/select";
import { Input } from "@bedrock/ui/components/input";
import { Switch } from "@bedrock/ui/components/switch";
import { Button } from "@bedrock/ui/components/button";
import { Spinner } from "@bedrock/ui/components/spinner";
import { formatDate } from "@/lib/format";

export type OrganizationGeneralFormValues = {
  name: string;
  country: string;
  baseCurrency: string;
  externalId: string;
  isTreasury: boolean;
  customerId: string;
};

type OrganizationGeneralFormProps = {
  mode: "create" | "edit";
  initialValues?: Partial<OrganizationGeneralFormValues>;
  submitting?: boolean;
  error?: string | null;
  onSubmit?: (values: OrganizationGeneralFormValues) => Promise<void> | void;
  onNameChange?: (name: string) => void;
};

const DEFAULT_VALUES: OrganizationGeneralFormValues = {
  name: "",
  country: "",
  baseCurrency: "USD",
  externalId: "",
  isTreasury: true,
  customerId: "",
};

function resolveInitialValues(
  initialValues?: Partial<OrganizationGeneralFormValues>,
): OrganizationGeneralFormValues {
  return {
    ...DEFAULT_VALUES,
    ...initialValues,
  };
}

export function OrganizationGeneralForm({
  mode,
  initialValues,
  submitting = false,
  error,
  onSubmit,
  onNameChange,
}: OrganizationGeneralFormProps) {
  const initial = useMemo(() => resolveInitialValues(initialValues), [initialValues]);
  const [values, setValues] = useState<OrganizationGeneralFormValues>(initial);

  const isCreateMode = mode === "create";
  const nowFormatted = formatDate(new Date());

  function update<K extends keyof OrganizationGeneralFormValues>(
    key: K,
    value: OrganizationGeneralFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(value: string) {
    update("name", value);
    onNameChange?.(value);
  }

  function handleReset() {
    setValues(initial);
    onNameChange?.(initial.name);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCreateMode || !onSubmit) return;
    await onSubmit(values);
  }

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center">Общая информация</CardTitle>
            <CardDescription>
              Просмотр и редактирование общей информации организации
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" form="organization-general-form" disabled={!isCreateMode || submitting}>
              {submitting ? <Spinner className="size-4" /> : <Save className="size-4" />}
              {submitting ? (isCreateMode ? "Создание..." : "Сохранение...") : isCreateMode ? "Создать" : "Сохранить"}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={!isCreateMode || submitting}
              onClick={handleReset}
            >
              <X className="size-4" />
              Отменить
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form id="organization-general-form" onSubmit={handleSubmit}>
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="organization-name">Название</FieldLabel>
                  <Input
                    id="organization-name"
                    placeholder="Наименование организации"
                    value={values.name}
                    onChange={(event) => handleNameChange(event.target.value)}
                    required
                  />
                </Field>
                <div className="grid md:grid-cols-3 gap-4">
                  <Field>
                    <FieldLabel htmlFor="organization-country">Страна</FieldLabel>
                    <Input
                      id="organization-country"
                      placeholder="Например: Россия"
                      value={values.country}
                      onChange={(event) => update("country", event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="organization-base-currency">Базовая валюта</FieldLabel>
                    <Select
                      value={values.baseCurrency}
                      onValueChange={(value) =>
                        update("baseCurrency", value ?? DEFAULT_VALUES.baseCurrency)
                      }
                    >
                      <SelectTrigger id="organization-base-currency" className="w-full">
                        <SelectValue placeholder="Выберите валюту" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="RUB">RUB</SelectItem>
                          <SelectItem value="USDT">USDT</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="organization-external-id">External ID</FieldLabel>
                    <Input
                      id="organization-external-id"
                      placeholder="Например: crm-123"
                      value={values.externalId}
                      onChange={(event) => update("externalId", event.target.value)}
                    />
                  </Field>
                </div>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel htmlFor="organization-treasury">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>
                        {values.isTreasury
                          ? "Принадлежит казначейству"
                          : "Не принадлежит казначейству"}
                      </FieldTitle>
                      <FieldDescription>
                        Если выключено, требуется UUID клиента.
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id="organization-treasury"
                      checked={values.isTreasury}
                      onCheckedChange={(checked) => update("isTreasury", checked)}
                    />
                  </Field>
                </FieldLabel>
              </FieldGroup>

              {!values.isTreasury && (
                <Field>
                  <FieldLabel htmlFor="organization-customer-id">Customer ID (UUID)</FieldLabel>
                  <Input
                    id="organization-customer-id"
                    placeholder="00000000-0000-4000-8000-000000000000"
                    value={values.customerId}
                    onChange={(event) => update("customerId", event.target.value)}
                    required
                  />
                </Field>
              )}
            </FieldSet>
            <FieldSeparator />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Дата создания</FieldLabel>
                <Input
                  readOnly
                  disabled
                  value={isCreateMode ? "—" : nowFormatted}
                />
              </Field>
              <Field>
                <FieldLabel>Дата обновления</FieldLabel>
                <Input
                  readOnly
                  disabled
                  value={isCreateMode ? "—" : nowFormatted}
                />
              </Field>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
