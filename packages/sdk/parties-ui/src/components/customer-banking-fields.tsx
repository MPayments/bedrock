"use client";

import { Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
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

export type CustomerBankProviderSearchResult = {
  address?: string | null;
  bic?: string | null;
  country?: string | null;
  displayLabel: string;
  id: string;
  name: string;
  swift?: string | null;
};

export type CustomerBankProviderSnapshot = {
  address?: string;
  country?: string;
  name?: string;
  routingCode?: string;
};

export type CustomerBankRequisiteSnapshot = {
  accountNo?: string;
  beneficiaryName?: string;
  iban?: string;
};

export type CustomerBankingFieldsValue = {
  bankMode: "existing" | "manual";
  bankProviderId: string | null;
  bankProvider: CustomerBankProviderSnapshot;
  bankRequisite: CustomerBankRequisiteSnapshot;
};

export type CustomerBankingFieldName =
  | "bankMode"
  | "bankProvider.address"
  | "bankProvider.country"
  | "bankProvider.name"
  | "bankProvider.routingCode"
  | "bankProviderId"
  | "bankRequisite.accountNo"
  | "bankRequisite.beneficiaryName"
  | "bankRequisite.iban";

export type CustomerBankingFieldValue =
  | CustomerBankingFieldsValue["bankMode"]
  | string
  | null;

export type CustomerBankingFieldErrors = Partial<
  Record<CustomerBankingFieldName, string | null | undefined>
>;

export type CustomerBankingFieldsCopy = Partial<{
  bankDescription: string;
  bankTitle: string;
  existingBankDescription: string;
  requisiteDescription: string;
  requisiteTitle: string;
}>;

export type CustomerBankingFieldsProps<
  TProvider extends CustomerBankProviderSearchResult =
    CustomerBankProviderSearchResult,
> = {
  copy?: CustomerBankingFieldsCopy;
  disabled?: boolean;
  errors?: CustomerBankingFieldErrors;
  layout?: "cards" | "plain";
  onChange: (
    name: CustomerBankingFieldName,
    value: CustomerBankingFieldValue,
  ) => void;
  searchBankProviders: (input: {
    query: string;
    signal?: AbortSignal;
  }) => Promise<TProvider[]>;
  sections?: CustomerBankingSectionName[];
  toBankProviderSnapshot?: (
    provider: TProvider,
  ) => CustomerBankProviderSnapshot;
  value: CustomerBankingFieldsValue;
};

export type CustomerBankingSectionName = "bank" | "requisites";

const DEFAULT_COPY = {
  bankDescription:
    "Выберите банк из справочника или укажите его вручную, чтобы сохранить расчётные реквизиты первого счёта.",
  bankTitle: "Банк и расчёты",
  existingBankDescription: "Выбранная запись банка доступна только для чтения.",
  requisiteDescription:
    "Сохраняются как реквизиты юридического лица, привязанные к выбранному банку.",
  requisiteTitle: "Реквизиты",
} satisfies Required<CustomerBankingFieldsCopy>;

function getRoutingCode(provider: CustomerBankProviderSearchResult) {
  const bic = provider.bic?.trim() ?? "";
  const swift = provider.swift?.trim().toUpperCase() ?? "";

  return bic || swift;
}

export function createCustomerBankProviderSnapshot(
  provider: CustomerBankProviderSearchResult,
): CustomerBankProviderSnapshot {
  return {
    address: provider.address ?? "",
    country: provider.country ?? "",
    name: provider.name,
    routingCode: getRoutingCode(provider),
  };
}

function BankCombobox<
  TProvider extends CustomerBankProviderSearchResult,
>(props: {
  disabled?: boolean;
  onManualEntry: () => void;
  onSelect: (provider: TProvider) => void;
  searchBankProviders: CustomerBankingFieldsProps<TProvider>["searchBankProviders"];
}) {
  const {
    disabled = false,
    onManualEntry,
    onSelect,
    searchBankProviders,
  } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [matches, setMatches] = useState<TProvider[]>([]);

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
        const nextMatches = await searchBankProviders({
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
  }, [disabled, open, query, searchBankProviders]);

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
                      <div className="truncate font-medium">
                        {provider.name}
                      </div>
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

function FieldError(props: { message?: string | null }) {
  if (!props.message) {
    return null;
  }

  return <p className="text-xs text-destructive">{props.message}</p>;
}

function SectionShell(props: {
  children: ReactNode;
  description: string;
  layout: "cards" | "plain";
  title: string;
}) {
  const { children, description, layout, title } = props;

  if (layout === "plain") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}

export function CustomerBankingFields<
  TProvider extends CustomerBankProviderSearchResult =
    CustomerBankProviderSearchResult,
>(props: CustomerBankingFieldsProps<TProvider>) {
  const {
    copy,
    disabled = false,
    errors = {},
    layout = "cards",
    onChange,
    searchBankProviders,
    sections = ["bank", "requisites"],
    toBankProviderSnapshot = createCustomerBankProviderSnapshot,
    value,
  } = props;
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const resolvedCopy = { ...DEFAULT_COPY, ...copy };
  const providerSelected =
    value.bankMode === "existing" && Boolean(value.bankProviderId);

  useEffect(() => {
    if (value.bankRequisite.iban?.trim() ?? "") {
      setShowAdvancedFields(true);
    }
  }, [value.bankRequisite.iban]);

  function setField(
    name: CustomerBankingFieldName,
    nextValue: CustomerBankingFieldValue,
  ) {
    onChange(name, nextValue);
  }

  function applyBankProvider(provider: TProvider) {
    const nextProvider = toBankProviderSnapshot(provider);

    setField("bankMode", "existing");
    setField("bankProviderId", provider.id);
    setField("bankProvider.name", nextProvider.name ?? "");
    setField("bankProvider.address", nextProvider.address ?? "");
    setField("bankProvider.country", nextProvider.country ?? "");
    setField("bankProvider.routingCode", nextProvider.routingCode ?? "");
  }

  function enableManualBankEntry() {
    setField("bankMode", "manual");
    setField("bankProviderId", null);
  }

  function enableBankDirectorySearch() {
    setField("bankMode", "existing");
    setField("bankProviderId", null);
  }

  function renderBankSection() {
    return (
      <SectionShell
        description={resolvedCopy.bankDescription}
        layout={layout}
        title={resolvedCopy.bankTitle}
      >
        {!providerSelected ? (
          <div className="space-y-3">
            <BankCombobox
              disabled={disabled || value.bankMode === "manual"}
              onManualEntry={enableManualBankEntry}
              onSelect={applyBankProvider}
              searchBankProviders={searchBankProviders}
            />
            <FieldError message={errors.bankProviderId} />
            {value.bankMode === "manual" ? (
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
                      value={value.bankProvider.name ?? ""}
                      onChange={(event) =>
                        setField("bankProvider.name", event.target.value)
                      }
                      placeholder="АО Банк"
                    />
                    <FieldError message={errors["bankProvider.name"]} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bankProvider.country">Страна банка</Label>
                    <CountrySelect
                      id="bankProvider.country"
                      value={value.bankProvider.country ?? ""}
                      onValueChange={(nextValue) =>
                        setField("bankProvider.country", nextValue)
                      }
                      invalid={Boolean(errors["bankProvider.country"])}
                      disabled={disabled}
                      placeholder="Выберите страну"
                      searchPlaceholder="Поиск страны..."
                      emptyLabel="Страна не найдена"
                      clearable
                      clearLabel="Очистить"
                    />
                    <FieldError message={errors["bankProvider.country"]} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bankProvider.routingCode">
                      SWIFT / BIC
                    </Label>
                    <Input
                      id="bankProvider.routingCode"
                      disabled={disabled}
                      value={value.bankProvider.routingCode ?? ""}
                      onChange={(event) =>
                        setField(
                          "bankProvider.routingCode",
                          event.target.value.toUpperCase(),
                        )
                      }
                      placeholder="DEUTDEFF / 044525225"
                    />
                    <FieldError message={errors["bankProvider.routingCode"]} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="bankProvider.address">Адрес банка</Label>
                    <Textarea
                      id="bankProvider.address"
                      disabled={disabled}
                      value={value.bankProvider.address ?? ""}
                      onChange={(event) =>
                        setField("bankProvider.address", event.target.value)
                      }
                      rows={3}
                      placeholder="г. Москва"
                    />
                    <FieldError message={errors["bankProvider.address"]} />
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
                  {resolvedCopy.existingBankDescription}
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
                  value={value.bankProvider.name ?? ""}
                  readOnly
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="selected-bank-country">Страна банка</Label>
                <Input
                  id="selected-bank-country"
                  value={value.bankProvider.country ?? ""}
                  readOnly
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="selected-bank-routing">SWIFT / BIC</Label>
                <Input
                  id="selected-bank-routing"
                  value={value.bankProvider.routingCode ?? ""}
                  readOnly
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="selected-bank-address">Адрес банка</Label>
                <Textarea
                  id="selected-bank-address"
                  value={value.bankProvider.address ?? ""}
                  rows={3}
                  readOnly
                />
              </div>
            </div>
          </div>
        )}
      </SectionShell>
    );
  }

  function renderRequisitesSection() {
    return (
      <SectionShell
        description={resolvedCopy.requisiteDescription}
        layout={layout}
        title={resolvedCopy.requisiteTitle}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bankRequisite.beneficiaryName">Получатель</Label>
            <Input
              id="bankRequisite.beneficiaryName"
              disabled={disabled}
              value={value.bankRequisite.beneficiaryName ?? ""}
              onChange={(event) =>
                setField("bankRequisite.beneficiaryName", event.target.value)
              }
              placeholder="ООО «Компания»"
            />
            <FieldError message={errors["bankRequisite.beneficiaryName"]} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankRequisite.accountNo">Номер счета</Label>
            <Input
              id="bankRequisite.accountNo"
              disabled={disabled}
              value={value.bankRequisite.accountNo ?? ""}
              onChange={(event) =>
                setField("bankRequisite.accountNo", event.target.value)
              }
              placeholder="40702810..."
            />
            <FieldError message={errors["bankRequisite.accountNo"]} />
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
              <Label htmlFor="bankRequisite.iban">IBAN</Label>
              <Input
                id="bankRequisite.iban"
                disabled={disabled}
                value={value.bankRequisite.iban ?? ""}
                onChange={(event) =>
                  setField(
                    "bankRequisite.iban",
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="DE89370400440532013000"
              />
              <FieldError message={errors["bankRequisite.iban"]} />
            </div>
          </div>
        ) : null}
      </SectionShell>
    );
  }

  return (
    <div className="space-y-4">
      {sections.includes("bank") ? renderBankSection() : null}
      {sections.includes("requisites") ? renderRequisitesSection() : null}
    </div>
  );
}
