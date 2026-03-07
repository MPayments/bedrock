"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Trash2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@bedrock/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import { Checkbox } from "@bedrock/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
} from "@bedrock/ui/components/field";
import { Input } from "@bedrock/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/ui/components/select";
import { Spinner } from "@bedrock/ui/components/spinner";
import { Textarea } from "@bedrock/ui/components/textarea";

import {
  REQUISITE_KIND_OPTIONS,
  type RelationOption,
  type RequisiteFormValues,
} from "../lib/constants";
import { formatDate } from "@/lib/format";

type RequisiteFormSubmit =
  | Promise<RequisiteFormValues | void>
  | RequisiteFormValues
  | void;

type RequisiteFormProps = {
  ownerLabel: string;
  ownerDescription: string;
  ownerOptions: RelationOption[];
  providerOptions: RelationOption[];
  currencyOptions: RelationOption[];
  initialValues?: Partial<RequisiteFormValues>;
  createdAt?: string | null;
  updatedAt?: string | null;
  submitting?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSubmit?: (values: RequisiteFormValues) => RequisiteFormSubmit;
  onDelete?: () => Promise<boolean | void> | boolean | void;
  onLabelChange?: (label: string) => void;
  ownerReadonly?: boolean;
  kindReadonly?: boolean;
  deleteTitle?: string;
  deleteDescription?: string;
  submitLabel: string;
  submittingLabel: string;
  showDelete?: boolean;
};

const DEFAULT_VALUES: RequisiteFormValues = {
  ownerId: "",
  providerId: "",
  currencyId: "",
  kind: "bank",
  label: "",
  description: "",
  beneficiaryName: "",
  institutionName: "",
  institutionCountry: "",
  accountNo: "",
  corrAccount: "",
  iban: "",
  bic: "",
  swift: "",
  bankAddress: "",
  network: "",
  assetCode: "",
  address: "",
  memoTag: "",
  accountRef: "",
  subaccountRef: "",
  contact: "",
  notes: "",
  isDefault: false,
};

function createSchema() {
  return z
    .object({
      ownerId: z.string().trim().min(1, "Владелец обязателен"),
      providerId: z.string().trim().min(1, "Провайдер обязателен"),
      currencyId: z.string().trim().min(1, "Валюта обязательна"),
      kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
      label: z.string().trim().min(1, "Название обязательно"),
      description: z.string(),
      beneficiaryName: z.string(),
      institutionName: z.string(),
      institutionCountry: z.string(),
      accountNo: z.string(),
      corrAccount: z.string(),
      iban: z.string(),
      bic: z.string(),
      swift: z.string(),
      bankAddress: z.string(),
      network: z.string(),
      assetCode: z.string(),
      address: z.string(),
      memoTag: z.string(),
      accountRef: z.string(),
      subaccountRef: z.string(),
      contact: z.string(),
      notes: z.string(),
      isDefault: z.boolean(),
    })
    .superRefine((data, ctx) => {
      if (data.kind === "bank") {
        if (!data.beneficiaryName.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["beneficiaryName"],
            message: "Получатель обязателен для банковских реквизитов",
          });
        }
        if (!data.institutionName.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["institutionName"],
            message: "Банк обязателен для банковских реквизитов",
          });
        }
        if (!data.institutionCountry.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["institutionCountry"],
            message: "Страна банка обязательна",
          });
        }
        if (!data.accountNo.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["accountNo"],
            message: "Номер счёта обязателен",
          });
        }
      }

      if (data.kind === "blockchain") {
        if (!data.network.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["network"],
            message: "Сеть обязательна для блокчейн-реквизитов",
          });
        }
        if (!data.assetCode.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["assetCode"],
            message: "Актив обязателен для блокчейн-реквизитов",
          });
        }
        if (!data.address.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["address"],
            message: "Адрес обязателен для блокчейн-реквизитов",
          });
        }
      }

      if (data.kind === "exchange" || data.kind === "custodian") {
        if (!data.institutionName.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["institutionName"],
            message: "Институт обязателен",
          });
        }
        if (!data.institutionCountry.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["institutionCountry"],
            message: "Страна института обязательна",
          });
        }
        if (!data.accountRef.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["accountRef"],
            message: "Идентификатор аккаунта обязателен",
          });
        }
      }
    });
}

