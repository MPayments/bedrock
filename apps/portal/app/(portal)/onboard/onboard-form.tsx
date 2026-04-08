"use client";

import { normalizeToAlpha2 } from "@bedrock/shared/reference-data/countries";
import { zodResolver } from "@hookform/resolvers/zod";
import { defineStepper, Get } from "@stepperize/react";
import { StepStatus, useStepItemContext } from "@stepperize/react/primitives";
import {
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  type FieldErrors,
  useForm,
  useWatch,
} from "react-hook-form";
import { z } from "zod";

import { API_BASE_URL } from "@/lib/constants";
import {
  type CustomerOnboardInput,
  customerOnboardSchema,
} from "@/lib/validation";
import { Button } from "@bedrock/sdk-ui/components/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

const EXTRA_FIELDS: Array<{
  name: keyof CustomerOnboardInput;
  label: string;
  placeholder: string;
}> = [
  { name: "orgType", label: "Тип организации", placeholder: "ООО" },
  {
    name: "position",
    label: "Должность директора",
    placeholder: "Генеральный директор",
  },
  {
    name: "directorBasis",
    label: "Основание полномочий",
    placeholder: "Устав",
  },
  { name: "address", label: "Адрес", placeholder: "г. Москва, ул. ..." },
  { name: "kpp", label: "КПП", placeholder: "123456789" },
  { name: "ogrn", label: "ОГРН", placeholder: "1234567890123" },
];

const COUNTERPARTY_KIND_OPTIONS = [
  { label: "Юрлицо", value: "legal_entity" },
  { label: "Физлицо", value: "individual" },
] as const;

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
type CustomerOnboardingRequest = Omit<
  CustomerOnboardInput,
  "counterpartyKind"
> & {
  kind: "individual" | "legal_entity";
};

const { Stepper, ...onboardingStepperDefinition } = defineStepper(
  {
    id: "source",
    title: "Источник данных",
    description: "По ИНН, PDF или полностью вручную",
  },
  {
    id: "profile",
    title: "Контакты",
    description: "Основные данные заявителя и компании",
  },
  {
    id: "company",
    title: "Организация",
    description: "Юридические данные компании",
  },
  {
    id: "bank",
    title: "Банк",
    description: "Выбор банка из справочника или ручной ввод",
  },
  {
    id: "requisites",
    title: "Реквизиты",
    description: "Снимок реквизитов контрагента",
  },
  {
    id: "review",
    title: "Проверка",
    description: "Проверьте данные перед отправкой",
  },
);

type OnboardingStepId = Get.Id<typeof onboardingStepperDefinition.steps>;

const STEP_ERROR_FIELDS: Record<OnboardingStepId, string[]> = {
  bank: [
    "bankProviderId",
    "bankProvider.name",
    "bankProvider.country",
    "bankProvider.routingCode",
    "bankProvider.address",
  ],
  company: [
    "orgName",
    "personFullName",
    "directorName",
    "orgType",
    "position",
    "directorBasis",
    "address",
    "kpp",
    "ogrn",
  ],
  profile: ["name", "email", "phone"],
  requisites: [
    "bankRequisite.beneficiaryName",
    "bankRequisite.accountNo",
    "bankRequisite.corrAccount",
    "bankRequisite.iban",
  ],
  review: [],
  source: ["inn"],
};

const STEP_VALIDATION_FIELDS: Record<OnboardingStepId, string[]> = {
  bank: STEP_ERROR_FIELDS.bank,
  company: STEP_ERROR_FIELDS.company,
  profile: STEP_ERROR_FIELDS.profile,
  requisites: STEP_ERROR_FIELDS.requisites,
  review: [],
  source: [],
};

function getNestedError(
  errors: FieldErrors<CustomerOnboardingFormValues>,
  path: string,
) {
  const segments = path.split(".");
  let current: unknown = errors;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function stepHasErrors(
  errors: FieldErrors<CustomerOnboardingFormValues>,
  stepId: OnboardingStepId,
) {
  return STEP_ERROR_FIELDS[stepId].some((path) => getNestedError(errors, path));
}

function resolveFirstInvalidStep(
  errors: FieldErrors<CustomerOnboardingFormValues>,
) {
  return onboardingStepperDefinition.steps.find((step) =>
    stepHasErrors(errors, step.id as OnboardingStepId),
  )?.id as OnboardingStepId | undefined;
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return null;
  }

  return typeof error.message === "string" ? error.message : null;
}

