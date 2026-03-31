"use client";

import { normalizeToAlpha2 } from "@bedrock/shared/reference-data/countries";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@bedrock/sdk-ui/components/button";
import { CountrySelect } from "@bedrock/sdk-ui/components/country-select";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { API_BASE_URL } from "@/lib/constants";
import {
  type CustomerOnboardInput,
  customerOnboardSchema,
} from "@/lib/validation";

const EXTRA_FIELDS: Array<{
  name: keyof CustomerOnboardInput;
  label: string;
  placeholder: string;
}> = [
  { name: "orgType", label: "Тип организации", placeholder: "ООО" },
  { name: "position", label: "Должность директора", placeholder: "Генеральный директор" },
  { name: "directorBasis", label: "Основание полномочий", placeholder: "Устав" },
  { name: "address", label: "Адрес", placeholder: "г. Москва, ул. ..." },
  { name: "kpp", label: "КПП", placeholder: "123456789" },
  { name: "ogrn", label: "ОГРН", placeholder: "1234567890123" },
];

const BANK_FIELDS: Array<{
  name: keyof CustomerOnboardInput;
  label: string;
  placeholder: string;
}> = [
  { name: "bankAddress", label: "Адрес банка", placeholder: "г. Москва" },
  { name: "account", label: "Расчетный счет", placeholder: "40702810..." },
  { name: "bic", label: "БИК", placeholder: "044525225" },
  { name: "corrAccount", label: "Корр. счет", placeholder: "30101810..." },
  { name: "swift", label: "SWIFT", placeholder: "DEUTDEFF" },
];

type BankProviderSearchResult = {
  address: string | null;
  bic: string | null;
  country: string | null;
  displayLabel: string;
  id: string;
  name: string;
  swift: string | null;
};

type CustomerOnboardingFormValues = z.input<typeof customerOnboardSchema>;