function normalizeValues(values: RequisiteFormValues): RequisiteFormValues {
  return {
    ownerId: values.ownerId.trim(),
    providerId: values.providerId.trim(),
    currencyId: values.currencyId.trim(),
    kind: values.kind,
    label: values.label.trim(),
    description: values.description.trim(),
    beneficiaryName: values.beneficiaryName.trim(),
    institutionName: values.institutionName.trim(),
    institutionCountry: values.institutionCountry.trim().toUpperCase(),
    accountNo: values.accountNo.trim(),
    corrAccount: values.corrAccount.trim(),
    iban: values.iban.trim(),
    bic: values.bic.trim(),
    swift: values.swift.trim(),
    bankAddress: values.bankAddress.trim(),
    network: values.network.trim(),
    assetCode: values.assetCode.trim(),
    address: values.address.trim(),
    memoTag: values.memoTag.trim(),
    accountRef: values.accountRef.trim(),
    subaccountRef: values.subaccountRef.trim(),
    contact: values.contact.trim(),
    notes: values.notes.trim(),
    isDefault: values.isDefault,
  };
}

function resolveInitialValues(
  initialValues?: Partial<RequisiteFormValues>,
): RequisiteFormValues {
  return { ...DEFAULT_VALUES, ...initialValues };
}