const StepperTriggerWrapper = ({ hasError }: { hasError: boolean }) => {
  const item = useStepItemContext();
  const isInactive = item.status === "inactive";
  const variant = hasError
    ? "destructive"
    : isInactive
      ? "secondary"
      : "default";

  return (
    <Stepper.Trigger
      render={(domProps) => (
        <Button
          className="rounded-full"
          variant={variant}
          size="icon"
          {...domProps}
        >
          <Stepper.Indicator>{item.index + 1}</Stepper.Indicator>
        </Button>
      )}
    />
  );
};

const StepperTitleWrapper = ({
  hasError,
  title,
}: {
  hasError: boolean;
  title: string;
}) => {
  return (
    <Stepper.Title
      render={(domProps) => (
        <h4
          className={`text-base font-medium ${hasError ? "text-destructive" : ""}`}
          {...domProps}
        >
          {title}
        </h4>
      )}
    />
  );
};

const StepperDescriptionWrapper = ({
  description,
  hasError,
}: {
  description?: string;
  hasError: boolean;
}) => {
  if (!description) return null;

  return (
    <Stepper.Description
      render={(domProps) => (
        <p
          className={`text-sm ${hasError ? "text-destructive/80" : "text-muted-foreground"}`}
          {...domProps}
        >
          {description}
        </p>
      )}
    />
  );
};

const StepperSeparatorVertical = ({
  status,
  isLast,
}: {
  status: StepStatus;
  isLast: boolean;
}) => {
  if (isLast) return null;

  return (
    <div className="flex justify-center self-stretch ps-[calc(var(--spacing)*4.5-1px)]">
      <Stepper.Separator
        orientation="vertical"
        data-status={status}
        className="h-full w-0.5 bg-muted transition-all duration-300 ease-in-out data-[status=success]:bg-primary"
      />
    </div>
  );
};

function ContentWithTracking(props: {
  children: React.ReactNode;
  id: OnboardingStepId;
  isActive: boolean;
}) {
  const { children, id, isActive } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isActive]);

  return (
    <Stepper.Content
      step={id}
      render={(domProps) => (
        <div
          ref={ref}
          {...domProps}
          className="min-h-[160px] rounded-xl border bg-background p-5 transition-all duration-300"
        >
          {children}
        </div>
      )}
    />
  );
}

function normalizeRoutingCode(input: {
  bic?: string | null;
  country?: string | null;
  routingCode?: string | null;
  swift?: string | null;
}) {
  const country = input.country?.trim().toUpperCase() || "";
  const bic = input.bic?.trim() || "";
  const swift = input.swift?.trim().toUpperCase() || "";
  const routingCode = input.routingCode?.trim().toUpperCase() || "";

  if (bic || swift) {
    return {
      bic,
      routingCode: bic || swift,
      swift,
    };
  }

  if (!routingCode) {
    return {
      bic: "",
      routingCode: "",
      swift: "",
    };
  }

  return country === "RU"
    ? {
        bic: routingCode,
        routingCode,
        swift: "",
      }
    : {
        bic: "",
        routingCode,
        swift: routingCode,
      };
}

function hasProviderSelection(
  bankMode: CustomerOnboardingFormValues["bankMode"],
  bankProviderId: string | null,
) {
  return bankMode === "existing" && Boolean(bankProviderId);
}

function createManualBankProvider(provider: BankProviderSearchResult) {
  const routing = normalizeRoutingCode({
    bic: provider.bic,
    country: provider.country,
    swift: provider.swift,
  });

  return {
    address: provider.address ?? "",
    country: provider.country ?? "",
    name: provider.name,
    routingCode: routing.routingCode,
  };
}

