"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Save, X } from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@bedrock/ui/components/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/ui/components/popover";
import { Spinner } from "@bedrock/ui/components/spinner";
import { Textarea } from "@bedrock/ui/components/textarea";

import type { AccountFormOptions } from "../lib/queries";
import { AccountDeleteDialog } from "./account-delete-dialog";
import { formatDate } from "@/lib/format";

export type AccountGeneralFormValues = {
  label: string;
  description: string;
  counterpartyId: string;
  ledgerEntityCounterpartyId: string;
  currencyId: string;
  accountProviderId: string;
  accountNo: string;
  corrAccount: string;
  address: string;
  iban: string;
};

type AccountGeneralFormSubmit =
  | Promise<AccountGeneralFormValues | void>
  | AccountGeneralFormValues
  | void;

type AccountGeneralFormDelete = Promise<boolean | void> | boolean | void;

type AccountGeneralFormProps = {
  initialValues?: Partial<AccountGeneralFormValues>;
  createdAt?: string | null;
  updatedAt?: string | null;
  options: AccountFormOptions;
  submitting?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSubmit?: (values: AccountGeneralFormValues) => AccountGeneralFormSubmit;
  onDelete?: () => AccountGeneralFormDelete;
  onLabelChange?: (label: string) => void;
  lockRelations?: boolean;
};

type AccountGeneralFormVariant = {
  submitLabel: string;
  submittingLabel: string;
  disableSubmitUntilDirty: boolean;
  showDelete: boolean;
  usePlaceholderDates: boolean;
};

type AccountGeneralFormBaseProps = AccountGeneralFormProps & {
  variant: AccountGeneralFormVariant;
};

const DEFAULT_VALUES: AccountGeneralFormValues = {
  label: "",
  description: "",
  counterpartyId: "",
  ledgerEntityCounterpartyId: "",
  currencyId: "",
  accountProviderId: "",
  accountNo: "",
  corrAccount: "",
  address: "",
  iban: "",
};

type ProviderFieldsConfig = {
  showAccountNo: boolean;
  showCorrAccount: boolean;
  showAddress: boolean;
  showIban: boolean;
  accountNoRequired: boolean;
  corrAccountRequired: boolean;
  addressRequired: boolean;
};

function getProviderFieldsConfig(
  provider: { type: string; country: string } | undefined,
): ProviderFieldsConfig {
  if (!provider) {
    return {
      showAccountNo: true,
      showCorrAccount: true,
      showAddress: true,
      showIban: true,
      accountNoRequired: false,
      corrAccountRequired: false,
      addressRequired: false,
    };
  }

  switch (provider.type) {
    case "bank":
      return {
        showAccountNo: true,
        showCorrAccount: true,
        showAddress: false,
        showIban: true,
        accountNoRequired: true,
        corrAccountRequired: provider.country === "RU",
        addressRequired: false,
      };
    case "blockchain":
      return {
        showAccountNo: false,
        showCorrAccount: false,
        showAddress: true,
        showIban: false,
        accountNoRequired: false,
        corrAccountRequired: false,
        addressRequired: true,
      };
    default:
      return {
        showAccountNo: true,
        showCorrAccount: true,
        showAddress: true,
        showIban: true,
        accountNoRequired: false,
        corrAccountRequired: false,
        addressRequired: false,
      };
  }
}

function createAccountFormSchema(providers: AccountFormOptions["providers"]) {
  return z
    .object({
      label: z.string().trim().min(1, "Название счёта обязательно"),
      description: z.string(),
      counterpartyId: z.string().trim().min(1, "Контрагент обязателен"),
      ledgerEntityCounterpartyId: z
        .string()
        .trim()
        .min(1, "Балансовая компания обязательна"),
      currencyId: z.string().trim().min(1, "Валюта обязательна"),
      accountProviderId: z.string().trim().min(1, "Провайдер обязателен"),
      accountNo: z.string(),
      corrAccount: z.string(),
      address: z.string(),
      iban: z.string(),
    })
    .superRefine((data, ctx) => {
      const provider = providers.find((p) => p.id === data.accountProviderId);
      if (!provider) return;

      if (provider.type === "bank") {
        if (!data.accountNo.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["accountNo"],
            message: "Номер счёта обязателен для банковских счетов",
          });
        }
        if (provider.country === "RU" && !data.corrAccount.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["corrAccount"],
            message: "Корр. счёт обязателен для российских банков",
          });
        }
      }

      if (provider.type === "blockchain") {
        if (!data.address.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["address"],
            message: "Адрес обязателен для блокчейн-счетов",
          });
        }
      }
    });
}