export function RequisiteGeneralForm({
  ownerLabel,
  ownerDescription,
  ownerOptions,
  providerOptions,
  currencyOptions,
  initialValues,
  createdAt,
  updatedAt,
  submitting = false,
  deleting = false,
  error,
  onSubmit,
  onDelete,
  onLabelChange,
  ownerReadonly = false,
  kindReadonly = false,
  deleteTitle = "Удалить реквизит?",
  deleteDescription = "Реквизит будет удалён без возможности восстановления.",
  submitLabel,
  submittingLabel,
  showDelete = false,
}: RequisiteFormProps) {
  const schema = useMemo(() => createSchema(), []);
  const resolvedInitialValues = useMemo(
    () => resolveInitialValues(initialValues),
    [initialValues],
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const form = useForm<RequisiteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: resolvedInitialValues,
  });

  useEffect(() => {
    form.reset(resolvedInitialValues);
  }, [form, resolvedInitialValues]);

  const label = useWatch({ control: form.control, name: "label" });
  const kind = useWatch({ control: form.control, name: "kind" });

  useEffect(() => {
    onLabelChange?.(label ?? "");
  }, [label, onLabelChange]);

  async function handleFormSubmit(values: RequisiteFormValues) {
    const normalized = normalizeValues(values);
    const nextValues = await onSubmit?.(normalized);
    if (nextValues) {
      form.reset(nextValues);
      return;
    }
    form.reset(normalized);
  }

  async function handleDelete() {
    if (!onDelete) {
      return;
    }
    setDeleteError(null);
    if (!window.confirm(`${deleteTitle}\n\n${deleteDescription}`)) {
      return;
    }
    const result = await onDelete();
    if (result === false) {
      setDeleteError("Не удалось удалить реквизит");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Общие сведения</CardTitle>
        <CardDescription>
          {createdAt || updatedAt
            ? `Создан ${createdAt ? formatDate(createdAt) : "—"} · Обновлён ${updatedAt ? formatDate(updatedAt) : "—"}`
            : "Настройте пользовательский реквизит без привязки к legacy account provider."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className="space-y-6"
        >
          {(error || deleteError) && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error ?? deleteError}
            </div>
          )}

          <FieldSet>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Название</FieldLabel>
                <Input
                  {...form.register("label")}
                  placeholder="Например, Основной USD"
                  disabled={submitting || deleting}
                />
                <FieldError>{form.formState.errors.label?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>{ownerLabel}</FieldLabel>
                <Controller
                  control={form.control}
                  name="ownerId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting || deleting || ownerReadonly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Выберите: ${ownerLabel.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {ownerOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldDescription>{ownerDescription}</FieldDescription>
                <FieldError>{form.formState.errors.ownerId?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Вид реквизита</FieldLabel>
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting || deleting || kindReadonly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите вид" />
                      </SelectTrigger>
                      <SelectContent>
                        {REQUISITE_KIND_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{form.formState.errors.kind?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Валюта</FieldLabel>
                <Controller
                  control={form.control}
                  name="currencyId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting || deleting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите валюту" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencyOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{form.formState.errors.currencyId?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Провайдер</FieldLabel>
                <Controller
                  control={form.control}
                  name="providerId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting || deleting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите провайдера" />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{form.formState.errors.providerId?.message}</FieldError>
              </Field>

              <Field className="md:col-span-2">
                <FieldLabel>Описание</FieldLabel>
                <Textarea
                  {...form.register("description")}
                  placeholder="Короткое описание или назначение"
                  disabled={submitting || deleting}
                  rows={3}
                />
                <FieldError>
                  {form.formState.errors.description?.message}
                </FieldError>
              </Field>

              <Field className="md:col-span-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-3">
                  <Controller
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                        disabled={submitting || deleting}
                      />
                    )}
                  />
                  <div className="space-y-1">
                    <FieldLabel className="text-sm">Использовать по умолчанию</FieldLabel>
                    <FieldDescription>
                      Для выбранного владельца и валюты будет сохранён один дефолтный реквизит.
                    </FieldDescription>
                  </div>
                </div>
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSeparator />

          {kind === "bank" && (
            <FieldSet>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Получатель</FieldLabel>
                  <Input
                    {...form.register("beneficiaryName")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.beneficiaryName?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Банк</FieldLabel>
                  <Input
                    {...form.register("institutionName")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.institutionName?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Страна банка</FieldLabel>
                  <Input
                    {...form.register("institutionCountry")}
                    placeholder="AE"
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.institutionCountry?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Номер счёта</FieldLabel>
                  <Input
                    {...form.register("accountNo")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.accountNo?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Корр. счёт</FieldLabel>
                  <Input
                    {...form.register("corrAccount")}
                    disabled={submitting || deleting}
                  />
                </Field>
                <Field>
                  <FieldLabel>IBAN</FieldLabel>
                  <Input
                    {...form.register("iban")}
                    disabled={submitting || deleting}
                  />
                </Field>
                <Field>
                  <FieldLabel>BIC</FieldLabel>
                  <Input
                    {...form.register("bic")}
                    disabled={submitting || deleting}
                  />
                </Field>
                <Field>
                  <FieldLabel>SWIFT</FieldLabel>
                  <Input
                    {...form.register("swift")}
                    disabled={submitting || deleting}
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel>Адрес банка</FieldLabel>
                  <Textarea
                    {...form.register("bankAddress")}
                    rows={3}
                    disabled={submitting || deleting}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          )}

          {kind === "blockchain" && (
            <FieldSet>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Сеть</FieldLabel>
                  <Input
                    {...form.register("network")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>{form.formState.errors.network?.message}</FieldError>
                </Field>
                <Field>
                  <FieldLabel>Актив</FieldLabel>
                  <Input
                    {...form.register("assetCode")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>{form.formState.errors.assetCode?.message}</FieldError>
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel>Адрес</FieldLabel>
                  <Textarea
                    {...form.register("address")}
                    rows={3}
                    disabled={submitting || deleting}
                  />
                  <FieldError>{form.formState.errors.address?.message}</FieldError>
                </Field>
                <Field>
                  <FieldLabel>Memo / Tag</FieldLabel>
                  <Input
                    {...form.register("memoTag")}
                    disabled={submitting || deleting}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          )}

          {(kind === "exchange" || kind === "custodian") && (
            <FieldSet>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Институт</FieldLabel>
                  <Input
                    {...form.register("institutionName")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.institutionName?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Страна института</FieldLabel>
                  <Input
                    {...form.register("institutionCountry")}
                    placeholder="AE"
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.institutionCountry?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Account Ref</FieldLabel>
                  <Input
                    {...form.register("accountRef")}
                    disabled={submitting || deleting}
                  />
                  <FieldError>
                    {form.formState.errors.accountRef?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Subaccount Ref</FieldLabel>
                  <Input
                    {...form.register("subaccountRef")}
                    disabled={submitting || deleting}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          )}

          <FieldSeparator />

          <FieldSet>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Контакт</FieldLabel>
                <Textarea
                  {...form.register("contact")}
                  rows={3}
                  disabled={submitting || deleting}
                />
              </Field>
              <Field>
                <FieldLabel>Примечание</FieldLabel>
                <Textarea
                  {...form.register("notes")}
                  rows={3}
                  disabled={submitting || deleting}
                />
              </Field>
            </FieldGroup>
          </FieldSet>

          <div className="flex flex-wrap items-center justify-between gap-3">
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
