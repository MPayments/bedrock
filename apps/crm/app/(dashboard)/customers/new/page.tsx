"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileText,
  Languages,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useForm,
  type Path,
  type PathValue,
  type UseFormReturn,
} from "react-hook-form";
import { z } from "zod";

import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@bedrock/sdk-ui/components/accordion";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@bedrock/sdk-ui/components/alert";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import { CustomerBankingSection } from "@/components/customers/customer-banking-section";
import { apiClient } from "@/lib/api-client";
import { readJsonWithSchema } from "@/lib/api/response";
import { API_BASE_URL } from "@/lib/constants";
import { mapFlatBankingToFormValues } from "@/app/(dashboard)/customers/_lib/customer-banking";
import { translateFieldsToEnglish } from "@/lib/translate-fields";
import type { CustomerBankingFormData } from "@/lib/validation";
import { CustomerCreateHeader } from "./_components/customer-create-header";
import { PendingCreateLeaveDialog } from "./_components/pending-create-leave-dialog";
import {
  buildCounterpartyAssignmentPayload,
  buildCounterpartyBankRequisiteCreatePayload,
  buildCustomerCounterpartyCreatePayload,
  buildCustomerCreatePayload,
  buildManualBankProviderCreatePayload,
  customerCreateSchema,
  getCustomerCreateDefaultValues,
  resolveDefaultRequisiteCurrencyCode,
  type CustomerCreateFormData,
} from "./_lib/customer-create";

type SubAgent = {
  commission: number;
  id: string;
  isActive: boolean;
  kind: "individual" | "legal_entity";
  name: string;
};

type SubAgentProfileResponse = {
  commissionRate: number;
  counterpartyId: string;
  isActive: boolean;
  kind: "individual" | "legal_entity";
  shortName: string;
};

const CreatedCustomerSchema = z.object({
  id: z.uuid(),
});

const CreatedCounterpartySchema = z.object({
  id: z.uuid(),
});

const RequisiteProviderDetailSchema = z.object({
  id: z.uuid(),
  country: z.string().nullable(),
  branches: z.array(
    z.object({
      id: z.uuid(),
      isPrimary: z.boolean(),
    }),
  ),
});

function getResponseErrorMessage(
  payload: unknown,
  fallback: string,
) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;

  return (
    (typeof record.message === "string" && record.message) ||
    (typeof record.error === "string" && record.error) ||
    fallback
  );
}

function mapSubAgentProfileToOption(
  profile: SubAgentProfileResponse,
): SubAgent {
  return {
    commission: profile.commissionRate,
    id: profile.counterpartyId,
    isActive: profile.isActive,
    kind: profile.kind,
    name: profile.shortName,
  };
}

const SUB_AGENT_PAGE_LIMIT = 200;

const SUBJECT_KIND_OPTIONS = [
  { value: "legal_entity", label: "Юрлицо" },
  { value: "individual", label: "Физлицо" },
] as const;

const SUB_AGENT_KIND_OPTIONS = [
  { value: "individual", label: "Физическое лицо" },
  { value: "legal_entity", label: "Юридическое лицо" },
] as const;