function resolveInitialValues(
  initialValues?: Partial<AccountGeneralFormValues>,
): AccountGeneralFormValues {
  return {
    ...DEFAULT_VALUES,
    ...initialValues,
  };
}

function normalizeValues(
  values: AccountGeneralFormValues,
): AccountGeneralFormValues {
  return {
    label: values.label.trim(),
    description: values.description.trim(),
    counterpartyId: values.counterpartyId.trim(),
    ledgerEntityCounterpartyId: values.ledgerEntityCounterpartyId.trim(),
    currencyId: values.currencyId.trim(),
    accountProviderId: values.accountProviderId.trim(),
    accountNo: values.accountNo.trim(),
    corrAccount: values.corrAccount.trim(),
    address: values.address.trim(),
    iban: values.iban.trim(),
  };
}

function valuesSignature(values: AccountGeneralFormValues) {
  return [
    values.label,
    values.description,
    values.counterpartyId,
    values.ledgerEntityCounterpartyId,
    values.currencyId,
    values.accountProviderId,
    values.accountNo,
    values.corrAccount,
    values.address,
    values.iban,
  ].join("\n");
}

const CREATE_VARIANT: AccountGeneralFormVariant = {
  submitLabel: "Создать",
  submittingLabel: "Создание...",
  disableSubmitUntilDirty: false,
  showDelete: false,
  usePlaceholderDates: true,
};

const EDIT_VARIANT: AccountGeneralFormVariant = {
  submitLabel: "Сохранить",
  submittingLabel: "Сохранение...",
  disableSubmitUntilDirty: true,
  showDelete: true,
  usePlaceholderDates: false,
};

