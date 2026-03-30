"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronLeft,
  Loader2,
  Building2,
  FileSignature,
  User,
  AlertCircle,
  Pencil,
  Upload,
  Save,
  Languages,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import { Badge } from "@bedrock/sdk-ui/components/badge";
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
  editOrganizationSchema,
  type EditOrganizationInput,
} from "@/lib/validation";

type LocalizedText = { ru?: string | null; en?: string | null } | null;

interface Organization {
  id: string;
  shortName: string;
  fullName: string;
  nameI18n?: LocalizedText;
  orgType: string | null;
  orgTypeI18n?: LocalizedText;
  country: string | null;
  countryI18n?: LocalizedText;
  city: string | null;
  cityI18n?: LocalizedText;
  address: string | null;
  addressI18n?: LocalizedText;
  inn: string | null;
  taxId: string | null;
  kpp: string | null;
  ogrn: string | null;
  oktmo: string | null;
  okpo: string | null;
  directorName: string | null;
  directorNameI18n?: LocalizedText;
  directorPosition: string | null;
  directorPositionI18n?: LocalizedText;
  directorBasis: string | null;
  directorBasisI18n?: LocalizedText;
  isActive: boolean;
  signatureUrl: string | null;
  sealUrl: string | null;
  banksCount: number;
  createdAt: string;
  updatedAt: string;
}

const toLocalizedFormValue = (localized?: LocalizedText) => ({
  ru: localized?.ru || "",
  en: localized?.en || "",
});

function organizationToFormData(org: Organization): EditOrganizationInput {
  return {
    name: org.shortName || "",
    nameI18n: toLocalizedFormValue(org.nameI18n),
    orgType: org.orgType || "",
    orgTypeI18n: toLocalizedFormValue(org.orgTypeI18n),
    country: org.country || "",
    countryI18n: toLocalizedFormValue(org.countryI18n),
    city: org.city || "",
    cityI18n: toLocalizedFormValue(org.cityI18n),
    address: org.address || "",
    addressI18n: toLocalizedFormValue(org.addressI18n),
    inn: org.inn || "",
    taxId: org.taxId || "",
    kpp: org.kpp || "",
    ogrn: org.ogrn || "",
    oktmo: org.oktmo || "",
    okpo: org.okpo || "",
    directorName: org.directorName || "",
    directorNameI18n: toLocalizedFormValue(org.directorNameI18n),
    directorPosition: org.directorPosition || "",
    directorPositionI18n: toLocalizedFormValue(org.directorPositionI18n),
    directorBasis: org.directorBasis || "",
    directorBasisI18n: toLocalizedFormValue(org.directorBasisI18n),
  };
}

