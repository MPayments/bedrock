"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  Building2,
  CreditCard,
  FileSignature,
  Stamp,
  Signature,
  Languages,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ImageCropper,
  IMAGE_DIMENSIONS,
  type ImageType,
} from "@/components/ui/image-cropper";
import { API_BASE_URL } from "@/lib/constants";
import { translateFieldsToEnglish } from "@/lib/translate-fields";
import {
  createOrganizationWithBanksSchema,
  type CreateOrganizationWithBanksInput,
} from "@/lib/validation";

export default function NewOrganizationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  // Файлы
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const [sealBlob, setSealBlob] = useState<Blob | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [sealPreview, setSealPreview] = useState<string | null>(null);

  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string>("");
  const [cropperImageType, setCropperImageType] = useState<ImageType>("signature");

  const form = useForm<CreateOrganizationWithBanksInput>({
    resolver: zodResolver(createOrganizationWithBanksSchema),
    defaultValues: {
      name: "",
      nameI18n: { ru: "", en: "" },
      orgType: "",
      orgTypeI18n: { ru: "", en: "" },
      country: "",
      countryI18n: { ru: "", en: "" },
      city: "",
      cityI18n: { ru: "", en: "" },
      address: "",
      addressI18n: { ru: "", en: "" },
      inn: "",
      taxId: "",
      kpp: "",
      ogrn: "",
      oktmo: "",
      okpo: "",
      directorName: "",
      directorNameI18n: { ru: "", en: "" },
      directorPosition: "Генеральный директор",
      directorPositionI18n: { ru: "", en: "" },
      directorBasis: "Устав",
      directorBasisI18n: { ru: "", en: "" },
      banks: [
        {
          name: "",
          nameI18n: { ru: "", en: "" },
          bankName: "",
          bankNameI18n: { ru: "", en: "" },
          bankAddress: "",
          bankAddressI18n: { ru: "", en: "" },
          account: "",
          bic: "",
          corrAccount: "",
          swiftCode: "",
          currencyCode: "RUB",
        },
      ],
    },
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "banks",
  });

  // Обработка загрузки подписи - открывает cropper
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Подпись должна быть изображением (PNG, JPG)");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperImageSrc(reader.result as string);
      setCropperImageType("signature");
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    setError(null);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  // Обработка загрузки печати - открывает cropper
  const handleSealUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Печать должна быть изображением (PNG, JPG)");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperImageSrc(reader.result as string);
      setCropperImageType("seal");
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    setError(null);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  // Обработка завершения обрезки
  const handleCropComplete = (croppedBlob: Blob, previewUrl: string) => {
    if (cropperImageType === "signature") {
      // Revoke old URL before setting new one
      if (signaturePreview) {
        URL.revokeObjectURL(signaturePreview);
      }
      setSignatureBlob(croppedBlob);
      setSignaturePreview(previewUrl);
    } else {
      // Revoke old URL before setting new one
      if (sealPreview) {
        URL.revokeObjectURL(sealPreview);
      }
      setSealBlob(croppedBlob);
      setSealPreview(previewUrl);
    }
  };

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    const sigPreview = signaturePreview;
    const slPreview = sealPreview;
    
    return () => {
      if (sigPreview) {
        URL.revokeObjectURL(sigPreview);
      }
      if (slPreview) {
        URL.revokeObjectURL(slPreview);
      }
    };
  }, [signaturePreview, sealPreview]);

  const handleTranslateToEnglish = async () => {
    setTranslating(true);
    setError(null);

    try {
      const values = form.getValues();
      const ruFields: Record<string, string> = {
        name: values.name,
        orgType: values.orgType,
        country: values.country,
        city: values.city,
        address: values.address,
        directorName: values.directorName,
        directorPosition: values.directorPosition,
        directorBasis: values.directorBasis,
      };

      values.banks.forEach((bank, i) => {
        if (bank.name) ruFields[`bank_${i}_name`] = bank.name;
        if (bank.bankName) ruFields[`bank_${i}_bankName`] = bank.bankName;
        if (bank.bankAddress) ruFields[`bank_${i}_bankAddress`] = bank.bankAddress;
      });

      const translated = await translateFieldsToEnglish(ruFields);

      const orgMapping: Record<string, string> = {
        name: "nameI18n.en",
        orgType: "orgTypeI18n.en",
        country: "countryI18n.en",
        city: "cityI18n.en",
        address: "addressI18n.en",
        directorName: "directorNameI18n.en",
        directorPosition: "directorPositionI18n.en",
        directorBasis: "directorBasisI18n.en",
      };

      for (const [key, enField] of Object.entries(orgMapping)) {
        if (translated[key]) {
          form.setValue(enField as any, translated[key], {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      }

      values.banks.forEach((_, i) => {
        const bankFields: Record<string, string> = {
          [`bank_${i}_name`]: `banks.${i}.nameI18n.en`,
          [`bank_${i}_bankName`]: `banks.${i}.bankNameI18n.en`,
          [`bank_${i}_bankAddress`]: `banks.${i}.bankAddressI18n.en`,
        };
        for (const [key, enField] of Object.entries(bankFields)) {
          if (translated[key]) {
            form.setValue(enField as any, translated[key], {
              shouldValidate: true,
              shouldDirty: true,
            });
          }
        }
      });
    } catch (err) {
      console.error("Translation error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка перевода полей"
      );
    } finally {
      setTranslating(false);
    }
  };

  const onSubmit = async (data: CreateOrganizationWithBanksInput) => {
    // Проверяем наличие файлов
    if (!signatureBlob || !sealBlob) {
      setError("Необходимо загрузить печать и подпись");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const normalizedData: CreateOrganizationWithBanksInput = {
        ...data,
        nameI18n: {
          ru: data.name || undefined,
          en: data.nameI18n?.en || undefined,
        },
        orgTypeI18n: {
          ru: data.orgType || undefined,
          en: data.orgTypeI18n?.en || undefined,
        },
        countryI18n: {
          ru: data.country || undefined,
          en: data.countryI18n?.en || undefined,
        },
        cityI18n: {
          ru: data.city || undefined,
          en: data.cityI18n?.en || undefined,
        },
        addressI18n: {
          ru: data.address || undefined,
          en: data.addressI18n?.en || undefined,
        },
        directorNameI18n: {
          ru: data.directorName || undefined,
          en: data.directorNameI18n?.en || undefined,
        },
        directorPositionI18n: {
          ru: data.directorPosition || undefined,
          en: data.directorPositionI18n?.en || undefined,
        },
        directorBasisI18n: {
          ru: data.directorBasis || undefined,
          en: data.directorBasisI18n?.en || undefined,
        },
        banks: data.banks.map((bank) => ({
          ...bank,
          nameI18n: {
            ru: bank.name || undefined,
            en: bank.nameI18n?.en || undefined,
          },
          bankNameI18n: {
            ru: bank.bankName || undefined,
            en: bank.bankNameI18n?.en || undefined,
          },
          bankAddressI18n: {
            ru: bank.bankAddress || undefined,
            en: bank.bankAddressI18n?.en || undefined,
          },
        })),
      };

      const { banks, ...organizationData } = normalizedData;

      // 1. Создаём организацию (JSON)
      const res = await fetch(`${API_BASE_URL}/organizations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(organizationData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка создания: ${res.status}`);
      }

      const organization = await res.json();
      const orgId = organization.id;

      // 2. Создаём банковские реквизиты
      for (const bank of banks) {
        await fetch(`${API_BASE_URL}/organizations/${orgId}/banks`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bank),
        });
      }

      // 3. Загружаем файлы (multipart)
      const fileData = new FormData();
      fileData.append("signature", signatureBlob, "signature.png");
      fileData.append("seal", sealBlob, "seal.png");

      await fetch(`${API_BASE_URL}/organizations/${orgId}/files`, {
        method: "POST",
        credentials: "include",
        body: fileData,
      });

      router.push(`/admin/organizations`);
    } catch (err) {
      console.error("Create organization error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка создания организации"
      );
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
          <h1 className="text-2xl font-bold">Новое юрлицо</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleTranslateToEnglish}
          disabled={translating}
        >
          {translating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Перевод...
            </>
          ) : (
            <>
              <Languages className="mr-2 h-4 w-4" />
              Заполнить EN поля
            </>
          )}
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Данные организации */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Данные организации
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Название организации{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="МТК ТРЕЙДИНГ КОМПАНИ..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nameI18n.en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название организации (EN)</FormLabel>
                      <FormControl>
                        <Input placeholder="Organization name in English" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="orgType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Тип <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="ООО, ОсОО..." {...field} />
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
                        <FormLabel>Тип (EN)</FormLabel>
                        <FormControl>
                          <Input placeholder="LLC, Ltd..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Страна <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Турецкая Республика" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="countryI18n.en"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Страна (EN)</FormLabel>
                        <FormControl>
                          <Input placeholder="Country in English" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Город <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Стамбул" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cityI18n.en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Город (EN)</FormLabel>
                      <FormControl>
                        <Input placeholder="City in English" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Адрес <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Полный юридический адрес..."
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

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="inn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ИНН</FormLabel>
                        <FormControl>
                          <Input placeholder="9909685510" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID</FormLabel>
                        <FormControl>
                          <Input placeholder="0623215774600001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="kpp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>КПП</FormLabel>
                        <FormControl>
                          <Input placeholder="165887001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ogrn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ОГРН</FormLabel>
                        <FormControl>
                          <Input placeholder="0000000000000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="oktmo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ОКТМО</FormLabel>
                        <FormControl>
                          <Input placeholder="111111111111" {...field} />
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
                          <Input placeholder="2222222222" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Руководитель */}
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
                        <Input
                          placeholder="Иванов Иван Иванович"
                          {...field}
                        />
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
                  name="directorPosition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Должность <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Генеральный директор" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="directorPositionI18n.en"
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
                        <Input placeholder="Устав" {...field} />
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
                        <Input placeholder="Basis in English" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator className="my-6" />

                {/* Загрузка печати и подписи */}
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-primary" />
                  Печать и подпись <span className="text-destructive">*</span>
                </CardTitle>

                <div className="grid grid-cols-2 gap-4">
                  {/* Подпись */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Подпись{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        ({IMAGE_DIMENSIONS.signature.width}×{IMAGE_DIMENSIONS.signature.height}px)
                      </span>
                    </label>
                    <input
                      type="file"
                      ref={signatureInputRef}
                      onChange={handleSignatureUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <div
                      onClick={() => signatureInputRef.current?.click()}
                      className="border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors flex flex-col items-center justify-center min-h-[120px]"
                    >
                      {signaturePreview ? (
                        <img
                          src={signaturePreview}
                          alt="Подпись"
                          className="max-h-[100px] object-contain"
                        />
                      ) : (
                        <>
                          <Signature className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">
                            Загрузить подпись
                          </span>
                        </>
                      )}
                    </div>
                    {signatureBlob && (
                      <p className="text-xs text-muted-foreground">
                        Обрезано: {IMAGE_DIMENSIONS.signature.width}×{IMAGE_DIMENSIONS.signature.height}px
                      </p>
                    )}
                  </div>

                  {/* Печать */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Печать{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        ({IMAGE_DIMENSIONS.seal.width}×{IMAGE_DIMENSIONS.seal.height}px)
                      </span>
                    </label>
                    <input
                      type="file"
                      ref={sealInputRef}
                      onChange={handleSealUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <div
                      onClick={() => sealInputRef.current?.click()}
                      className="border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors flex flex-col items-center justify-center min-h-[120px]"
                    >
                      {sealPreview ? (
                        <img
                          src={sealPreview}
                          alt="Печать"
                          className="max-h-[100px] object-contain"
                        />
                      ) : (
                        <>
                          <Stamp className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">
                            Загрузить печать
                          </span>
                        </>
                      )}
                    </div>
                    {sealBlob && (
                      <p className="text-xs text-muted-foreground">
                        Обрезано: {IMAGE_DIMENSIONS.seal.width}×{IMAGE_DIMENSIONS.seal.height}px
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Банковские реквизиты */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Банковские реквизиты{" "}
                  <span className="text-destructive">*</span>
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      name: "",
                      nameI18n: { ru: "", en: "" },
                      bankName: "",
                      bankNameI18n: { ru: "", en: "" },
                      bankAddress: "",
                      bankAddressI18n: { ru: "", en: "" },
                      account: "",
                      bic: "",
                      corrAccount: "",
                      swiftCode: "",
                      currencyCode: "RUB",
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Добавить банк
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-lg border p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Банк #{index + 1}</h4>
                        <p className="text-xs text-muted-foreground">
                          Укажите БИК или SWIFT код
                        </p>
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <FormField
                        control={form.control}
                        name={`banks.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Название счёта{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Основной счёт RUB"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`banks.${index}.bankName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Название банка{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="ВТБ" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`banks.${index}.currencyCode`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Валюта</FormLabel>
                            <FormControl>
                              <Input placeholder="RUB" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`banks.${index}.nameI18n.en`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Название счёта (EN)</FormLabel>
                            <FormControl>
                              <Input placeholder="Account title in English" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`banks.${index}.bankNameI18n.en`}
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
                    </div>

                    <FormField
                      control={form.control}
                      name={`banks.${index}.bankAddress`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Адрес банка</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="г. Москва, ул. Банковская, д. 1"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`banks.${index}.bankAddressI18n.en`}
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

                    <div className="grid gap-4 lg:grid-cols-3">
                      <FormField
                        control={form.control}
                        name={`banks.${index}.account`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Номер счёта / IBAN{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="40807810916120000001"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`banks.${index}.bic`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>БИК / BIC</FormLabel>
                            <FormControl>
                              <Input placeholder="044525411" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`banks.${index}.corrAccount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Корр. счёт</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="30101810145250000411"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`banks.${index}.swiftCode`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SWIFT код</FormLabel>
                          <FormControl>
                            <Input placeholder="VTBRRUMM" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}

                {form.formState.errors.banks?.root && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.banks.root.message}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {error && (
            <div className="mt-4 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

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

      {/* Image Cropper Modal */}
      <ImageCropper
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        imageSrc={cropperImageSrc}
        imageType={cropperImageType}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
