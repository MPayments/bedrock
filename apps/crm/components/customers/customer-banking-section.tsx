"use client";

import { useEffect, useState } from "react";
import {
  Controller,
  type Path,
  type PathValue,
  type UseFormReturn,
} from "react-hook-form";
import { Search } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@bedrock/sdk-ui/components/command";
import { CountrySelect } from "@bedrock/sdk-ui/components/country-select";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import {
  createManualBankProvider,
  searchCustomerBankProviders,
  type CustomerBankProviderSearchResult,
} from "@/lib/customer-banking";

type BankingFieldValues = {
  bankMode: "existing" | "manual";
  bankProviderId: string | null;
  bankProvider: {
    address?: string;
    country?: string;
    name?: string;
    routingCode?: string;
  };
  bankRequisite: {
    accountNo?: string;
    beneficiaryName?: string;
    corrAccount?: string;
    iban?: string;
  };
};

function getNestedError(
  errors: Record<string, unknown>,
  path: string,
) {
  const segments = path.split(".");
  let current: unknown = errors;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  if (!current || typeof current !== "object" || !("message" in current)) {
    return null;
  }

  return typeof current.message === "string" ? current.message : null;
}

function BankCombobox(props: {
  disabled?: boolean;
  onManualEntry: () => void;
  onSelect: (provider: CustomerBankProviderSearchResult) => void;
}) {
  const { disabled = false, onManualEntry, onSelect } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [matches, setMatches] = useState<CustomerBankProviderSearchResult[]>(
    [],
  );

  useEffect(() => {
    if (!open || disabled) {
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setIsLoading(false);
      setMatches([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);

      try {
        const nextMatches = await searchCustomerBankProviders({
          query: trimmed,
          signal: controller.signal,
        });
        setMatches(nextMatches);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          console.error("Bank provider search error:", searchError);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [disabled, open, query]);

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            disabled={disabled}
          />
        }
      >
        <span className="truncate text-muted-foreground">
          Найти банк по названию или SWIFT / BIC
        </span>
        <Search className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Начните вводить название банка или SWIFT / BIC"
          />
          <CommandList className="max-h-72">
            {query.trim().length < 2 ? (
              <CommandEmpty>Введите минимум 2 символа для поиска</CommandEmpty>
            ) : null}
            {query.trim().length >= 2 && matches.length === 0 && !isLoading ? (
              <CommandEmpty>Банк не найден</CommandEmpty>
            ) : null}
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Ищем подходящие банки...
              </div>
            ) : null}
            {matches.length > 0 ? (
              <CommandGroup heading="Результаты">
                {matches.map((provider) => (
                  <CommandItem
                    key={provider.id}
                    value={provider.displayLabel}
                    onSelect={() => {
                      onSelect(provider);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{provider.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {provider.displayLabel}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="manual-entry"
                onSelect={() => {
                  onManualEntry();
                  setOpen(false);
                  setQuery("");
                }}
              >
                Ввести банк вручную
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CustomerBankingSection(props: {
  disabled?: boolean;
  form: UseFormReturn<BankingFieldValues>;
}) {
  const { disabled = false, form } = props;
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const bankMode = form.watch("bankMode") as BankingFieldValues["bankMode"];
  const bankProviderId = form.watch("bankProviderId") as string | null;
  const bankProviderName = form.watch("bankProvider.name") as string | undefined;
  const bankProviderAddress = form.watch(
    "bankProvider.address",
  ) as string | undefined;
  const bankProviderCountry = form.watch(
    "bankProvider.country",
  ) as string | undefined;
  const bankProviderRoutingCode = form.watch(
    "bankProvider.routingCode",
  ) as string | undefined;
  const beneficiaryName = form.watch(
    "bankRequisite.beneficiaryName",
  ) as string | undefined;
  const accountNo = form.watch("bankRequisite.accountNo") as string | undefined;
  const corrAccount = form.watch(
    "bankRequisite.corrAccount",
  ) as string | undefined;
  const iban = form.watch("bankRequisite.iban") as string | undefined;
  const providerSelected = bankMode === "existing" && Boolean(bankProviderId);
  const errors = form.formState.errors as Record<string, unknown>;

  useEffect(() => {
    if ((corrAccount?.trim() ?? "") || (iban?.trim() ?? "")) {
      setShowAdvancedFields(true);
    }
  }, [corrAccount, iban]);

  function setField<TPath extends Path<BankingFieldValues>>(
    name: TPath,
    value: PathValue<BankingFieldValues, TPath>,
  ) {
    form.setValue(name, value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function applyBankProvider(provider: CustomerBankProviderSearchResult) {
    const nextProvider = createManualBankProvider(provider);

    setField("bankMode", "existing");
    setField("bankProviderId", provider.id);
    setField("bankProvider.name", nextProvider.name);
    setField("bankProvider.address", nextProvider.address);
    setField("bankProvider.country", nextProvider.country);
    setField("bankProvider.routingCode", nextProvider.routingCode);
  }

  function enableManualBankEntry() {
    setField("bankMode", "manual");
    setField("bankProviderId", null);
  }

  function enableBankDirectorySearch() {
    setField("bankMode", "existing");
    setField("bankProviderId", null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Банк и расчёты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Выберите банк из справочника или укажите его вручную, чтобы
            сохранить расчётные реквизиты первого счёта.
          </p>

          {!providerSelected ? (
            <div className="space-y-3">
              <BankCombobox
                disabled={disabled || bankMode === "manual"}
                onManualEntry={enableManualBankEntry}
                onSelect={applyBankProvider}
              />
              {getNestedError(errors, "bankProviderId") ? (
                <p className="text-xs text-destructive">
                  {getNestedError(errors, "bankProviderId")}
                </p>
              ) : null}
              {bankMode === "manual" ? (
                <div className="rounded-md border border-dashed p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Ручной ввод банка</p>
                    {!disabled ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={enableBankDirectorySearch}
                      >
                        Выбрать из справочника
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="bankProvider.name">Название банка</Label>
                      <Input
                        id="bankProvider.name"
                        disabled={disabled}
                        value={bankProviderName ?? ""}
                        onChange={(event) =>
                          setField("bankProvider.name", event.target.value)
                        }
                        placeholder="АО Банк"
                      />
                      {getNestedError(errors, "bankProvider.name") ? (
                        <p className="text-xs text-destructive">
                          {getNestedError(errors, "bankProvider.name")}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bankProvider.country">Страна банка</Label>
                      <Controller
                        control={form.control}
                        name="bankProvider.country"
                        render={({ field, fieldState }) => (
                          <>
                            <CountrySelect
                              id="bankProvider.country"
                              value={(field.value as string | undefined) ?? ""}
                              onValueChange={field.onChange}
                              invalid={fieldState.invalid}
                              disabled={disabled}
                              placeholder="Выберите страну"
                              searchPlaceholder="Поиск страны..."
                              emptyLabel="Страна не найдена"
                              clearable
                              clearLabel="Очистить"
                            />
                            {fieldState.error ? (
                              <p className="text-xs text-destructive">
                                {fieldState.error.message}
                              </p>
                            ) : null}
                          </>
                        )}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bankProvider.routingCode">
                        SWIFT / BIC
                      </Label>
                      <Input
                        id="bankProvider.routingCode"
                        disabled={disabled}
                        value={bankProviderRoutingCode ?? ""}
                        onChange={(event) =>
                          setField(
                            "bankProvider.routingCode",
                            event.target.value.toUpperCase(),
                          )
                        }
                        placeholder="DEUTDEFF / 044525225"
                      />
                      {getNestedError(errors, "bankProvider.routingCode") ? (
                        <p className="text-xs text-destructive">
                          {getNestedError(errors, "bankProvider.routingCode")}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="bankProvider.address">Адрес банка</Label>
                      <Textarea
                        id="bankProvider.address"
                        disabled={disabled}
                        value={bankProviderAddress ?? ""}
                        onChange={(event) =>
                          setField("bankProvider.address", event.target.value)
                        }
                        rows={3}
                        placeholder="г. Москва"
                      />
                      {getNestedError(errors, "bankProvider.address") ? (
                        <p className="text-xs text-destructive">
                          {getNestedError(errors, "bankProvider.address")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Банк из справочника</p>
                  <p className="text-xs text-muted-foreground">
                    Выбранная запись банка доступна только для чтения.
                  </p>
                </div>
                {!disabled ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={enableBankDirectorySearch}
                    >
                      Изменить банк
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={enableManualBankEntry}
                    >
                      Ввести вручную
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="selected-bank-name">Название банка</Label>
                  <Input
                    id="selected-bank-name"
                    value={bankProviderName ?? ""}
                    readOnly
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="selected-bank-country">Страна банка</Label>
                  <Input
                    id="selected-bank-country"
                    value={bankProviderCountry ?? ""}
                    readOnly
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="selected-bank-routing">SWIFT / BIC</Label>
                  <Input
                    id="selected-bank-routing"
                    value={bankProviderRoutingCode ?? ""}
                    readOnly
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="selected-bank-address">Адрес банка</Label>
                  <Textarea
                    id="selected-bank-address"
                    value={bankProviderAddress ?? ""}
                    rows={3}
                    readOnly
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Реквизиты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Сохраняются как реквизиты юридического лица, привязанные к выбранному
            банку.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bankRequisite.beneficiaryName">Получатель</Label>
              <Input
                id="bankRequisite.beneficiaryName"
                disabled={disabled}
                value={beneficiaryName ?? ""}
                onChange={(event) =>
                  setField("bankRequisite.beneficiaryName", event.target.value)
                }
                placeholder="ООО «Компания»"
              />
              {getNestedError(errors, "bankRequisite.beneficiaryName") ? (
                <p className="text-xs text-destructive">
                  {getNestedError(errors, "bankRequisite.beneficiaryName")}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankRequisite.accountNo">Номер счета</Label>
              <Input
                id="bankRequisite.accountNo"
                disabled={disabled}
                value={accountNo ?? ""}
                onChange={(event) =>
                  setField("bankRequisite.accountNo", event.target.value)
                }
                placeholder="40702810..."
              />
              {getNestedError(errors, "bankRequisite.accountNo") ? (
                <p className="text-xs text-destructive">
                  {getNestedError(errors, "bankRequisite.accountNo")}
                </p>
              ) : null}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowAdvancedFields((current) => !current)}
            className="justify-start px-0 text-sm text-muted-foreground"
          >
            {showAdvancedFields
              ? "Скрыть дополнительные реквизиты"
              : "Показать дополнительные реквизиты"}
          </Button>

          {showAdvancedFields ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bankRequisite.corrAccount">Корр. счет</Label>
                <Input
                  id="bankRequisite.corrAccount"
                  disabled={disabled}
                  value={corrAccount ?? ""}
                  onChange={(event) =>
                    setField("bankRequisite.corrAccount", event.target.value)
                  }
                  placeholder="30101810..."
                />
                {getNestedError(errors, "bankRequisite.corrAccount") ? (
                  <p className="text-xs text-destructive">
                    {getNestedError(errors, "bankRequisite.corrAccount")}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankRequisite.iban">IBAN</Label>
                <Input
                  id="bankRequisite.iban"
                  disabled={disabled}
                  value={iban ?? ""}
                  onChange={(event) =>
                    setField("bankRequisite.iban", event.target.value.toUpperCase())
                  }
                  placeholder="DE89370400440532013000"
                />
                {getNestedError(errors, "bankRequisite.iban") ? (
                  <p className="text-xs text-destructive">
                    {getNestedError(errors, "bankRequisite.iban")}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