export default function OrganizationViewPage() {
  const router = useRouter();
  const params = useParams();
  const organizationId = params?.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Перевод на английский
  const [translating, setTranslating] = useState(false);

  // Image editing state
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const [sealBlob, setSealBlob] = useState<Blob | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [sealPreview, setSealPreview] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string>("");
  const [cropperImageType, setCropperImageType] =
    useState<ImageType>("signature");
  const [savingImages, setSavingImages] = useState(false);

  const form = useForm<EditOrganizationInput>({
    resolver: zodResolver(editOrganizationSchema),
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
      directorPosition: "",
      directorPositionI18n: { ru: "", en: "" },
      directorBasis: "",
      directorBasisI18n: { ru: "", en: "" },
    },
    mode: "onBlur",
  });

  const fetchOrganization = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API_BASE_URL}/organizations/${organizationId}`,
        { credentials: "include" },
      );

      if (!res.ok) {
        throw new Error(`Ошибка загрузки: ${res.status}`);
      }

      const data: Organization = await res.json();
      setOrganization(data);
      form.reset(organizationToFormData(data));
    } catch (err) {
      console.error("Organization fetch error:", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }, [organizationId, form]);

  useEffect(() => {
    if (organizationId) {
      fetchOrganization();
    }
  }, [fetchOrganization, organizationId]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    const sigPreview = signaturePreview;
    const slPreview = sealPreview;
    return () => {
      if (sigPreview) URL.revokeObjectURL(sigPreview);
      if (slPreview) URL.revokeObjectURL(slPreview);
    };
  }, [signaturePreview, sealPreview]);

  // Handle signature upload
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
    e.target.value = "";
  };

  // Handle seal upload
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
    e.target.value = "";
  };

  // Handle crop complete
  const handleCropComplete = (croppedBlob: Blob, previewUrl: string) => {
    if (cropperImageType === "signature") {
      if (signaturePreview) URL.revokeObjectURL(signaturePreview);
      setSignatureBlob(croppedBlob);
      setSignaturePreview(previewUrl);
    } else {
      if (sealPreview) URL.revokeObjectURL(sealPreview);
      setSealBlob(croppedBlob);
      setSealPreview(previewUrl);
    }
  };

  // Save updated images
  const handleSaveImages = async () => {
    if (!signatureBlob || !sealBlob) {
      setError("Необходимо загрузить обе картинки: подпись и печать");
      return;
    }

    setSavingImages(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("signature", signatureBlob, "signature.png");
      formData.append("seal", sealBlob, "seal.png");

      const res = await fetch(
        `${API_BASE_URL}/organizations/${organizationId}/files`,
        { method: "POST", credentials: "include", body: formData },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Ошибка сохранения: ${res.status}`,
        );
      }

      // Refresh organization data
      await fetchOrganization();
      clearImageEditState();
    } catch (err) {
      console.error("Save images error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка сохранения изображений",
      );
    } finally {
      setSavingImages(false);
    }
  };

  const clearImageEditState = () => {
    if (signaturePreview) URL.revokeObjectURL(signaturePreview);
    if (sealPreview) URL.revokeObjectURL(sealPreview);
    setSignatureBlob(null);
    setSealBlob(null);
    setSignaturePreview(null);
    setSealPreview(null);
  };

  const handleCancelImageEdit = () => {
    clearImageEditState();
    setError(null);
  };

  const isEditingImages = signatureBlob !== null || sealBlob !== null;

  // Save organization data
  const onSubmit = async (data: EditOrganizationInput) => {
    setSaving(true);
    setError(null);

    try {
      const normalizedData: EditOrganizationInput = {
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
      };

      const { name, ...orgData } = normalizedData;
      const orgRes = await fetch(
        `${API_BASE_URL}/organizations/${organizationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...orgData,
            fullName: name,
            shortName: name,
          }),
        },
      );

      if (!orgRes.ok) {
        const errorData = await orgRes.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Ошибка сохранения организации: ${orgRes.status}`,
        );
      }

      // Refresh data
      await fetchOrganization();
      setIsEditing(false);
    } catch (err) {
      console.error("Save organization error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка сохранения организации",
      );
    } finally {
      setSaving(false);
    }
  };

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
    } catch (err) {
      console.error("Translation error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка перевода полей"
      );
    } finally {
      setTranslating(false);
    }
  };

  const handleCancel = () => {
    if (organization) {
      form.reset(organizationToFormData(organization));
    }
    setIsEditing(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if ((error && !organization) || !organization) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
          <h1 className="text-2xl font-bold">Организация не найдена</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error || "Организация не найдена"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{organization.shortName}</h1>
            <p className="text-sm text-muted-foreground">
              {organization.orgType && `${organization.orgType} • `}
              {organization.inn && `ИНН: ${organization.inn}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/organizations/${organizationId}/requisites`)}
          >
            Реквизиты
          </Button>
          {!isEditing ? (
            <>
              <Badge variant={organization.isActive ? "default" : "secondary"}>
                {organization.isActive ? "Активна" : "Неактивна"}
              </Badge>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Редактировать
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleTranslateToEnglish}
                disabled={translating || saving}
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
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                Отмена
              </Button>
              <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
                {saving ? (
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
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Form {...form}>
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
                      {isEditing && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          placeholder="МТК ТРЕЙДИНГ КОМПАНИ..."
                          {...field}
                        />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
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
                      {isEditing ? (
                        <Input placeholder="Organization name in English" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
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
                        Тип{" "}
                        {isEditing && (
                          <span className="text-destructive">*</span>
                        )}
                      </FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="ООО, ОсОО..." {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
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
                        Страна{" "}
                        {isEditing && (
                          <span className="text-destructive">*</span>
                        )}
                      </FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="Турецкая Республика" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="orgTypeI18n.en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип (EN)</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="LLC, Ltd..." {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
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
                        {isEditing ? (
                          <Input placeholder="Country in English" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
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
                      Город{" "}
                      {isEditing && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input placeholder="Стамбул" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
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
                      {isEditing ? (
                        <Input placeholder="City in English" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
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
                      Адрес{" "}
                      {isEditing && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          placeholder="Полный юридический адрес..."
                          {...field}
                        />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
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
                      {isEditing ? (
                        <Input placeholder="Legal address in English" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
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
                        {isEditing ? (
                          <Input placeholder="9909685510" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
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
                        {isEditing ? (
                          <Input placeholder="0623215774600001" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
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
                        {isEditing ? (
                          <Input placeholder="165887001" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
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
                        {isEditing ? (
                          <Input placeholder="0000000000000" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
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
                        {isEditing ? (
                          <Input placeholder="111111111111" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
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
                        {isEditing ? (
                          <Input placeholder="2222222222" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
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
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Руководитель
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="directorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      ФИО директора{" "}
                      {isEditing && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input placeholder="Иванов Иван Иванович" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
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
                      {isEditing ? (
                        <Input placeholder="Director full name in English" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
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
                      Должность{" "}
                      {isEditing && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input placeholder="Генеральный директор" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
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
                      {isEditing ? (
                        <Input placeholder="Director position in English" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
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
                      {isEditing && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input placeholder="Устав" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
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
                      {isEditing ? (
                        <Input placeholder="Basis in English" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className="my-6" />

              {/* Печать и подпись */}
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-primary" />
                Печать и подпись
              </CardTitle>

              {/* Hidden file inputs */}
              <input
                type="file"
                ref={signatureInputRef}
                onChange={handleSignatureUpload}
                accept="image/*"
                className="hidden"
              />
              <input
                type="file"
                ref={sealInputRef}
                onChange={handleSealUpload}
                accept="image/*"
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-4">
                {/* Подпись */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Подпись{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        ({IMAGE_DIMENSIONS.signature.width}×
                        {IMAGE_DIMENSIONS.signature.height}px)
                      </span>
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={savingImages}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Изменить
                    </Button>
                  </div>
                  {signaturePreview ? (
                    <div className="border-2 border-primary rounded-lg p-4 flex items-center justify-center min-h-[120px] bg-primary/5">
                      <img
                        src={signaturePreview}
                        alt="Новая подпись"
                        className="max-h-[100px] object-contain"
                      />
                    </div>
                  ) : organization.signatureUrl ? (
                    <div className="border rounded-lg p-4 flex items-center justify-center min-h-[120px] bg-muted/30">
                      <img
                        src={`${API_BASE_URL}${
                          organization.signatureUrl
                        }?t=${new Date(organization.updatedAt).getTime()}`}
                        alt="Подпись"
                        className="max-h-[100px] object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => signatureInputRef.current?.click()}
                      className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center min-h-[120px] cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Загрузить подпись
                      </span>
                    </div>
                  )}
                  {signatureBlob && (
                    <p className="text-xs text-primary">
                      Новое изображение готово к сохранению
                    </p>
                  )}
                </div>

                {/* Печать */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Печать{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        ({IMAGE_DIMENSIONS.seal.width}×
                        {IMAGE_DIMENSIONS.seal.height}px)
                      </span>
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => sealInputRef.current?.click()}
                      disabled={savingImages}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Изменить
                    </Button>
                  </div>
                  {sealPreview ? (
                    <div className="border-2 border-primary rounded-lg p-4 flex items-center justify-center min-h-[120px] bg-primary/5">
                      <img
                        src={sealPreview}
                        alt="Новая печать"
                        className="max-h-[100px] object-contain"
                      />
                    </div>
                  ) : organization.sealUrl ? (
                    <div className="border rounded-lg p-4 flex items-center justify-center min-h-[120px] bg-muted/30">
                      <img
                        src={`${API_BASE_URL}${
                          organization.sealUrl
                        }?t=${new Date(organization.updatedAt).getTime()}`}
                        alt="Печать"
                        className="max-h-[100px] object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => sealInputRef.current?.click()}
                      className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center min-h-[120px] cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Загрузить печать
                      </span>
                    </div>
                  )}
                  {sealBlob && (
                    <p className="text-xs text-primary">
                      Новое изображение готово к сохранению
                    </p>
                  )}
                </div>
              </div>

              {/* Save/Cancel buttons when editing images */}
              {isEditingImages && (
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={handleCancelImageEdit}
                    disabled={savingImages}
                  >
                    Отмена
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    onClick={handleSaveImages}
                    disabled={savingImages || !signatureBlob || !sealBlob}
                  >
                    {savingImages ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      "Сохранить изображения"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Банковские реквизиты */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                Банковские реквизиты
                <Badge variant="secondary" className="ml-2">
                  {organization.banksCount}
                </Badge>
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/organizations/${organizationId}/requisites`)}
              >
                Управлять реквизитами
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Управление банковскими реквизитами перенесено в отдельный
                  раздел канонических реквизитов организации. На этой странице
                  редактируются только данные самой организации и её файлы.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Дополнительная информация */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">
                Дополнительная информация
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    Дата создания
                  </label>
                  <div className="text-sm">
                    {new Date(organization.createdAt).toLocaleString("ru-RU")}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    Последнее обновление
                  </label>
                  <div className="text-sm">
                    {new Date(organization.updatedAt).toLocaleString("ru-RU")}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    ID
                  </label>
                  <div className="text-sm">{organization.id}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
