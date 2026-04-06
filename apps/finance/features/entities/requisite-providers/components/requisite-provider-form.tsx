"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { CountrySelect } from "@bedrock/sdk-ui/components/country-select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import { formatDate } from "@/lib/format";

const RequisiteProviderSchema = z.object({
  kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
  name: z.string().trim().min(1, "Название обязательно"),
  description: z.string().trim(),
  country: z.string().trim(),
  address: z.string().trim(),
  contact: z.string().trim(),
  bic: z.string().trim(),
  swift: z.string().trim(),
});

export type RequisiteProviderFormValues = z.infer<
  typeof RequisiteProviderSchema
>;

const DEFAULT_VALUES: RequisiteProviderFormValues = {
  kind: "bank",
  name: "",
  description: "",
  country: "",
  address: "",
  contact: "",
  bic: "",
  swift: "",
};

const REQUISITE_PROVIDER_KIND_OPTIONS = [
  { value: "bank", label: "Банк" },
  { value: "blockchain", label: "Блокчейн" },
  { value: "exchange", label: "Биржа" },
  { value: "custodian", label: "Кастодиан" },
] as const;

type RequisiteProviderFormProps = {
  initialValues?: Partial<RequisiteProviderFormValues>;
  createdAt?: string | null;
  updatedAt?: string | null;
  submitting?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSubmit?: (
    values: RequisiteProviderFormValues,
  ) => Promise<RequisiteProviderFormValues | void> | RequisiteProviderFormValues | void;
  onDelete?: () => Promise<boolean | void> | boolean | void;
  submitLabel: string;
  submittingLabel: string;
  showDelete?: boolean;
};

export function RequisiteProviderForm({
  initialValues,
  createdAt,
  updatedAt,
  submitting = false,
  deleting = false,
  error,
  onSubmit,
  onDelete,
  submitLabel,
  submittingLabel,
  showDelete = false,
}: RequisiteProviderFormProps) {
  const resolvedInitialValues = useMemo(
    () => ({ ...DEFAULT_VALUES, ...initialValues }),
    [initialValues],
  );
  const form = useForm<RequisiteProviderFormValues>({
    resolver: zodResolver(RequisiteProviderSchema),
    defaultValues: resolvedInitialValues,
  });

  useEffect(() => {
    form.reset(resolvedInitialValues);
  }, [form, resolvedInitialValues]);

  async function handleSubmit(values: RequisiteProviderFormValues) {
    const normalized = {
      kind: values.kind,
      name: values.name.trim(),
      description: values.description.trim(),
      country: values.country.trim().toUpperCase(),
      address: values.address.trim(),
      contact: values.contact.trim(),
      bic: values.bic.trim(),
      swift: values.swift.trim(),
    };
    const nextValues = await onSubmit?.(normalized);
    form.reset(nextValues ?? normalized);
  }

  async function handleDelete() {
    if (!onDelete) {
      return;
    }
    if (!window.confirm("Удалить провайдера реквизитов?\n\nДействие необратимо.")) {
      return;
    }
    await onDelete();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Провайдер реквизитов</CardTitle>
        <CardDescription>
          {createdAt || updatedAt
            ? `Создано ${createdAt ? formatDate(createdAt) : "—"} · Обновлено ${updatedAt ? formatDate(updatedAt) : "—"}`
            : "Справочник банков, бирж, кастодианов и blockchain-провайдеров для реквизитов."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-6"
        >
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <FieldSet>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Вид</FieldLabel>
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting || deleting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите вид">
                          {
                            REQUISITE_PROVIDER_KIND_OPTIONS.find(
                              (option) => option.value === field.value,
                            )?.label
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {REQUISITE_PROVIDER_KIND_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field>
                <FieldLabel>Название</FieldLabel>
                <Input
                  {...form.register("name")}
                  disabled={submitting || deleting}
                />
                <FieldError>{form.formState.errors.name?.message}</FieldError>
              </Field>

              <Controller
                control={form.control}
                name="country"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="requisite-provider-country">
                      Страна
                    </FieldLabel>
                    <CountrySelect
                      id="requisite-provider-country"
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting || deleting}
                      invalid={fieldState.invalid}
                      placeholder="Выберите страну"
                      searchPlaceholder="Поиск страны..."
                      emptyLabel="Страна не найдена"
                      clearable
                      clearLabel="Очистить"
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />

              <Field>
                <FieldLabel>BIC</FieldLabel>
                <Input
                  {...form.register("bic")}
                  disabled={submitting || deleting}
                />
                <FieldDescription>Для банков, при необходимости.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>SWIFT</FieldLabel>
                <Input
                  {...form.register("swift")}
                  disabled={submitting || deleting}
                />
              </Field>

              <Field className="md:col-span-2">
                <FieldLabel>Контакт</FieldLabel>
                <Textarea
                  {...form.register("contact")}
                  rows={3}
                  disabled={submitting || deleting}
                />
              </Field>

              <Field className="md:col-span-2">
                <FieldLabel>Адрес</FieldLabel>
                <Textarea
                  {...form.register("address")}
                  rows={3}
                  disabled={submitting || deleting}
                />
              </Field>

              <Field className="md:col-span-2">
                <FieldLabel>Описание</FieldLabel>
                <Textarea
                  {...form.register("description")}
                  rows={4}
                  disabled={submitting || deleting}
                />
              </Field>
            </FieldGroup>
          </FieldSet>

          <div className="flex items-center justify-between gap-3">
            <div>
              {showDelete && onDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleDelete()}
                  disabled={submitting || deleting}
                >
                  {deleting ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Удалить
                </Button>
              ) : null}
            </div>

            <Button type="submit" disabled={submitting || deleting}>
              {submitting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {submitting ? submittingLabel : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