export function CustomerOnboardingForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [innSearchValue, setInnSearchValue] = useState("");
  const [searchingByInn, setSearchingByInn] = useState(false);
  const [innSearchSuccess, setInnSearchSuccess] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [showBankFields, setShowBankFields] = useState(false);
  const [searchingBankProviders, setSearchingBankProviders] = useState(false);
  const [bankProviderMatches, setBankProviderMatches] = useState<
    BankProviderSearchResult[]
  >([]);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CustomerOnboardingFormValues>({
    resolver: zodResolver(customerOnboardSchema) as never,
    defaultValues: {
      name: "",
      orgName: "",
      orgType: "",
      inn: "",
      directorName: "",
      position: "",
      directorBasis: "",
      address: "",
      email: "",
      phone: "",
      kpp: "",
      ogrn: "",
      oktmo: "",
      okpo: "",
      bankName: "",
      bankAddress: "",
      account: "",
      bankProviderId: undefined,
      bic: "",
      corrAccount: "",
      bankCountry: "RU",
      swift: "",
    },
  });
  const bankNameValue = useWatch({ control, name: "bankName" });
  const selectedBankProviderId = useWatch({
    control,
    name: "bankProviderId",
  });

  function applyCompanyData(companyData: Partial<CustomerOnboardInput>) {
    const fields: Array<keyof CustomerOnboardInput> = [
      "orgName",
      "orgType",
      "directorName",
      "position",
      "directorBasis",
      "address",
      "email",
      "phone",
      "inn",
      "kpp",
      "ogrn",
      "oktmo",
      "okpo",
      "bankName",
      "bankAddress",
      "account",
      "bankProviderId",
      "bic",
      "corrAccount",
      "bankCountry",
      "swift",
    ];

    for (const field of fields) {
      const value = companyData[field];
      if (value !== undefined && value !== null) {
        const nextValue =
          field === "bankCountry" && typeof value === "string"
            ? normalizeToAlpha2(value) ?? value
            : value;

        setValue(field, nextValue, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  }

  useEffect(() => {
    if (!showBankFields) {
      setBankProviderMatches([]);
      return;
    }

    if (selectedBankProviderId) {
      setBankProviderMatches([]);
      return;
    }

    const query = bankNameValue?.trim() ?? "";
    if (query.length < 2) {
      setBankProviderMatches([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchingBankProviders(true);

      try {
        const search = new URLSearchParams({
          limit: "8",
          query,
        });
        const response = await fetch(
          `${API_BASE_URL}/customer/legal-entities/bank-providers?${search.toString()}`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Ошибка поиска банка: ${response.status}`);
        }

        const payload = (await response.json()) as {
          data?: BankProviderSearchResult[];
        };
        setBankProviderMatches(payload.data ?? []);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          console.error("Bank provider search error:", searchError);
          setBankProviderMatches([]);
        }
      } finally {
        setSearchingBankProviders(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [bankNameValue, selectedBankProviderId, showBankFields]);

  function applyBankProvider(provider: BankProviderSearchResult) {
    setValue("bankProviderId", provider.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("bankName", provider.name, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("bankAddress", provider.address ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("bankCountry", provider.country ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("bic", provider.bic ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("swift", provider.swift ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setBankProviderMatches([]);
  }

  async function handleInnSearch() {
    const inn = innSearchValue.trim();
    if (!inn) {
      setError("Введите ИНН для поиска");
      return;
    }
    if (!/^\d{10,12}$/.test(inn)) {
      setError("ИНН должен содержать 10 или 12 цифр");
      return;
    }

    setError("");
    setSearchingByInn(true);
    setInnSearchSuccess(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/legal-entities/lookup-by-inn?inn=${encodeURIComponent(inn)}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `Ошибка поиска: ${response.status}`);
      }

      const companyData = await response.json();
      applyCompanyData(companyData);
      setInnSearchSuccess(true);
      setShowExtraFields(true);
    } catch (searchError) {
      console.error("INN search error:", searchError);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Ошибка поиска компании по ИНН",
      );
    } finally {
      setSearchingByInn(false);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Поддерживается только PDF формат");
      return;
    }

    setParsingFile(true);
    setError("");
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/legal-entities/parse-card`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `Ошибка распознавания: ${response.status}`);
      }

      const extractedData = await response.json();
      applyCompanyData(extractedData);
      setShowExtraFields(true);
      if (extractedData.bankName || extractedData.account || extractedData.bic) {
        setShowBankFields(true);
      }
    } catch (parseError) {
      console.error("Parse error:", parseError);
      setError(
        parseError instanceof Error
          ? parseError.message
          : "Ошибка распознавания файла",
      );
      setUploadedFileName(null);
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function onSubmit(data: CustomerOnboardingFormValues) {
    setError("");

    try {
      const parsed = customerOnboardSchema.parse(data);
      const payload: CustomerOnboardInput = {
        ...parsed,
        orgNameI18n: {
          ru: parsed.orgName || undefined,
          en: parsed.orgNameI18n?.en || undefined,
        },
        orgTypeI18n: {
          ru: parsed.orgType || undefined,
          en: parsed.orgTypeI18n?.en || undefined,
        },
        directorNameI18n: {
          ru: parsed.directorName || undefined,
          en: parsed.directorNameI18n?.en || undefined,
        },
        positionI18n: {
          ru: parsed.position || undefined,
          en: parsed.positionI18n?.en || undefined,
        },
        directorBasisI18n: {
          ru: parsed.directorBasis || undefined,
          en: parsed.directorBasisI18n?.en || undefined,
        },
        addressI18n: {
          ru: parsed.address || undefined,
          en: parsed.addressI18n?.en || undefined,
        },
        bankNameI18n: {
          ru: parsed.bankName || undefined,
          en: parsed.bankNameI18n?.en || undefined,
        },
        bankAddressI18n: {
          ru: parsed.bankAddress || undefined,
          en: parsed.bankAddressI18n?.en || undefined,
        },
      };

      const response = await fetch(`${API_BASE_URL}/customer/legal-entities`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Не удалось создать организацию");
      }

      router.push("/clients");
      router.refresh();
    } catch (submitError) {
      console.error("Onboard error:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить данные",
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Добро пожаловать</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Заполните информацию о вашей организации
        </p>
      </div>

      <div className="mb-6 rounded-lg border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Быстрое заполнение по ИНН</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Введите ИНН"
            value={innSearchValue}
            onChange={(event) => {
              setInnSearchValue(event.target.value.replace(/\D/g, ""));
              setInnSearchSuccess(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleInnSearch();
              }
            }}
            disabled={searchingByInn}
            maxLength={12}
            className="h-11"
            inputMode="numeric"
          />
          <Button
            type="button"
            onClick={() => void handleInnSearch()}
            disabled={searchingByInn || !innSearchValue.trim()}
            className="h-11 px-4"
          >
            {searchingByInn ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
        {innSearchSuccess ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Данные загружены</span>
          </div>
        ) : null}
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">или</span>
        </div>
      </div>

      <div className="mb-6 rounded-lg border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Загрузите карту партнера (PDF)</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileUpload}
          className="hidden"
          disabled={parsingFile}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={parsingFile}
          className="h-11 w-full"
        >
          {parsingFile ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Распознавание...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Загрузить PDF
            </>
          )}
        </Button>
        {uploadedFileName && !parsingFile ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="truncate">{uploadedFileName}</span>
          </div>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Ваше ФИО <span className="text-destructive">*</span>
          </Label>
          <Input id="name" {...register("name")} placeholder="Иванов Иван Иванович" />
          {errors.name ? (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="orgName">
            Название организации <span className="text-destructive">*</span>
          </Label>
          <Input id="orgName" {...register("orgName")} placeholder="ООО «Компания»" />
          {errors.orgName ? (
            <p className="text-xs text-destructive">{errors.orgName.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inn">
            ИНН <span className="text-destructive">*</span>
          </Label>
          <Input
            id="inn"
            {...register("inn")}
            placeholder="1234567890"
            inputMode="numeric"
            maxLength={12}
          />
          {errors.inn ? (
            <p className="text-xs text-destructive">{errors.inn.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="directorName">
            ФИО директора <span className="text-destructive">*</span>
          </Label>
          <Input
            id="directorName"
            {...register("directorName")}
            placeholder="Петров Петр Петрович"
          />
          {errors.directorName ? (
            <p className="text-xs text-destructive">
              {errors.directorName.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="partner@example.com"
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              {...register("phone")}
              type="tel"
              autoComplete="tel"
              placeholder="+7 999 123-45-67"
            />
            {errors.phone ? (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            ) : null}
          </div>
        </div>

        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowExtraFields((current) => !current)}
            className="w-full justify-between px-0"
          >
            <span className="text-sm text-muted-foreground">
              Дополнительные данные организации
            </span>
            {showExtraFields ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          {showExtraFields ? (
            <div className="grid gap-4 pt-2 md:grid-cols-2">
              {EXTRA_FIELDS.map((field) => (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <Input
                    id={field.name}
                    {...register(field.name)}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowBankFields((current) => !current)}
            className="w-full justify-between px-0"
          >
            <span className="text-sm text-muted-foreground">
              Банковские реквизиты
            </span>
            {showBankFields ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          {showBankFields ? (
            <div className="grid gap-4 pt-2 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="bankName">Банк</Label>
                  <Input
                    id="bankName"
                    {...register("bankName", {
                      onChange: () => {
                        if (getValues("bankProviderId")) {
                          setValue("bankProviderId", undefined, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      },
                    })}
                    placeholder="Начните вводить название банка, БИК или SWIFT"
                  />
                  {searchingBankProviders ? (
                    <p className="text-xs text-muted-foreground">
                      Ищем подходящие банки...
                    </p>
                  ) : null}
                  {bankProviderMatches.length > 0 ? (
                    <div className="rounded-md border border-border bg-background">
                      {bankProviderMatches.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                          onClick={() => applyBankProvider(provider)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {provider.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {provider.displayLabel}
                            </span>
                          </span>
                          {provider.country ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {provider.country}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {BANK_FIELDS.map((field) => (
                  <div key={field.name} className="space-y-1.5">
                    <Label htmlFor={field.name}>{field.label}</Label>
                    <Input
                    id={field.name}
                    {...register(field.name)}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="bankCountry">Страна банка</Label>
                <Controller
                  control={control}
                  name="bankCountry"
                  render={({ field, fieldState }) => (
                    <>
                      <CountrySelect
                        id="bankCountry"
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        invalid={fieldState.invalid}
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
            </div>
          ) : null}
        </div>

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Сохранить организацию
        </Button>
      </form>
    </div>
  );
}