function getNestedError(errors: Record<string, unknown>, path: string) {
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

function Field({
  form,
  label,
  name,
  placeholder,
  required = false,
  type = "text",
}: {
  form: UseFormReturn<CustomerCreateFormData>;
  label: string;
  name: Path<CustomerCreateFormData>;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  const error = getNestedError(
    form.formState.errors as Record<string, unknown>,
    name,
  );
  const value = (form.watch(name) as string | undefined) ?? "";

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={name}
        value={value}
        onChange={(event) =>
          form.setValue(
            name,
            event.target.value as PathValue<
              CustomerCreateFormData,
              typeof name
            >,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          )
        }
        placeholder={placeholder}
        type={type}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function TextareaField({
  form,
  label,
  name,
  placeholder,
  rows = 3,
}: {
  form: UseFormReturn<CustomerCreateFormData>;
  label: string;
  name: Path<CustomerCreateFormData>;
  placeholder?: string;
  rows?: number;
}) {
  const error = getNestedError(
    form.formState.errors as Record<string, unknown>,
    name,
  );
  const value = (form.watch(name) as string | undefined) ?? "";

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea
        id={name}
        value={value}
        onChange={(event) =>
          form.setValue(
            name,
            event.target.value as PathValue<
              CustomerCreateFormData,
              typeof name
            >,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          )
        }
        placeholder={placeholder}
        rows={rows}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export default function NewCustomerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [loadingSubAgents, setLoadingSubAgents] = useState(false);
  const [createNewSubAgent, setCreateNewSubAgent] = useState(false);
  const [creatingSubAgent, setCreatingSubAgent] = useState(false);
  const [newSubAgentName, setNewSubAgentName] = useState("");
  const [newSubAgentCommission, setNewSubAgentCommission] = useState("");
  const [newSubAgentKind, setNewSubAgentKind] = useState<
    "individual" | "legal_entity"
  >("individual");
  const [subAgentErrors, setSubAgentErrors] = useState<{
    commission?: string;
    name?: string;
  }>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const [innSearchValue, setInnSearchValue] = useState("");
  const [searchingByInn, setSearchingByInn] = useState(false);
  const [innSearchSuccess, setInnSearchSuccess] = useState(false);

  const [parsingFile, setParsingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [translating, setTranslating] = useState(false);

  const form = useForm<CustomerCreateFormData>({
    defaultValues: getCustomerCreateDefaultValues(),
    mode: "onBlur",
    resolver: zodResolver(customerCreateSchema) as never,
  });

  const addSubAgent = form.watch("addSubAgent");
  const counterpartyKind = form.watch("counterpartyKind");
  const formDirty = form.formState.isDirty;

  const loadSubAgents = useCallback(async () => {
    setLoadingSubAgents(true);

    try {
      const loadedSubAgents: SubAgent[] = [];
      let offset = 0;
      let total = 0;

      do {
        const params = new URLSearchParams({
          limit: String(SUB_AGENT_PAGE_LIMIT),
          offset: String(offset),
          sortBy: "shortName",
          sortOrder: "asc",
        });
        const response = await fetch(
          `${API_BASE_URL}/sub-agent-profiles?${params.toString()}`,
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(`Ошибка загрузки субагентов: ${response.status}`);
        }

        const raw = (await response.json()) as {
          data?: SubAgentProfileResponse[];
          total?: number;
        };
        const page = (raw.data ?? []).map(mapSubAgentProfileToOption);

        loadedSubAgents.push(...page);
        total = raw.total ?? loadedSubAgents.length;
        offset += SUB_AGENT_PAGE_LIMIT;
      } while (offset < total);

      setSubAgents(loadedSubAgents);
    } catch (loadError) {
      console.error("Error loading sub-agents:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Ошибка загрузки субагентов",
      );
    } finally {
      setLoadingSubAgents(false);
    }
  }, []);

  useEffect(() => {
    if (addSubAgent && subAgents.length === 0) {
      void loadSubAgents();
    }
  }, [addSubAgent, loadSubAgents, subAgents.length]);

  function attemptLeave() {
    if (formDirty) {
      setLeaveDialogOpen(true);
      return;
    }

    router.back();
  }

  function resetInlineSubAgentDraft() {
    setCreateNewSubAgent(false);
    setCreatingSubAgent(false);
    setNewSubAgentName("");
    setNewSubAgentCommission("");
    setNewSubAgentKind("individual");
    setSubAgentErrors({});
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

    setSearchingByInn(true);
    setError(null);
    setInnSearchSuccess(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/counterparties/lookup-by-inn?inn=${encodeURIComponent(inn)}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          getResponseErrorMessage(
            errorData,
            `Ошибка поиска: ${response.status}`,
          ),
        );
      }

      const companyData = await response.json();
      const fieldsToSet: Path<CustomerCreateFormData>[] = [
        "orgName",
        "orgType",
        "directorName",
        "position",
        "directorBasis",
        "address",
        "inn",
        "kpp",
        "ogrn",
        "oktmo",
        "okpo",
      ];

      fieldsToSet.forEach((field) => {
        const value = companyData[field];
        if (typeof value === "string" && value.length > 0) {
          form.setValue(
            field,
            value as PathValue<CustomerCreateFormData, typeof field>,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );
        }
      });

      setInnSearchSuccess(true);
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

  async function handleTranslateToEnglish() {
    setTranslating(true);
    setError(null);

    try {
      const values = form.getValues();
      const translated = await translateFieldsToEnglish(
        values.counterpartyKind === "legal_entity"
          ? {
              address: values.address,
              directorBasis: values.directorBasis,
              directorName: values.directorName,
              orgName: values.orgName,
              orgType: values.orgType,
              position: values.position,
            }
          : {
              address: values.address,
              personFullName: values.personFullName,
            },
      );

      const mapping: Record<string, Path<CustomerCreateFormData>> =
        values.counterpartyKind === "legal_entity"
          ? {
              address: "addressI18n.en",
              directorBasis: "directorBasisI18n.en",
              directorName: "directorNameI18n.en",
              orgName: "orgNameI18n.en",
              orgType: "orgTypeI18n.en",
              position: "positionI18n.en",
            }
          : {
              address: "addressI18n.en",
              personFullName: "personFullNameI18n.en",
            };

      Object.entries(mapping).forEach(([sourceField, targetField]) => {
        const value = translated[sourceField];
        if (typeof value === "string" && value.length > 0) {
          form.setValue(
            targetField,
            value as PathValue<CustomerCreateFormData, typeof targetField>,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );
        }
      });
    } catch (translationError) {
      console.error("Translation error:", translationError);
      setError(
        translationError instanceof Error
          ? translationError.message
          : "Ошибка перевода полей",
      );
    } finally {
      setTranslating(false);
    }
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Поддерживается только PDF формат");
      return;
    }

    setParsingFile(true);
    setError(null);
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_BASE_URL}/counterparties/parse-card`,
        {
          body: formData,
          credentials: "include",
          method: "POST",
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          getResponseErrorMessage(
            errorData,
            `Ошибка распознавания: ${response.status}`,
          ),
        );
      }

      const extractedData = await response.json();
      const bankDefaults = mapFlatBankingToFormValues({
        account: extractedData.account,
        bankAddress: extractedData.bankAddress,
        bankCountry: extractedData.bankCountry,
        bankName: extractedData.bankName,
        bic: extractedData.bic,
        swift: extractedData.swift,
      });
      const fieldsToSet: Path<CustomerCreateFormData>[] = [
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
      ];

      fieldsToSet.forEach((field) => {
        const value = extractedData[field];
        if (typeof value === "string" && value.length > 0) {
          form.setValue(
            field,
            value as PathValue<CustomerCreateFormData, typeof field>,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );
        }
      });

      if (
        extractedData.bankName ||
        extractedData.bankAddress ||
        extractedData.account ||
        extractedData.bic ||
        extractedData.swift
      ) {
        form.setValue("bankMode", bankDefaults.bankMode, {
          shouldDirty: true,
          shouldValidate: true,
        });
        form.setValue("bankProviderId", bankDefaults.bankProviderId, {
          shouldDirty: true,
          shouldValidate: true,
        });
        form.setValue("bankProvider", bankDefaults.bankProvider, {
          shouldDirty: true,
          shouldValidate: true,
        });
        form.setValue(
          "bankRequisite",
          {
            ...bankDefaults.bankRequisite,
            beneficiaryName:
              bankDefaults.bankRequisite.beneficiaryName ||
              extractedData.orgName ||
              form.getValues("orgName"),
          },
          {
            shouldDirty: true,
            shouldValidate: true,
          },
        );
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

  function validateSubAgent() {
    const nextErrors: { commission?: string; name?: string } = {};

    if (!newSubAgentName.trim()) {
      nextErrors.name = "Имя субагента обязательно";
    } else if (newSubAgentName.length > 255) {
      nextErrors.name = "Имя субагента не должно превышать 255 символов";
    }

    const commission = Number.parseFloat(newSubAgentCommission);
    if (!newSubAgentCommission.trim()) {
      nextErrors.commission = "Комиссия обязательна";
    } else if (Number.isNaN(commission)) {
      nextErrors.commission = "Комиссия должна быть числом";
    } else if (commission < 0) {
      nextErrors.commission = "Комиссия не может быть отрицательной";
    } else if (commission > 100) {
      nextErrors.commission = "Комиссия не может превышать 100%";
    }

    setSubAgentErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleCreateSubAgent() {
    if (!validateSubAgent()) {
      return;
    }

    setCreatingSubAgent(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/sub-agent-profiles`, {
        body: JSON.stringify({
          commissionRate: Number.parseFloat(newSubAgentCommission),
          fullName: newSubAgentName.trim(),
          isActive: true,
          kind: newSubAgentKind,
          shortName: newSubAgentName.trim(),
        }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          getResponseErrorMessage(errorData, "Ошибка создания субагента"),
        );
      }

      const newSubAgent = mapSubAgentProfileToOption(
        (await response.json()) as SubAgentProfileResponse,
      );
      setSubAgents((current) => [...current, newSubAgent]);
      form.setValue("selectedSubAgentId", newSubAgent.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      resetInlineSubAgentDraft();
    } catch (createError) {
      console.error("Error creating sub-agent:", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Ошибка создания субагента",
      );
    } finally {
      setCreatingSubAgent(false);
    }
  }

  async function onSubmit(data: CustomerCreateFormData) {
    setLoading(true);
    setError(null);

    try {
      const customerResponse = await apiClient.v1.customers.$post({
        json: buildCustomerCreatePayload(data),
      });

      if (!customerResponse.ok) {
        const errorData = await customerResponse.json().catch(() => ({}));
        throw new Error(
          getResponseErrorMessage(
            errorData,
            `Ошибка создания клиента: ${customerResponse.status}`,
          ),
        );
      }

      const customer = await readJsonWithSchema(
        customerResponse,
        CreatedCustomerSchema,
      );

      const counterpartyResponse = await apiClient.v1.counterparties.$post({
        json: buildCustomerCounterpartyCreatePayload({
          customerId: customer.id,
          values: data,
        }),
      });

      if (!counterpartyResponse.ok) {
        const errorData = await counterpartyResponse.json().catch(() => ({}));
        throw new Error(
          getResponseErrorMessage(
            errorData,
            `Ошибка создания субъекта: ${counterpartyResponse.status}`,
          ),
        );
      }

      const counterparty = await readJsonWithSchema(
        counterpartyResponse,
        CreatedCounterpartySchema,
      );

      const assignmentPayload = buildCounterpartyAssignmentPayload(data);
      if (assignmentPayload.subAgentCounterpartyId) {
        const assignmentResponse =
          await apiClient.v1.counterparties[":id"].assignment.$patch({
            param: { id: counterparty.id },
            json: assignmentPayload,
          });

        if (!assignmentResponse.ok) {
          const errorData = await assignmentResponse.json().catch(() => ({}));
          throw new Error(
            getResponseErrorMessage(
              errorData,
              `Ошибка назначения субагента: ${assignmentResponse.status}`,
            ),
          );
        }
      }

      const manualProviderPayload = buildManualBankProviderCreatePayload(data);
      let providerId = data.bankProviderId || null;
      let providerBranchId: string | null = null;
      let providerCountry = data.bankProvider.country?.trim().toUpperCase() || null;

      if (manualProviderPayload) {
        const providerResponse = await apiClient.v1.requisites.providers.$post({
          json: manualProviderPayload,
        });

        if (!providerResponse.ok) {
          const errorData = await providerResponse.json().catch(() => ({}));
          throw new Error(
            getResponseErrorMessage(
              errorData,
              `Ошибка создания банка: ${providerResponse.status}`,
            ),
          );
        }

        const provider = await readJsonWithSchema(
          providerResponse,
          RequisiteProviderDetailSchema,
        );
        providerId = provider.id;
        providerCountry = provider.country;
        providerBranchId =
          provider.branches.find((branch) => branch.isPrimary)?.id ?? null;
      } else if (providerId) {
        const providerResponse =
          await apiClient.v1.requisites.providers[":id"].$get({
            param: { id: providerId },
          });

        if (!providerResponse.ok) {
          const errorData = await providerResponse.json().catch(() => ({}));
          throw new Error(
            getResponseErrorMessage(
              errorData,
              `Ошибка загрузки банка: ${providerResponse.status}`,
            ),
          );
        }

        const provider = await readJsonWithSchema(
          providerResponse,
          RequisiteProviderDetailSchema,
        );
        providerCountry = provider.country;
        providerBranchId =
          provider.branches.find((branch) => branch.isPrimary)?.id ?? null;
      }

      if (providerId) {
        const currenciesResponse = await apiClient.v1.currencies.options.$get({});
        if (!currenciesResponse.ok) {
          const errorData = await currenciesResponse.json().catch(() => ({}));
          throw new Error(
            getResponseErrorMessage(
              errorData,
              `Ошибка загрузки валют: ${currenciesResponse.status}`,
            ),
          );
        }

        const currencies = await readJsonWithSchema(
          currenciesResponse,
          CurrencyOptionsResponseSchema,
        );
        const defaultCurrencyCode =
          providerCountry === "RU"
            ? "RUB"
            : resolveDefaultRequisiteCurrencyCode(data);
        const currency = currencies.data.find(
          (item) => item.code === defaultCurrencyCode,
        );

        if (!currency) {
          throw new Error(`Валюта ${defaultCurrencyCode} не найдена`);
        }

        const requisitePayload = buildCounterpartyBankRequisiteCreatePayload({
          counterpartyId: counterparty.id,
          currencyId: currency.id,
          providerBranchId,
          providerId,
          values: data,
        });

        if (requisitePayload) {
          const requisiteResponse =
            await apiClient.v1.counterparties[":id"].requisites.$post({
              param: { id: counterparty.id },
              json: requisitePayload,
            });

          if (!requisiteResponse.ok) {
            const errorData = await requisiteResponse.json().catch(() => ({}));
            throw new Error(
              getResponseErrorMessage(
                errorData,
                `Ошибка создания реквизитов: ${requisiteResponse.status}`,
              ),
            );
          }
        }
      }

      router.push(`/customers/${customer.id}?entity=${counterparty.id}`);
    } catch (submitError) {
      console.error("Create customer error:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Ошибка создания клиента",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <CustomerCreateHeader
        onBack={attemptLeave}
        onCancel={attemptLeave}
        saving={loading}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Не удалось обработать действие</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Быстрое заполнение</h2>
          <p className="text-sm text-muted-foreground">
            Используйте справочники и автоматизацию, чтобы не вводить данные
            вручную.
          </p>
        </div>
        {counterpartyKind === "legal_entity" ? (
          <div className="grid gap-4 lg:grid-cols-3">
          <Card className="h-full">
            <CardHeader className="border-b">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" />
                  Заполнить по ИНН
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Подтянет карточку юрлица из справочника по ИНН.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
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
              />
              <Button
                type="button"
                onClick={() => void handleInnSearch()}
                disabled={searchingByInn || !innSearchValue.trim()}
                className="w-full"
              >
                {searchingByInn ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Подтянуть данные
              </Button>
              {innSearchSuccess ? (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Данные субъекта обновлены
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="border-b">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Импорт из PDF
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Извлечёт реквизиты и контакты из PDF-карточки.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="application/pdf"
                className="hidden"
                disabled={parsingFile}
              />
              <Button
                className="w-full"
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsingFile}
              >
                {parsingFile ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Загрузить PDF
              </Button>
              {uploadedFileName ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="truncate">{uploadedFileName}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="border-b">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Languages className="h-4 w-4 text-primary" />
                  Английская версия
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Заполнит англоязычные поля по русским данным субъекта.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                type="button"
                variant="outline"
                onClick={() => void handleTranslateToEnglish()}
                disabled={translating}
              >
                {translating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Languages className="size-4" />
                )}
                Заполнить английскую версию
              </Button>
            </CardContent>
          </Card>
          </div>
        ) : (
          <Card>
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Languages className="h-4 w-4 text-primary" />
                Английская версия
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Заполнит англоязычные поля по данным физлица.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              type="button"
              variant="outline"
              onClick={() => void handleTranslateToEnglish()}
              disabled={translating}
            >
              {translating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Languages className="size-4" />
              )}
              Заполнить английскую версию
            </Button>
          </CardContent>
          </Card>
        )}
      </section>

      <form
        id="customer-create-form"
        className="space-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <Card>
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle>Карточка клиента</CardTitle>
              <p className="text-sm text-muted-foreground">
                Внутренние CRM-данные: как клиент будет отображаться у команды.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <Field
              form={form}
              label="Название клиента"
              name="name"
              placeholder="ООО «Компания»"
              required
            />
            <Field
              form={form}
              label="Внешний ID"
              name="externalRef"
              placeholder="Например: crm-0001"
            />
            <div className="lg:col-span-2">
              <TextareaField
                form={form}
                label="Описание"
                name="description"
                placeholder="Описание клиента"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle>Первый субъект сделки</CardTitle>
              <p className="text-sm text-muted-foreground">
                Заполните данные компании или физлица, от имени которого будут
                оформляться сделки.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 md:max-w-sm">
              <Label htmlFor="counterparty-kind">Тип субъекта</Label>
              <Select
                value={counterpartyKind}
                onValueChange={(value) =>
                  form.setValue(
                    "counterpartyKind",
                    value as PathValue<CustomerCreateFormData, "counterpartyKind">,
                    {
                      shouldDirty: true,
                      shouldValidate: true,
                    },
                  )
                }
              >
                <SelectTrigger id="counterparty-kind">
                  <SelectValue>
                    {
                      SUBJECT_KIND_OPTIONS.find(
                        (option) => option.value === counterpartyKind,
                      )?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_KIND_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {counterpartyKind === "legal_entity" ? (
              <>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">
                      Идентификация компании
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Базовые данные, по которым субъект будет виден в CRM и
                      документах.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      form={form}
                      label="Название организации"
                      name="orgName"
                      placeholder="ООО «Компания»"
                      required
                    />
                    <Field
                      form={form}
                      label="Тип организации"
                      name="orgType"
                      placeholder="ООО, ИП, АО..."
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">
                      Регистрационные данные
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Идентификаторы компании из государственных и внутренних
                      справочников.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field
                      form={form}
                      label="ИНН"
                      name="inn"
                      placeholder="1234567890"
                      required
                    />
                    <Field
                      form={form}
                      label="КПП"
                      name="kpp"
                      placeholder="123456789"
                    />
                    <Field
                      form={form}
                      label="ОГРН"
                      name="ogrn"
                      placeholder="1234567890123"
                    />
                    <Field
                      form={form}
                      label="ОКПО"
                      name="okpo"
                      placeholder="12345678"
                    />
                    <Field
                      form={form}
                      label="ОКТМО"
                      name="oktmo"
                      placeholder="12345678901"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Подписант</h3>
                    <p className="text-sm text-muted-foreground">
                      Человек, который действует от имени компании.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      form={form}
                      label="Директор"
                      name="directorName"
                      placeholder="Иванов Иван Иванович"
                      required
                    />
                    <Field
                      form={form}
                      label="Должность"
                      name="position"
                      placeholder="Генеральный директор"
                      required
                    />
                    <Field
                      form={form}
                      label="Основание полномочий"
                      name="directorBasis"
                      placeholder="Устав"
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">
                    Идентификация физлица
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Основные данные субъекта, который будет участвовать в
                    сделках.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    form={form}
                    label="ФИО"
                    name="personFullName"
                    placeholder="Иванов Иван Иванович"
                    required
                  />
                  <Field
                    form={form}
                    label="ИНН"
                    name="inn"
                    placeholder="123456789012"
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Контакты и адрес</h3>
                <p className="text-sm text-muted-foreground">
                  Данные для связи и юридического оформления документов.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  form={form}
                  label="Email"
                  name="email"
                  placeholder="info@company.ru"
                  type="email"
                />
                <Field
                  form={form}
                  label="Телефон"
                  name="phone"
                  placeholder="+7 (999) 123-45-67"
                />
                <Field
                  form={form}
                  label="Адрес"
                  name="address"
                  placeholder="г. Москва, ул. Примерная, д. 1"
                />
              </div>
            </div>

            <Accordion defaultValue={[]} multiple>
              {counterpartyKind === "legal_entity" ? (
                <>
                  <AccordionItem value="organization-english">
                    <AccordionTrigger className="rounded-md px-0 hover:no-underline">
                      Английская версия названия и формы
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-4 pt-3 md:grid-cols-2">
                        <Field
                          form={form}
                          label="Название организации (EN)"
                          name="orgNameI18n.en"
                          placeholder="Company name in English"
                        />
                        <Field
                          form={form}
                          label="Тип организации (EN)"
                          name="orgTypeI18n.en"
                          placeholder="LLC, Ltd..."
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="contacts-english">
                    <AccordionTrigger className="rounded-md px-0 hover:no-underline">
                      Английская версия адреса и подписанта
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-4 pt-3 md:grid-cols-2">
                        <Field
                          form={form}
                          label="ФИО директора (EN)"
                          name="directorNameI18n.en"
                          placeholder="Director full name in English"
                        />
                        <Field
                          form={form}
                          label="Должность (EN)"
                          name="positionI18n.en"
                          placeholder="Director position in English"
                        />
                        <Field
                          form={form}
                          label="Основание полномочий (EN)"
                          name="directorBasisI18n.en"
                          placeholder="Authority basis in English"
                        />
                        <Field
                          form={form}
                          label="Адрес (EN)"
                          name="addressI18n.en"
                          placeholder="Legal address in English"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </>
              ) : (
                <AccordionItem value="individual-english">
                  <AccordionTrigger className="rounded-md px-0 hover:no-underline">
                    Английская версия данных физлица
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-4 pt-3 md:grid-cols-2">
                      <Field
                        form={form}
                        label="ФИО (EN)"
                        name="personFullNameI18n.en"
                        placeholder="Full name in English"
                      />
                      <Field
                        form={form}
                        label="Адрес (EN)"
                        name="addressI18n.en"
                        placeholder="Address in English"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </CardContent>
        </Card>

        <div>
          <CustomerBankingSection
            form={form as unknown as UseFormReturn<CustomerBankingFormData>}
          />
        </div>

        {addSubAgent ? (
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Субагент
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Привяжите существующего партнёра или создайте нового
                    субагента для сопровождения клиента.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    form.setValue("addSubAgent", false, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    form.setValue("selectedSubAgentId", "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    resetInlineSubAgentDraft();
                  }}
                >
                  <X className="size-4" />
                  Убрать субагента
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingSubAgents ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка субагентов...
                </div>
              ) : (
                <>
                  {createNewSubAgent ? (
                    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium">Новый субагент</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={resetInlineSubAgentDraft}
                        >
                          Отмена
                        </Button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="new-sub-agent-name">
                            Имя субагента
                            <span className="text-destructive"> *</span>
                          </Label>
                          <Input
                            id="new-sub-agent-name"
                            value={newSubAgentName}
                            onChange={(event) => {
                              setNewSubAgentName(event.target.value);
                              if (subAgentErrors.name) {
                                setSubAgentErrors((current) => ({
                                  ...current,
                                  name: undefined,
                                }));
                              }
                            }}
                            placeholder="Иванов И.И."
                          />
                          {subAgentErrors.name ? (
                            <p className="text-xs text-destructive">
                              {subAgentErrors.name}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-sub-agent-commission">
                            Комиссия (%)
                            <span className="text-destructive"> *</span>
                          </Label>
                          <Input
                            id="new-sub-agent-commission"
                            inputMode="decimal"
                            value={newSubAgentCommission}
                            onChange={(event) => {
                              setNewSubAgentCommission(event.target.value);
                              if (subAgentErrors.commission) {
                                setSubAgentErrors((current) => ({
                                  ...current,
                                  commission: undefined,
                                }));
                              }
                            }}
                            placeholder="1.5"
                          />
                          {subAgentErrors.commission ? (
                            <p className="text-xs text-destructive">
                              {subAgentErrors.commission}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label>Тип субагента</Label>
                          <Select
                            value={newSubAgentKind}
                            onValueChange={(value) =>
                              setNewSubAgentKind(
                                (value as "individual" | "legal_entity") ??
                                  "individual",
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {
                                  SUB_AGENT_KIND_OPTIONS.find(
                                    (option) => option.value === newSubAgentKind,
                                  )?.label
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {SUB_AGENT_KIND_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={() => void handleCreateSubAgent()}
                        disabled={creatingSubAgent}
                      >
                        {creatingSubAgent ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        Создать субагента
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Выберите субагента</Label>
                        <Select
                          value={form.watch("selectedSubAgentId")}
                          onValueChange={(value) =>
                            form.setValue("selectedSubAgentId", value ?? "", {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите субагента..." />
                          </SelectTrigger>
                          <SelectContent>
                            {subAgents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name} ({agent.commission}%)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateNewSubAgent(true)}
                      >
                        <Plus className="size-4" />
                        Создать нового субагента
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              form.setValue("addSubAgent", true, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          >
            <UserPlus className="size-4" />
            Добавить субагента
          </Button>
        )}
      </form>

      <PendingCreateLeaveDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        onConfirm={() => {
          setLeaveDialogOpen(false);
          router.back();
        }}
      />
    </div>
  );
}