function BankCombobox(props: {
  onManualEntry: () => void;
  onSelect: (provider: BankProviderSearchResult) => void;
}) {
  const { onManualEntry, onSelect } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [matches, setMatches] = useState<BankProviderSearchResult[]>([]);

  useEffect(() => {
    if (!open) {
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
        const search = new URLSearchParams({
          limit: "8",
          query: trimmed,
        });
        const response = await fetch(
          `${API_BASE_URL}/customer/counterparties/bank-providers?${search.toString()}`,
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
        setMatches(payload.data ?? []);
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
  }, [open, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
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

export function CustomerOnboardingForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const stepperRef = useRef<{
    navigation: {
      goTo: (id: OnboardingStepId) => void | Promise<void>;
    };
  } | null>(null);
  const [searchingByInn, setSearchingByInn] = useState(false);
  const [innSearchSuccess, setInnSearchSuccess] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [showAdvancedRequisiteFields, setShowAdvancedRequisiteFields] =
    useState(false);
  const [syncBeneficiaryName, setSyncBeneficiaryName] = useState(true);

  const {
    control,
    trigger,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerOnboardingFormValues>({
    resolver: zodResolver(customerOnboardSchema) as never,
    defaultValues: {
      address: "",
      counterpartyKind: "legal_entity",
      bankMode: "existing",
      bankProvider: {
        address: "",
        country: "RU",
        name: "",
        routingCode: "",
      },
      bankProviderId: null,
      bankRequisite: {
        accountNo: "",
        beneficiaryName: "",
        corrAccount: "",
        iban: "",
      },
      directorBasis: "",
      directorName: "",
      email: "",
      inn: "",
      kpp: "",
      name: "",
      ogrn: "",
      okpo: "",
      oktmo: "",
      orgName: "",
      orgType: "",
      personFullName: "",
      phone: "",
      position: "",
    },
  });

  const counterpartyKind = useWatch({
    control,
    name: "counterpartyKind",
  });
  const bankMode = useWatch({ control, name: "bankMode" });
  const bankProviderId = useWatch({ control, name: "bankProviderId" });
  const applicantName = useWatch({ control, name: "name" });
  const orgName = useWatch({ control, name: "orgName" });
  const personFullName = useWatch({ control, name: "personFullName" });
  const bankProviderName = useWatch({ control, name: "bankProvider.name" });
  const bankProviderAddress = useWatch({
    control,
    name: "bankProvider.address",
  });
  const bankProviderCountry = useWatch({
    control,
    name: "bankProvider.country",
  });
  const bankProviderRoutingCode = useWatch({
    control,
    name: "bankProvider.routingCode",
  });
  const innValue = useWatch({ control, name: "inn" });
  const accountNoValue = useWatch({ control, name: "bankRequisite.accountNo" });
  const beneficiaryNameValue = useWatch({
    control,
    name: "bankRequisite.beneficiaryName",
  });
  const counterpartyDisplayName =
    counterpartyKind === "individual" ? personFullName : orgName;

  useEffect(() => {
    if (syncBeneficiaryName) {
      setValue("bankRequisite.beneficiaryName", counterpartyDisplayName ?? "", {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [counterpartyDisplayName, setValue, syncBeneficiaryName]);

  function applyCompanyData(companyData: Record<string, unknown>) {
    const bankCountry =
      typeof companyData.bankCountry === "string"
        ? (normalizeToAlpha2(companyData.bankCountry) ??
          companyData.bankCountry)
        : "";
    const routingCode = normalizeRoutingCode({
      bic: typeof companyData.bic === "string" ? companyData.bic : null,
      country: bankCountry || null,
      swift: typeof companyData.swift === "string" ? companyData.swift : null,
    });

    const scalarFields = [
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
    ] as const;

    for (const field of scalarFields) {
      const value = companyData[field];
      if (typeof value === "string") {
        setValue(field, value, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }

    if (
      typeof companyData.bankName === "string" ||
      typeof companyData.bankAddress === "string" ||
      typeof companyData.account === "string" ||
      typeof companyData.bic === "string" ||
      typeof companyData.swift === "string"
    ) {
      setValue("bankMode", "manual", {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("bankProviderId", null, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("bankProvider.name", String(companyData.bankName ?? ""), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("bankProvider.address", String(companyData.bankAddress ?? ""), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("bankProvider.country", bankCountry, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("bankProvider.routingCode", routingCode.routingCode, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("bankRequisite.accountNo", String(companyData.account ?? ""), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue(
        "bankRequisite.corrAccount",
        String(companyData.corrAccount ?? ""),
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    }
  }

  function applyBankProvider(provider: BankProviderSearchResult) {
    const nextProvider = createManualBankProvider(provider);

    setValue("bankMode", "existing", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("bankProviderId", provider.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("bankProvider.name", nextProvider.name, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("bankProvider.address", nextProvider.address, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("bankProvider.country", nextProvider.country, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("bankProvider.routingCode", nextProvider.routingCode, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function enableManualBankEntry() {
    setValue("bankMode", "manual", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("bankProviderId", null, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function enableBankDirectorySearch() {
    setValue("bankMode", "existing", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("bankProviderId", null, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  async function handleInnSearch() {
    const isValid = await trigger("inn", { shouldFocus: true });
    const inn = innValue?.trim() ?? "";

    if (!isValid || !inn) {
      return;
    }

    setSearchingByInn(true);
    setInnSearchSuccess(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/customer/counterparties/lookup-by-inn?inn=${encodeURIComponent(inn)}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `Ошибка поиска: ${response.status}`);
      }

      const companyData = (await response.json()) as Record<string, unknown>;
      applyCompanyData(companyData);
      setInnSearchSuccess(true);
      void stepperRef.current?.navigation.goTo("profile");
    } catch (searchError) {
      console.error("INN search error:", searchError);
    } finally {
      setSearchingByInn(false);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      console.error("PDF parse error: unsupported file type", file.type);
      setUploadedFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setParsingFile(true);
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_BASE_URL}/customer/counterparties/parse-card`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload.message || `Ошибка распознавания: ${response.status}`,
        );
      }

      const extractedData = (await response.json()) as Record<string, unknown>;
      applyCompanyData(extractedData);
      setInnSearchSuccess(false);
      void stepperRef.current?.navigation.goTo("profile");
    } catch (parseError) {
      console.error("Parse error:", parseError);
      setUploadedFileName(null);
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function onSubmit(data: CustomerOnboardingFormValues) {
    try {
      const parsed = customerOnboardSchema.parse(data);
      const { counterpartyKind, ...rest } = parsed;
      const payload = {
        ...rest,
        kind: counterpartyKind,
        addressI18n: {
          en: parsed.addressI18n?.en || undefined,
          ru: parsed.address || undefined,
        },
        bankProviderI18n: {
          address: {
            en: undefined,
            ru: parsed.bankProvider.address || undefined,
          },
          name: {
            en: undefined,
            ru: parsed.bankProvider.name || undefined,
          },
        },
        directorBasisI18n: {
          en: parsed.directorBasisI18n?.en || undefined,
          ru: parsed.directorBasis || undefined,
        },
        directorNameI18n: {
          en: parsed.directorNameI18n?.en || undefined,
          ru: parsed.directorName || undefined,
        },
        orgNameI18n: {
          en: parsed.orgNameI18n?.en || undefined,
          ru: parsed.orgName || undefined,
        },
        orgTypeI18n: {
          en: parsed.orgTypeI18n?.en || undefined,
          ru: parsed.orgType || undefined,
        },
        personFullNameI18n: {
          en: parsed.personFullNameI18n?.en || undefined,
          ru: parsed.personFullName || undefined,
        },
        positionI18n: {
          en: parsed.positionI18n?.en || undefined,
          ru: parsed.position || undefined,
        },
      } satisfies CustomerOnboardingRequest;

      const response = await fetch(`${API_BASE_URL}/customer/counterparties`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responsePayload = await response.json().catch(() => ({}));
        throw new Error(
          responsePayload.message || "Не удалось создать контрагента",
        );
      }

      router.push("/clients");
      router.refresh();
    } catch (submitError) {
      console.error("Onboard error:", submitError);
    }
  }

  function onInvalidSubmit(
    formErrors: FieldErrors<CustomerOnboardingFormValues>,
  ) {
    const invalidStep = resolveFirstInvalidStep(formErrors);
    if (invalidStep) {
      void stepperRef.current?.navigation.goTo(invalidStep);
    }
  }

  async function handleNextStep(currentStepId: OnboardingStepId) {
    const fields = STEP_VALIDATION_FIELDS[currentStepId];

    if (fields.length === 0) {
      return true;
    }

    const valid = await trigger(fields as never, {
      shouldFocus: true,
    });

    if (!valid) {
      return false;
    }

    return true;
  }

  const providerSelected = hasProviderSelection(
    bankMode,
    (bankProviderId as string | null | undefined) ?? null,
  );

  function renderStepContent(stepId: OnboardingStepId) {
    if (stepId === "source") {
      return (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="counterpartyKind">Тип контрагента</Label>
            <Controller
              control={control}
              name="counterpartyKind"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="counterpartyKind">
                    <SelectValue placeholder="Выберите тип контрагента" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTERPARTY_KIND_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Как хотите начать?</p>
            <p className="text-sm text-muted-foreground">
              {counterpartyKind === "legal_entity"
                ? "Быстро заполните организацию по ИНН, загрузите карточку партнера или переходите к ручному заполнению."
                : "Для физлица заполнение идет вручную: укажите ФИО, контакты и при необходимости банковские реквизиты."}
            </p>
          </div>

          {counterpartyKind === "legal_entity" ? (
            <>
              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    Быстрое заполнение по ИНН
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="source-inn">
                    Введите ИНН <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="source-inn"
                      {...register("inn")}
                      inputMode="numeric"
                      maxLength={12}
                      disabled={searchingByInn}
                      placeholder="1234567890"
                      onChange={(event) => {
                        register("inn").onChange(event);
                        setInnSearchSuccess(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleInnSearch();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => void handleInnSearch()}
                      disabled={searchingByInn}
                      className="shrink-0"
                    >
                      {searchingByInn ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Заполнить"
                      )}
                    </Button>
                  </div>
                  {errors.inn ? (
                    <p className="text-xs text-destructive">{errors.inn.message}</p>
                  ) : null}
                  {innSearchSuccess ? (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Данные организации загружены</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    Загрузите карту партнера (PDF)
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Мы попытаемся извлечь реквизиты и заполнить форму автоматически.
                </p>
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
                  className="w-full"
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span className="truncate">{uploadedFileName}</span>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <div className="rounded-xl border border-dashed p-4">
            <p className="text-sm font-medium">Заполнить вручную</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {counterpartyKind === "legal_entity"
                ? "Если у вас нет ИНН под рукой или карточки партнера, продолжайте по шагам и заполните данные вручную."
                : "Продолжайте по шагам и заполните данные физлица вручную."}
            </p>
          </div>
        </div>
      );
    }

    if (stepId === "profile") {
      return (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Контакты заявителя</p>
            <p className="text-sm text-muted-foreground">
              Кто оформляет onboarding и как с вами связаться.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">
              Ваше ФИО <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Иванов Иван Иванович"
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>

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
      );
    }

    if (stepId === "company") {
      return (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {counterpartyKind === "legal_entity"
                ? "Данные организации"
                : "Данные контрагента"}
            </p>
            <p className="text-sm text-muted-foreground">
              {counterpartyKind === "legal_entity"
                ? "Юридическая информация компании и подписанта."
                : "Основные данные физлица: ФИО, адрес и идентификаторы."}
            </p>
          </div>

          {counterpartyKind === "legal_entity" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="orgName">
                  Название организации <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="orgName"
                  {...register("orgName")}
                  placeholder="ООО «Компания»"
                />
                {errors.orgName ? (
                  <p className="text-xs text-destructive">
                    {errors.orgName.message}
                  </p>
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
                {EXTRA_FIELDS.map((field) => (
                  <div key={field.name} className="space-y-1.5">
                    <Label htmlFor={field.name}>{field.label}</Label>
                    <Input
                      id={field.name}
                      {...register(field.name)}
                      placeholder={field.placeholder}
                    />
                    {getErrorMessage(
                      (errors as Record<string, unknown>)[field.name],
                    ) ? (
                      <p className="text-xs text-destructive">
                        {getErrorMessage(
                          (errors as Record<string, unknown>)[field.name],
                        )}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="personFullName">
                  ФИО контрагента <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="personFullName"
                  {...register("personFullName")}
                  placeholder="Иванов Иван Иванович"
                />
                {errors.personFullName ? (
                  <p className="text-xs text-destructive">
                    {errors.personFullName.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="address">Адрес</Label>
                  <Input
                    id="address"
                    {...register("address")}
                    placeholder="г. Москва, ул. ..."
                  />
                  {errors.address ? (
                    <p className="text-xs text-destructive">
                      {errors.address.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inn">ИНН</Label>
                  <Input
                    id="inn"
                    {...register("inn")}
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="123456789012"
                  />
                  {errors.inn ? (
                    <p className="text-xs text-destructive">
                      {errors.inn.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    if (stepId === "bank") {
      return (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Банк</p>
            <p className="text-sm text-muted-foreground">
              Выберите банк из справочника или введите данные вручную.
            </p>
          </div>

          {!providerSelected ? (
            <div className="space-y-3">
              <BankCombobox
                onManualEntry={enableManualBankEntry}
                onSelect={applyBankProvider}
              />
              {errors.bankProviderId ? (
                <p className="text-xs text-destructive">
                  {errors.bankProviderId.message}
                </p>
              ) : null}
              {bankMode === "manual" ? (
                <div className="rounded-md border border-dashed p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Ручной ввод банка</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={enableBankDirectorySearch}
                    >
                      Выбрать из справочника
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="bankProvider.name">Название банка</Label>
                      <Input
                        id="bankProvider.name"
                        {...register("bankProvider.name")}
                        placeholder="АО Банк"
                      />
                      {errors.bankProvider?.name ? (
                        <p className="text-xs text-destructive">
                          {errors.bankProvider.name.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bankProvider.country">Страна банка</Label>
                      <Controller
                        control={control}
                        name="bankProvider.country"
                        render={({ field, fieldState }) => (
                          <>
                            <CountrySelect
                              id="bankProvider.country"
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
                    <div className="space-y-1.5">
                      <Label htmlFor="bankProvider.routingCode">
                        SWIFT / BIC
                      </Label>
                      <Input
                        id="bankProvider.routingCode"
                        {...register("bankProvider.routingCode")}
                        placeholder="DEUTDEFF / 044525225"
                      />
                      {errors.bankProvider?.routingCode ? (
                        <p className="text-xs text-destructive">
                          {errors.bankProvider.routingCode.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="bankProvider.address">Адрес банка</Label>
                      <Textarea
                        id="bankProvider.address"
                        {...register("bankProvider.address")}
                        rows={3}
                        placeholder="г. Москва"
                      />
                      {errors.bankProvider?.address ? (
                        <p className="text-xs text-destructive">
                          {errors.bankProvider.address.message}
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
                    Данные банка доступны только для чтения. Для изменения
                    переключитесь на ручной ввод.
                  </p>
                </div>
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
        </div>
      );
    }

    if (stepId === "review") {
      const reviewRows = [
        { label: "ИНН", value: innValue },
        { label: "Контакт", value: applicantName },
        {
          label: counterpartyKind === "legal_entity" ? "Организация" : "Контрагент",
          value: counterpartyDisplayName,
        },
        {
          label: "Банк",
          value: bankProviderName,
        },
        { label: "Счет", value: accountNoValue },
        { label: "Получатель", value: beneficiaryNameValue },
      ];

      return (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Проверьте данные перед отправкой
            </p>
            <p className="text-sm text-muted-foreground">
              Если что-то выглядит неверно, вернитесь к нужному шагу и поправьте
              поля.
            </p>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <dl className="space-y-3">
              {reviewRows.map((row) => (
                <div
                  key={row.label}
                  className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="text-sm font-medium">
                    {row.value?.trim() ? row.value : "Не заполнено"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Реквизиты счета</p>
          <p className="text-sm text-muted-foreground">
            Реквизиты сохраняются как снимок данных для выбранного контрагента.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bankRequisite.beneficiaryName">Получатель</Label>
            <Input
              id="bankRequisite.beneficiaryName"
              {...register("bankRequisite.beneficiaryName", {
                onChange: () => setSyncBeneficiaryName(false),
              })}
              placeholder="ООО «Компания»"
            />
            {errors.bankRequisite?.beneficiaryName ? (
              <p className="text-xs text-destructive">
                {errors.bankRequisite.beneficiaryName.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankRequisite.accountNo">Номер счета</Label>
            <Input
              id="bankRequisite.accountNo"
              {...register("bankRequisite.accountNo")}
              placeholder="40702810..."
            />
            {errors.bankRequisite?.accountNo ? (
              <p className="text-xs text-destructive">
                {errors.bankRequisite.accountNo.message}
              </p>
            ) : null}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowAdvancedRequisiteFields((current) => !current)}
          className="justify-start px-0 text-sm text-muted-foreground"
        >
          {showAdvancedRequisiteFields
            ? "Скрыть дополнительные реквизиты"
            : "Показать дополнительные реквизиты"}
        </Button>

        {showAdvancedRequisiteFields ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bankRequisite.corrAccount">Корр. счет</Label>
              <Input
                id="bankRequisite.corrAccount"
                {...register("bankRequisite.corrAccount")}
                placeholder="30101810..."
              />
              {errors.bankRequisite?.corrAccount ? (
                <p className="text-xs text-destructive">
                  {errors.bankRequisite.corrAccount.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankRequisite.iban">IBAN</Label>
              <Input
                id="bankRequisite.iban"
                {...register("bankRequisite.iban")}
                placeholder="DE89370400440532013000"
              />
              {errors.bankRequisite?.iban ? (
                <p className="text-xs text-destructive">
                  {errors.bankRequisite.iban.message}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Добро пожаловать</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Заполните информацию о вашем контрагенте
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit as never, onInvalidSubmit)}
        className="space-y-6"
      >
        <Stepper.Root className="w-full space-y-4" orientation="vertical">
          {({ stepper }) => (
            <>
              {(() => {
                stepperRef.current = stepper;
                return null;
              })()}
              <Stepper.List className="flex list-none flex-col">
                {stepper.state.all.map((stepData, index) => {
                  const currentIndex = stepper.state.current.index;
                  const status =
                    index < currentIndex
                      ? "success"
                      : index === currentIndex
                        ? "active"
                        : "inactive";
                  const isLast = index === stepper.state.all.length - 1;
                  const data = stepData as {
                    description?: string;
                    id: string;
                    title: string;
                  };
                  const hasError = stepHasErrors(
                    errors,
                    stepData.id as OnboardingStepId,
                  );

                  return (
                    <Fragment key={stepData.id}>
                      <Stepper.Item
                        step={stepData.id}
                        className="group peer relative flex items-center gap-2"
                      >
                        <StepperTriggerWrapper hasError={hasError} />
                        <div className="flex flex-col items-start gap-1">
                          <StepperTitleWrapper
                            hasError={hasError}
                            title={data.title}
                          />
                          <StepperDescriptionWrapper
                            description={data.description}
                            hasError={hasError}
                          />
                        </div>
                      </Stepper.Item>
                      <div className="flex gap-4">
                        <StepperSeparatorVertical
                          status={status}
                          isLast={isLast}
                        />
                        <div className="flex-1 py-2 ps-4">
                          <ContentWithTracking
                            id={stepData.id as OnboardingStepId}
                            isActive={status === "active"}
                          >
                            {renderStepContent(stepData.id as OnboardingStepId)}
                          </ContentWithTracking>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </Stepper.List>
              <Stepper.Actions className="sticky bottom-0 flex justify-end gap-4 bg-background py-4">
                {!stepper.state.isFirst ? (
                  <Stepper.Prev
                    render={(domProps) => (
                      <Button type="button" variant="secondary" {...domProps}>
                        Назад
                      </Button>
                    )}
                  />
                ) : null}
                {stepper.state.isLast ? (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Сохранить
                  </Button>
                ) : (
                  <Stepper.Next
                    render={(domProps) => (
                      <Button
                        type="button"
                        {...domProps}
                        onClick={async (event) => {
                          const valid = await handleNextStep(
                            stepper.state.current.data.id as OnboardingStepId,
                          );
                          if (valid) {
                            domProps.onClick?.(event);
                          }
                        }}
                      >
                        Далее
                      </Button>
                    )}
                  />
                )}
              </Stepper.Actions>
            </>
          )}
        </Stepper.Root>
      </form>
    </div>
  );
}
