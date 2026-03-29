"use client";

import { useState, useRef } from "react";
import { COUNTRIES as countries } from "@bedrock/shared/reference-data/countries";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CustomerOnboardInput,
  customerOnboardSchema,
} from "@/lib/validation";
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
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/lib/constants";

export function OnboardForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  // Поиск по ИНН
  const [innSearchValue, setInnSearchValue] = useState("");
  const [searchingByInn, setSearchingByInn] = useState(false);
  const [innSearchSuccess, setInnSearchSuccess] = useState(false);

  // Загрузка файла
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Показать дополнительные поля
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [showBankFields, setShowBankFields] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerOnboardInput>({
    resolver: zodResolver(customerOnboardSchema),
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
      bic: "",
      corrAccount: "",
    },
  });

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
    setError("");
    setInnSearchSuccess(false);

    try {
      const res = await fetch(
        `${API_BASE_URL}/clients/lookup-by-inn?inn=${encodeURIComponent(inn)}`,
        { credentials: "include" }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка поиска: ${res.status}`);
      }

      const companyData = await res.json();

      // Заполняем форму найденными данными
      const fieldsToSet: (keyof CustomerOnboardInput)[] = [
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
          setValue(field, companyData[field], {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      });

      setInnSearchSuccess(true);
      setShowExtraFields(true); // Показываем дополнительные поля после заполнения
    } catch (err) {
      console.error("INN search error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка поиска компании по ИНН"
      );
    } finally {
      setSearchingByInn(false);
    }
  };

  // Загрузка и парсинг PDF
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
    setError("");
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/clients/parse-card`, {
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
      const fieldsToSet: (keyof CustomerOnboardInput)[] = [
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
          setValue(field, extractedData[field], {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      });

      // Показываем все секции после заполнения
      setShowExtraFields(true);
      if (
        extractedData.bankName ||
        extractedData.account ||
        extractedData.bic
      ) {
        setShowBankFields(true);
      }
    } catch (err) {
      console.error("Parse error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка распознавания файла"
      );
      setUploadedFileName(null);
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  async function onSubmit(data: CustomerOnboardInput) {
    setError("");

    try {
      const payload: CustomerOnboardInput = {
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

      const url = `${API_BASE_URL}/customer/clients`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create client");
      }

      router.push("/customer/clients");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось сохранить данные. Попробуйте еще раз."
      );
      console.error("Onboard error:", err);
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold">Добро пожаловать!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Заполните информацию о вашей организации
        </p>
      </div>

      {/* Автозаполнение по ИНН */}
      <div className="mb-6 p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Быстрое заполнение по ИНН</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Введите ИНН"
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
            className="h-11"
            inputMode="numeric"
          />
          <Button
            type="button"
            onClick={handleInnSearch}
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
        {innSearchSuccess && (
          <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Данные загружены из ЕГРЮЛ</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">или</span>
        </div>
      </div>

      {/* Загрузка PDF */}
      <div className="mb-6 p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Загрузите карту партнера (PDF)</span>
        </div>
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
          className="w-full h-11"
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
        {uploadedFileName && !parsingFile && (
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="truncate">{uploadedFileName}</span>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* ФИО контактного лица */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm">
            Ваше ФИО <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="Иванов Иван Иванович"
            className="h-11"
            autoComplete="name"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Название организации */}
        <div className="space-y-1.5">
          <Label htmlFor="orgName" className="text-sm">
            Название организации <span className="text-destructive">*</span>
          </Label>
          <Input
            id="orgName"
            {...register("orgName")}
            placeholder="ООО «Компания»"
            className="h-11"
          />
          {errors.orgName && (
            <p className="text-xs text-destructive">{errors.orgName.message}</p>
          )}
        </div>

        {/* ИНН */}
        <div className="space-y-1.5">
          <Label htmlFor="inn" className="text-sm">
            ИНН <span className="text-destructive">*</span>
          </Label>
          <Input
            id="inn"
            {...register("inn")}
            placeholder="1234567890"
            className="h-11"
            inputMode="numeric"
            maxLength={12}
          />
          {errors.inn && (
            <p className="text-xs text-destructive">{errors.inn.message}</p>
          )}
        </div>

        {/* ФИО директора */}
        <div className="space-y-1.5">
          <Label htmlFor="directorName" className="text-sm">
            ФИО директора <span className="text-destructive">*</span>
          </Label>
          <Input
            id="directorName"
            {...register("directorName")}
            placeholder="Петров Петр Петрович"
            className="h-11"
          />
          {errors.directorName && (
            <p className="text-xs text-destructive">
              {errors.directorName.message}
            </p>
          )}
        </div>

        {/* Телефон */}
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm">
            Телефон
          </Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            {...register("phone")}
            placeholder="+7 999 123-45-67"
            className="h-11"
            autoComplete="tel"
          />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>

        {/* Дополнительные поля организации */}
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowExtraFields(!showExtraFields)}
            className="w-full justify-between h-10 px-0"
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

          {showExtraFields && (
            <div className="space-y-4 pt-2">
              {/* Тип организации */}
              <div className="space-y-1.5">
                <Label htmlFor="orgType" className="text-sm text-muted-foreground">
                  Тип организации
                </Label>
                <Input
                  id="orgType"
                  {...register("orgType")}
                  placeholder="ООО, ИП, АО..."
                  className="h-11"
                />
              </div>

              {/* Должность */}
              <div className="space-y-1.5">
                <Label htmlFor="position" className="text-sm text-muted-foreground">
                  Должность директора
                </Label>
                <Input
                  id="position"
                  {...register("position")}
                  placeholder="Генеральный директор"
                  className="h-11"
                />
              </div>

              {/* Основание полномочий */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="directorBasis"
                  className="text-sm text-muted-foreground"
                >
                  Основание полномочий
                </Label>
                <Input
                  id="directorBasis"
                  {...register("directorBasis")}
                  placeholder="Устав"
                  className="h-11"
                />
              </div>

              {/* Адрес */}
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-sm text-muted-foreground">
                  Юридический адрес
                </Label>
                <Input
                  id="address"
                  {...register("address")}
                  placeholder="г. Москва, ул. Примерная, д. 1"
                  className="h-11"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm text-muted-foreground">
                  Email организации
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="info@company.ru"
                  className="h-11"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Реквизиты */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="kpp" className="text-sm text-muted-foreground">
                    КПП
                  </Label>
                  <Input
                    id="kpp"
                    {...register("kpp")}
                    placeholder="123456789"
                    className="h-11"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ogrn" className="text-sm text-muted-foreground">
                    ОГРН
                  </Label>
                  <Input
                    id="ogrn"
                    {...register("ogrn")}
                    placeholder="1234567890123"
                    className="h-11"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="oktmo" className="text-sm text-muted-foreground">
                    ОКТМО
                  </Label>
                  <Input
                    id="oktmo"
                    {...register("oktmo")}
                    placeholder="12345678"
                    className="h-11"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="okpo" className="text-sm text-muted-foreground">
                    ОКПО
                  </Label>
                  <Input
                    id="okpo"
                    {...register("okpo")}
                    placeholder="12345678"
                    className="h-11"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Банковские реквизиты */}
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowBankFields(!showBankFields)}
            className="w-full justify-between h-10 px-0"
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

          {showBankFields && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="bankName" className="text-sm text-muted-foreground">
                  Название банка
                </Label>
                <Input
                  id="bankName"
                  {...register("bankName")}
                  placeholder="ПАО Сбербанк"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="account" className="text-sm text-muted-foreground">
                  Расчётный счёт
                </Label>
                <Input
                  id="account"
                  {...register("account")}
                  placeholder="40702810123456789012"
                  className="h-11"
                  inputMode="numeric"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bic" className="text-sm text-muted-foreground">
                    БИК
                  </Label>
                  <Input
                    id="bic"
                    {...register("bic")}
                    placeholder="044525225"
                    className="h-11"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="corrAccount"
                    className="text-sm text-muted-foreground"
                  >
                    Корр. счёт
                  </Label>
                  <Input
                    id="corrAccount"
                    {...register("corrAccount")}
                    placeholder="30101810400000000225"
                    className="h-11"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="bankCountry"
                  className="text-sm text-muted-foreground"
                >
                  Страна банка
                </Label>
                <select
                  id="bankCountry"
                  {...register("bankCountry")}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Выберите страну</option>
                  {countries.map((c) => (
                    <option key={c.alpha2} value={c.alpha2}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="bankAddress"
                  className="text-sm text-muted-foreground"
                >
                  Адрес банка
                </Label>
                <Input
                  id="bankAddress"
                  {...register("bankAddress")}
                  placeholder="г. Москва"
                  className="h-11"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          className="w-full h-12 text-base font-medium mt-4"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Продолжить"
          )}
        </Button>
      </form>
    </div>
  );
}
