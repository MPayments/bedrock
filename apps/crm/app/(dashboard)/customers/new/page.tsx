"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronLeft,
  Save,
  Loader2,
  Plus,
  UserPlus,
  Upload,
  FileText,
  Sparkles,
  Search,
  Building2,
  CheckCircle2,
  Languages,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import { Button } from "@bedrock/sdk-ui/components/button";
import { CountrySelect } from "@bedrock/sdk-ui/components/country-select";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { API_BASE_URL } from "@/lib/constants";
import { translateFieldsToEnglish } from "@/lib/translate-fields";
import { clientSchema, type ClientFormData } from "@/lib/validation";

interface SubAgent {
  id: string;
  name: string;
  commission: number;
  kind: "individual" | "legal_entity";
  isActive: boolean;
}

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Поиск по ИНН
  const [innSearchValue, setInnSearchValue] = useState("");
  const [searchingByInn, setSearchingByInn] = useState(false);
  const [innSearchSuccess, setInnSearchSuccess] = useState(false);

  // Загрузка файла для парсинга
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Перевод на английский
  const [translating, setTranslating] = useState(false);

  // Субагенты
  const [addSubAgent, setAddSubAgent] = useState(false);
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [loadingSubAgents, setLoadingSubAgents] = useState(false);
  const [selectedSubAgentId, setSelectedSubAgentId] = useState<string>("");
  const [createNewSubAgent, setCreateNewSubAgent] = useState(false);
  const [newSubAgentName, setNewSubAgentName] = useState("");
  const [newSubAgentCommission, setNewSubAgentCommission] = useState("");
  const [newSubAgentKind, setNewSubAgentKind] = useState<
    "individual" | "legal_entity"
  >("individual");
  const [creatingSubAgent, setCreatingSubAgent] = useState(false);
  const [subAgentErrors, setSubAgentErrors] = useState<{
    name?: string;
    commission?: string;
  }>({});

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      orgName: "",
      orgNameI18n: { ru: "", en: "" },
      orgType: "",
      orgTypeI18n: { ru: "", en: "" },
      inn: "",
      kpp: "",
      ogrn: "",
      oktmo: "",
      okpo: "",
      directorName: "",
      directorNameI18n: { ru: "", en: "" },
      position: "",
      positionI18n: { ru: "", en: "" },
      directorBasis: "",
      directorBasisI18n: { ru: "", en: "" },
      address: "",
      addressI18n: { ru: "", en: "" },
      email: "",
      phone: "",
      bankName: "",
      bankNameI18n: { ru: "", en: "" },
      bankAddress: "",
      bankAddressI18n: { ru: "", en: "" },
      account: "",
      bic: "",
      corrAccount: "",
    },
    mode: "onBlur",
  });

  // Загрузка списка субагентов
  useEffect(() => {
    if (addSubAgent && subAgents.length === 0) {
      loadSubAgents();
    }
  }, [addSubAgent, subAgents.length]);

  const loadSubAgents = async () => {
    setLoadingSubAgents(true);
    try {
      const res = await fetch(`${API_BASE_URL}/agents/sub-agents`, {
        credentials: "include",
      });
      if (res.ok) {
        const raw = await res.json();
        setSubAgents(Array.isArray(raw) ? raw : raw.data ?? []);
      }
    } catch (err) {
      console.error("Error loading sub-agents:", err);
    } finally {
      setLoadingSubAgents(false);
    }
  };

  // Поиск компании по ИНН
  const handleInnSearch = async () => {
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
      const res = await fetch(
        `${API_BASE_URL}/legal-entities/lookup-by-inn?inn=${encodeURIComponent(inn)}`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка поиска: ${res.status}`);
      }

      const companyData = await res.json();

      // Заполняем форму найденными данными
      const fieldsToSet: (keyof ClientFormData)[] = [
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
        if (companyData[field]) {
          form.setValue(field, companyData[field], {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      });

      setInnSearchSuccess(true);
    } catch (err) {
      console.error("INN search error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка поиска компании по ИНН"
      );
    } finally {
      setSearchingByInn(false);
    }
  };

  const handleTranslateToEnglish = async () => {
    setTranslating(true);
    setError(null);

    try {
      const values = form.getValues();
      const ruFields: Record<string, string> = {
        orgName: values.orgName,
        orgType: values.orgType,
        directorName: values.directorName,
        position: values.position,
        directorBasis: values.directorBasis,
        address: values.address || "",
        bankName: values.bankName || "",
        bankAddress: values.bankAddress || "",
      };

      const translated = await translateFieldsToEnglish(ruFields);

      const mapping: Record<string, keyof ClientFormData | `${string}.${string}`> = {
        orgName: "orgNameI18n.en",
        orgType: "orgTypeI18n.en",
        directorName: "directorNameI18n.en",
        position: "positionI18n.en",
        directorBasis: "directorBasisI18n.en",
        address: "addressI18n.en",
        bankName: "bankNameI18n.en",
        bankAddress: "bankAddressI18n.en",
      };

      for (const [key, enField] of Object.entries(mapping)) {
        if (translated[key]) {
          form.setValue(enField as Path<ClientFormData>, translated[key], {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      }
    } catch (err) {
      console.error("Translation error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка перевода полей"
      );
    } finally {
      setTranslating(false);
    }
  };

  const validateSubAgent = (): boolean => {
    const errors: { name?: string; commission?: string } = {};

    if (!newSubAgentName.trim()) {
      errors.name = "Имя субагента обязательно";
    } else if (newSubAgentName.length > 255) {
      errors.name = "Имя субагента не должно превышать 255 символов";
    }

    const commission = parseFloat(newSubAgentCommission);
    if (!newSubAgentCommission.trim()) {
      errors.commission = "Комиссия обязательна";
    } else if (isNaN(commission)) {
      errors.commission = "Комиссия должна быть числом";
    } else if (commission < 0) {
      errors.commission = "Комиссия не может быть отрицательной";
    } else if (commission > 100) {
      errors.commission = "Комиссия не может превышать 100%";
    }

    setSubAgentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

      const res = await fetch(`${API_BASE_URL}/legal-entities/parse-card`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Ошибка распознавания: ${res.status}`
        );
      }

      const extractedData = await res.json();

      // Заполняем форму извлечёнными данными
      const fieldsToSet: (keyof ClientFormData)[] = [
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
        "bic",
        "corrAccount",
      ];

      fieldsToSet.forEach((field) => {
        if (extractedData[field]) {
          form.setValue(field, extractedData[field], {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      });
    } catch (err) {
      console.error("Parse error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка распознавания файла"
      );
      setUploadedFileName(null);
    } finally {
      setParsingFile(false);
      // Сбрасываем input, чтобы можно было загрузить тот же файл снова
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCreateSubAgent = async () => {
    if (!validateSubAgent()) {
      return;
    }

    setCreatingSubAgent(true);
    try {
      const res = await fetch(`${API_BASE_URL}/agents/sub-agents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: newSubAgentName.trim(),
          commission: parseFloat(newSubAgentCommission),
          kind: newSubAgentKind,
        }),
      });

      if (res.ok) {
        const newSubAgent = await res.json();
        setSubAgents((prev) => [...prev, newSubAgent]);
        setSelectedSubAgentId(newSubAgent.id);
        setCreateNewSubAgent(false);
        setNewSubAgentName("");
        setNewSubAgentCommission("");
        setNewSubAgentKind("individual");
        setSubAgentErrors({});
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Ошибка создания субагента");
      }
    } catch (err) {
      console.error("Error creating sub-agent:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка создания субагента"
      );
    } finally {
      setCreatingSubAgent(false);
    }
  };

  const onSubmit = async (data: ClientFormData) => {
    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        ...data,
        orgNameI18n: {
          ru: data.orgName || undefined,
          en: data.orgNameI18n?.en || undefined,
        },
        orgTypeI18n: {
          ru: data.orgType || undefined,
          en: data.orgTypeI18n?.en || undefined,
        },
        directorNameI18n: {
          ru: data.directorName || undefined,
          en: data.directorNameI18n?.en || undefined,
        },
        positionI18n: {
          ru: data.position || undefined,
          en: data.positionI18n?.en || undefined,
        },
        directorBasisI18n: {
          ru: data.directorBasis || undefined,
          en: data.directorBasisI18n?.en || undefined,
        },
        addressI18n: {
          ru: data.address || undefined,
          en: data.addressI18n?.en || undefined,
        },
        bankNameI18n: {
          ru: data.bankName || undefined,
          en: data.bankNameI18n?.en || undefined,
        },
        bankAddressI18n: {
          ru: data.bankAddress || undefined,
          en: data.bankAddressI18n?.en || undefined,
        },
      };

      // Добавляем субагента если выбран
      if (addSubAgent && selectedSubAgentId) {
        payload.subAgentCounterpartyId = selectedSubAgentId;
      }

      const res = await fetch(`${API_BASE_URL}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка создания: ${res.status}`);
      }

      const customer = await res.json();
      router.push(`/customers/${customer.id}`);
    } catch (err) {
      console.error("Create client error:", err);
      setError(err instanceof Error ? err.message : "Ошибка создания клиента");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
          <h1 className="text-2xl font-bold">Новый клиент</h1>
        </div>
      </div>

      {/* Поиск по ИНН */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Автозаполнение по ИНН
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1 max-w-xs">
              <Input
                placeholder="Введите ИНН (10 или 12 цифр)"
                value={innSearchValue}
                onChange={(e) => {
                  setInnSearchValue(e.target.value.replace(/\D/g, ""));
                  setInnSearchSuccess(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleInnSearch();
                  }
                }}
                disabled={searchingByInn}
                maxLength={12}
              />
            </div>
            <Button
              type="button"
              onClick={handleInnSearch}
              disabled={searchingByInn || !innSearchValue.trim()}
            >
              {searchingByInn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Поиск...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Найти компанию
                </>
              )}
            </Button>

            {innSearchSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Данные загружены</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Введите ИНН организации для автоматического заполнения данных из
            ЕГРЮЛ/ЕГРИП
          </p>
        </CardContent>
      </Card>

      {/* Загрузка карточки клиента */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Автозаполнение из PDF
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="application/pdf"
              className="hidden"
              disabled={parsingFile}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingFile}
              className="w-full sm:w-auto"
            >
              {parsingFile ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Распознавание...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Загрузить карточку клиента
                </>
              )}
            </Button>

            {uploadedFileName && !parsingFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{uploadedFileName}</span>
              </div>
            )}

            {parsingFile && (
              <div className="text-sm text-muted-foreground">
                Анализируем документ с помощью AI...
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Загрузите PDF с реквизитами организации для автоматического
            заполнения полей
          </p>
        </CardContent>
      </Card>

      {/* Перевод на английский */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            Перевод на английский
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleTranslateToEnglish}
              disabled={translating}
              className="w-full sm:w-auto"
            >
              {translating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Перевод...
                </>
              ) : (
                <>
                  <Languages className="mr-2 h-4 w-4" />
                  Заполнить английские поля
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Автоматически переведёт заполненные русские поля на английский
            с помощью AI
          </p>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
        {error && (
            <div className="my-4 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Основные данные организации */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Данные организации</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="orgName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Название организации{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="ООО «Компания»" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="orgNameI18n.en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название организации (EN)</FormLabel>
                      <FormControl>
                        <Input placeholder="Company name in English" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="orgType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Тип организации{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="ООО, ИП, АО..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="orgTypeI18n.en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип организации (EN)</FormLabel>
                      <FormControl>
                        <Input placeholder="LLC, Ltd..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="inn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          ИНН <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="kpp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>КПП</FormLabel>
                        <FormControl>
                          <Input placeholder="123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ogrn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ОГРН</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="okpo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ОКПО</FormLabel>
                        <FormControl>
                          <Input placeholder="12345678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="oktmo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ОКТМО</FormLabel>
                      <FormControl>
                        <Input placeholder="12345678901" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Директор */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Руководитель</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="directorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        ФИО директора{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Иванов Иван Иванович" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="directorNameI18n.en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ФИО директора (EN)</FormLabel>
                      <FormControl>
                        <Input placeholder="Director full name in English" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Должность <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Должность" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="positionI18n.en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Должность (EN)</FormLabel>
                      <FormControl>
                        <Input placeholder="Director position in English" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="directorBasis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Основание полномочий{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Основание полномочий" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="directorBasisI18n.en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Основание полномочий (EN)</FormLabel>
                      <FormControl>
                        <Input placeholder="Authority basis in English" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <CardTitle className="text-lg">Контакты</CardTitle>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адрес</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="г. Москва, ул. Примерная, д. 1"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="addressI18n.en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адрес (EN)</FormLabel>
                      <FormControl>
                        <Input placeholder="Legal address in English" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="info@company.ru"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Телефон</FormLabel>
                        <FormControl>
                          <Input placeholder="+7 (999) 123-45-67" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Банковские реквизиты */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Банковские реквизиты</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Название банка</FormLabel>
                        <FormControl>
                          <Input placeholder="ПАО Сбербанк" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bankNameI18n.en"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Название банка (EN)</FormLabel>
                        <FormControl>
                          <Input placeholder="Bank name in English" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bankAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Адрес банка</FormLabel>
                        <FormControl>
                          <Input placeholder="г. Москва" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bankAddressI18n.en"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Адрес банка (EN)</FormLabel>
                        <FormControl>
                          <Input placeholder="Bank address in English" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bankCountry"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Страна банка</FormLabel>
                        <FormControl>
                          <CountrySelect
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            invalid={fieldState.invalid}
                            placeholder="Выберите страну"
                            searchPlaceholder="Поиск страны..."
                            emptyLabel="Страна не найдена"
                            clearable
                            clearLabel="Очистить"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="account"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Расчётный счёт</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="40702810123456789012"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>БИК</FormLabel>
                        <FormControl>
                          <Input placeholder="044525225" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="corrAccount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Корр. счёт</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="30101810400000000225"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Субагент */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Субагент
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="addSubAgent"
                    checked={addSubAgent}
                    onCheckedChange={(checked) => {
                      setAddSubAgent(checked === true);
                      if (!checked) {
                        setSelectedSubAgentId("");
                        setCreateNewSubAgent(false);
                      }
                    }}
                  />
                  <Label
                    htmlFor="addSubAgent"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Добавить субагента
                  </Label>
                </div>

                {addSubAgent && (
                  <div className="space-y-4 pt-2">
                    {loadingSubAgents ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Загрузка субагентов...
                      </div>
                    ) : (
                      <>
                        {!createNewSubAgent ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Выберите субагента</Label>
                              <Select
                                value={selectedSubAgentId}
                                onValueChange={(value) =>
                                  setSelectedSubAgentId(value ?? "")
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Выберите субагента..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {subAgents.map((agent) => (
                                    <SelectItem
                                      key={agent.id}
                                      value={agent.id}
                                    >
                                      {agent.name} ({agent.commission}%)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center">
                              <span className="text-sm text-muted-foreground">
                                или
                              </span>
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={() => setCreateNewSubAgent(true)}
                                className="ml-2"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Создать нового субагента
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium">
                                Новый субагент
                              </h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCreateNewSubAgent(false);
                                  setNewSubAgentName("");
                                  setNewSubAgentCommission("");
                                  setNewSubAgentKind("individual");
                                  setSubAgentErrors({});
                                }}
                              >
                                Отмена
                              </Button>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="newSubAgentName">
                                  Имя субагента{" "}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  id="newSubAgentName"
                                  value={newSubAgentName}
                                  onChange={(e) => {
                                    setNewSubAgentName(e.target.value);
                                    if (subAgentErrors.name) {
                                      setSubAgentErrors((prev) => ({
                                        ...prev,
                                        name: undefined,
                                      }));
                                    }
                                  }}
                                  placeholder="Иванов И.И."
                                  className={
                                    subAgentErrors.name
                                      ? "border-destructive"
                                      : ""
                                  }
                                />
                                {subAgentErrors.name && (
                                  <p className="text-sm text-destructive">
                                    {subAgentErrors.name}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="newSubAgentCommission">
                                  Комиссия (%){" "}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  id="newSubAgentCommission"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={newSubAgentCommission}
                                  onChange={(e) => {
                                    setNewSubAgentCommission(e.target.value);
                                    if (subAgentErrors.commission) {
                                      setSubAgentErrors((prev) => ({
                                        ...prev,
                                        commission: undefined,
                                      }));
                                    }
                                  }}
                                  placeholder="1.5"
                                  className={
                                    subAgentErrors.commission
                                      ? "border-destructive"
                                      : ""
                                  }
                                />
                                {subAgentErrors.commission && (
                                  <p className="text-sm text-destructive">
                                    {subAgentErrors.commission}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Тип субагента</Label>
                                <Select
                                  value={newSubAgentKind}
                                  onValueChange={(value) =>
                                    setNewSubAgentKind(
                                      value as "individual" | "legal_entity",
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="individual">
                                      Физическое лицо
                                    </SelectItem>
                                    <SelectItem value="legal_entity">
                                      Юридическое лицо
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <Button
                              type="button"
                              onClick={handleCreateSubAgent}
                              disabled={creatingSubAgent}
                              size="sm"
                            >
                              {creatingSubAgent ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Создание...
                                </>
                              ) : (
                                <>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Создать субагента
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Сохранить
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