function AccountGeneralFormBase({
  initialValues,
  createdAt,
  updatedAt,
  options,
  submitting = false,
  deleting = false,
  error,
  onSubmit,
  onDelete,
  onLabelChange,
  lockRelations = false,
  variant,
}: AccountGeneralFormBaseProps) {
  const initial = useMemo(
    () => normalizeValues(resolveInitialValues(initialValues)),
    [initialValues],
  );
  const initialSignature = useMemo(() => valuesSignature(initial), [initial]);
  const appliedInitialSignatureRef = useRef(initialSignature);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [counterpartyPickerOpen, setCounterpartyPickerOpen] = useState(false);
  const [ledgerEntityPickerOpen, setLedgerEntityPickerOpen] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);

  const formSchema = useMemo(
    () => createAccountFormSchema(options.providers),
    [options.providers],
  );
  const resolver = useMemo(() => zodResolver(formSchema), [formSchema]);

  const {
    control,
    handleSubmit,
    register,
    reset,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<AccountGeneralFormValues>({
    resolver,
    defaultValues: initial,
    mode: "onChange",
    shouldUnregister: false,
  });

  const watchedValues = useWatch({ control });
  const watchedLabel = watchedValues?.label ?? "";
  const formattedCreatedAt = useMemo(() => {
    if (variant.usePlaceholderDates) {
      return "—";
    }

    return formatDate(createdAt ?? "") || "—";
  }, [createdAt, variant.usePlaceholderDates]);
  const formattedUpdatedAt = useMemo(() => {
    if (variant.usePlaceholderDates) {
      return "—";
    }

    return formatDate(updatedAt ?? "") || "—";
  }, [updatedAt, variant.usePlaceholderDates]);

  const selectedProvider = useMemo(
    () =>
      options.providers.find(
        (p) => p.id === (watchedValues?.accountProviderId ?? ""),
      ),
    [options.providers, watchedValues?.accountProviderId],
  );

  const fieldsConfig = useMemo(
    () => getProviderFieldsConfig(selectedProvider),
    [selectedProvider],
  );

  const prevProviderIdRef = useRef(initial.accountProviderId);

  const currentValues = useMemo(
    () =>
      normalizeValues({
        label: watchedValues?.label ?? "",
        description: watchedValues?.description ?? "",
        counterpartyId: watchedValues?.counterpartyId ?? "",
        ledgerEntityCounterpartyId:
          watchedValues?.ledgerEntityCounterpartyId ?? "",
        currencyId: watchedValues?.currencyId ?? "",
        accountProviderId: watchedValues?.accountProviderId ?? "",
        accountNo: watchedValues?.accountNo ?? "",
        corrAccount: watchedValues?.corrAccount ?? "",
        address: watchedValues?.address ?? "",
        iban: watchedValues?.iban ?? "",
      }),
    [watchedValues],
  );

  const isChanged = useMemo(
    () => valuesSignature(currentValues) !== initialSignature,
    [currentValues, initialSignature],
  );

  useEffect(() => {
    if (appliedInitialSignatureRef.current !== initialSignature) {
      reset(initial);
      appliedInitialSignatureRef.current = initialSignature;
    }
  }, [initial, initialSignature, reset]);

  useEffect(() => {
    onLabelChange?.(watchedLabel);
  }, [onLabelChange, watchedLabel]);

  useEffect(() => {
    const currentId = watchedValues?.accountProviderId ?? "";
    if (currentId === prevProviderIdRef.current) return;
    prevProviderIdRef.current = currentId;

    const config = getProviderFieldsConfig(
      options.providers.find((p) => p.id === currentId),
    );

    if (!config.showAccountNo) setValue("accountNo", "");
    if (!config.showCorrAccount) setValue("corrAccount", "");
    if (!config.showAddress) setValue("address", "");
    if (!config.showIban) setValue("iban", "");

    clearErrors(["accountNo", "corrAccount", "address", "iban"]);
  }, [
    watchedValues?.accountProviderId,
    options.providers,
    setValue,
    clearErrors,
  ]);

  function handleReset() {
    reset(initial);
  }

  async function handleFormSubmit(values: AccountGeneralFormValues) {
    if (!onSubmit) return;

    const submittedValues = await onSubmit(normalizeValues(values));
    if (submittedValues) {
      const normalizedSubmitted = normalizeValues(submittedValues);
      reset(normalizedSubmitted);
      appliedInitialSignatureRef.current = valuesSignature(normalizedSubmitted);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const result = await onDelete();
    if (result !== false) {
      setDeleteDialogOpen(false);
    }
  }

  const submitDisabled =
    submitting || !onSubmit || (variant.disableSubmitUntilDirty && !isChanged);
  const resetDisabled = submitting || !isChanged;
  const deleteDisabled = deleting || submitting || !onDelete;

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center">
              Общая информация
            </CardTitle>
            <CardDescription>
              Просмотр и редактирование параметров счёта.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="account-general-form"
              disabled={submitDisabled}
            >
              {submitting ? (
                <Spinner className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {submitting ? variant.submittingLabel : variant.submitLabel}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={resetDisabled}
              onClick={handleReset}
            >
              <X className="size-4" />
              Отменить
            </Button>
            {variant.showDelete ? (
              <AccountDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                deleting={deleting}
                onDelete={handleDelete}
                disableDelete={deleteDisabled}
                trigger={
                  <Button
                    variant="destructive"
                    type="button"
                    disabled={deleteDisabled}
                  />
                }
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          id="account-general-form"
          onSubmit={handleSubmit(handleFormSubmit)}
        >
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <div className="grid md:grid-cols-2 gap-4">
                  <Controller
                    name="label"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="account-label">
                          Название
                        </FieldLabel>
                        <Input
                          {...field}
                          id="account-label"
                          aria-invalid={fieldState.invalid}
                          placeholder="Например: Основной USD"
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <Controller
                    name="counterpartyId"
                    control={control}
                    render={({ field, fieldState }) => {
                      const selected = options.counterparties.find(
                        (o) => o.id === field.value,
                      );
                      return (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="account-counterparty-id">
                            Контрагент
                          </FieldLabel>
                          <Popover
                            open={counterpartyPickerOpen}
                            onOpenChange={setCounterpartyPickerOpen}
                          >
                            <PopoverTrigger
                              render={
                                <Button
                                  id="account-counterparty-id"
                                  type="button"
                                  variant="outline"
                                  className="w-full justify-between font-normal"
                                  aria-invalid={fieldState.invalid}
                                  disabled={lockRelations}
                                />
                              }
                            >
                              <span className="truncate">
                                {selected?.label ?? "Выберите контрагента"}
                              </span>
                              <ChevronDown className="text-muted-foreground size-4" />
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-(--anchor-width) p-0"
                            >
                              <Command>
                                <CommandInput placeholder="Поиск контрагента..." />
                                <CommandList className="max-h-64">
                                  <CommandEmpty>Не найдено</CommandEmpty>
                                  <CommandGroup>
                                    {options.counterparties.map((option) => (
                                      <CommandItem
                                        key={option.id}
                                        value={option.label}
                                        data-checked={field.value === option.id}
                                        onSelect={() => {
                                          field.onChange(option.id);
                                          setCounterpartyPickerOpen(false);
                                        }}
                                      >
                                        {option.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {fieldState.invalid ? (
                            <FieldError errors={[fieldState.error]} />
                          ) : null}
                        </Field>
                      );
                    }}
                  />
                  <Controller
                    name="ledgerEntityCounterpartyId"
                    control={control}
                    render={({ field, fieldState }) => {
                      const selected = options.ledgerEntities.find(
                        (o) => o.id === field.value,
                      );
                      return (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="account-ledger-entity-id">
                            Балансовая компания
                          </FieldLabel>
                          <Popover
                            open={ledgerEntityPickerOpen}
                            onOpenChange={setLedgerEntityPickerOpen}
                          >
                            <PopoverTrigger
                              render={
                                <Button
                                  id="account-ledger-entity-id"
                                  type="button"
                                  variant="outline"
                                  className="w-full justify-between font-normal"
                                  aria-invalid={fieldState.invalid}
                                  disabled={lockRelations}
                                />
                              }
                            >
                              <span className="truncate">
                                {selected?.label ?? "Выберите балансовую компанию"}
                              </span>
                              <ChevronDown className="text-muted-foreground size-4" />
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-(--anchor-width) p-0"
                            >
                              <Command>
                                <CommandInput placeholder="Поиск балансовой компании..." />
                                <CommandList className="max-h-64">
                                  <CommandEmpty>Не найдено</CommandEmpty>
                                  <CommandGroup>
                                    {options.ledgerEntities.map((option) => (
                                      <CommandItem
                                        key={option.id}
                                        value={option.label}
                                        data-checked={field.value === option.id}
                                        onSelect={() => {
                                          field.onChange(option.id);
                                          setLedgerEntityPickerOpen(false);
                                        }}
                                      >
                                        {option.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {fieldState.invalid ? (
                            <FieldError errors={[fieldState.error]} />
                          ) : null}
                        </Field>
                      );
                    }}
                  />
                  <Controller
                    name="currencyId"
                    control={control}
                    render={({ field, fieldState }) => {
                      const selected = options.currencies.find(
                        (o) => o.id === field.value,
                      );
                      return (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="account-currency-id">
                            Валюта
                          </FieldLabel>
                          <Popover
                            open={currencyPickerOpen}
                            onOpenChange={setCurrencyPickerOpen}
                          >
                            <PopoverTrigger
                              render={
                                <Button
                                  id="account-currency-id"
                                  type="button"
                                  variant="outline"
                                  className="w-full justify-between font-normal"
                                  aria-invalid={fieldState.invalid}
                                  disabled={lockRelations}
                                />
                              }
                            >
                              <span className="truncate">
                                {selected?.label ?? "Выберите валюту"}
                              </span>
                              <ChevronDown className="text-muted-foreground size-4" />
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-(--anchor-width) p-0"
                            >
                              <Command>
                                <CommandInput placeholder="Поиск валюты..." />
                                <CommandList className="max-h-64">
                                  <CommandEmpty>Не найдено</CommandEmpty>
                                  <CommandGroup>
                                    {options.currencies.map((option) => (
                                      <CommandItem
                                        key={option.id}
                                        value={option.label}
                                        data-checked={field.value === option.id}
                                        onSelect={() => {
                                          field.onChange(option.id);
                                          setCurrencyPickerOpen(false);
                                        }}
                                      >
                                        {option.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {fieldState.invalid ? (
                            <FieldError errors={[fieldState.error]} />
                          ) : null}
                        </Field>
                      );
                    }}
                  />
                  <Controller
                    name="accountProviderId"
                    control={control}
                    render={({ field, fieldState }) => {
                      const selected = options.providers.find(
                        (o) => o.id === field.value,
                      );
                      return (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="account-provider-id">
                            Провайдер
                          </FieldLabel>
                          <Popover
                            open={providerPickerOpen}
                            onOpenChange={setProviderPickerOpen}
                          >
                            <PopoverTrigger
                              render={
                                <Button
                                  id="account-provider-id"
                                  type="button"
                                  variant="outline"
                                  className="w-full justify-between font-normal"
                                  aria-invalid={fieldState.invalid}
                                  disabled={lockRelations}
                                />
                              }
                            >
                              <span className="truncate">
                                {selected?.label ?? "Выберите провайдера"}
                              </span>
                              <ChevronDown className="text-muted-foreground size-4" />
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-(--anchor-width) p-0"
                            >
                              <Command>
                                <CommandInput placeholder="Поиск провайдера..." />
                                <CommandList className="max-h-64">
                                  <CommandEmpty>Не найдено</CommandEmpty>
                                  <CommandGroup>
                                    {options.providers.map((option) => (
                                      <CommandItem
                                        key={option.id}
                                        value={option.label}
                                        data-checked={field.value === option.id}
                                        onSelect={() => {
                                          field.onChange(option.id);
                                          setProviderPickerOpen(false);
                                        }}
                                      >
                                        {option.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {fieldState.invalid ? (
                            <FieldError errors={[fieldState.error]} />
                          ) : null}
                        </Field>
                      );
                    }}
                  />
                </div>

                {fieldsConfig.showAccountNo || fieldsConfig.showCorrAccount ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {fieldsConfig.showAccountNo ? (
                      <Field data-invalid={Boolean(errors.accountNo)}>
                        <FieldLabel htmlFor="account-no">
                          Номер счёта
                          {fieldsConfig.accountNoRequired ? (
                            <span className="text-destructive ml-1">*</span>
                          ) : null}
                        </FieldLabel>
                        <Input
                          {...register("accountNo")}
                          id="account-no"
                          aria-invalid={Boolean(errors.accountNo)}
                          placeholder="40817810000000000001"
                        />
                        <FieldError errors={[errors.accountNo]} />
                      </Field>
                    ) : null}
                    {fieldsConfig.showCorrAccount ? (
                      <Field data-invalid={Boolean(errors.corrAccount)}>
                        <FieldLabel htmlFor="account-corr">
                          Корр. счёт
                          {fieldsConfig.corrAccountRequired ? (
                            <span className="text-destructive ml-1">*</span>
                          ) : null}
                        </FieldLabel>
                        <Input
                          {...register("corrAccount")}
                          id="account-corr"
                          aria-invalid={Boolean(errors.corrAccount)}
                          placeholder="30101810400000000225"
                        />
                        <FieldError errors={[errors.corrAccount]} />
                      </Field>
                    ) : null}
                  </div>
                ) : null}

                {fieldsConfig.showAddress || fieldsConfig.showIban ? (
                  <div
                    className={`grid gap-4 ${fieldsConfig.showAddress && fieldsConfig.showIban ? "md:grid-cols-2" : ""}`}
                  >
                    {fieldsConfig.showAddress ? (
                      <Field data-invalid={Boolean(errors.address)}>
                        <FieldLabel htmlFor="account-address">
                          Адрес
                          {fieldsConfig.addressRequired ? (
                            <span className="text-destructive ml-1">*</span>
                          ) : null}
                        </FieldLabel>
                        <Input
                          {...register("address")}
                          id="account-address"
                          aria-invalid={Boolean(errors.address)}
                          placeholder="Адрес кошелька"
                        />
                        <FieldError errors={[errors.address]} />
                      </Field>
                    ) : null}
                    {fieldsConfig.showIban ? (
                      <Field data-invalid={Boolean(errors.iban)}>
                        <FieldLabel htmlFor="account-iban">IBAN</FieldLabel>
                        <Input
                          {...register("iban")}
                          id="account-iban"
                          aria-invalid={Boolean(errors.iban)}
                          placeholder="DE89370400440532013000"
                        />
                        <FieldError errors={[errors.iban]} />
                      </Field>
                    ) : null}
                  </div>
                ) : null}

                <Field data-invalid={Boolean(errors.description)}>
                  <FieldLabel htmlFor="account-description">
                    Описание
                  </FieldLabel>
                  <FieldDescription>
                    Дополнительная информация о счёте
                  </FieldDescription>
                  <Textarea
                    {...register("description")}
                    id="account-description"
                    aria-invalid={Boolean(errors.description)}
                    rows={3}
                  />
                  <FieldError errors={[errors.description]} />
                </Field>
              </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Дата создания</FieldLabel>
                <Input readOnly disabled value={formattedCreatedAt} />
              </Field>
              <Field>
                <FieldLabel>Дата обновления</FieldLabel>
                <Input readOnly disabled value={formattedUpdatedAt} />
              </Field>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export function AccountCreateGeneralForm(props: AccountGeneralFormProps) {
  return <AccountGeneralFormBase variant={CREATE_VARIANT} {...props} />;
}

export function AccountEditGeneralForm(
  props: Omit<AccountGeneralFormProps, "lockRelations">,
) {
  return (
    <AccountGeneralFormBase variant={EDIT_VARIANT} lockRelations {...props} />
  );
}
