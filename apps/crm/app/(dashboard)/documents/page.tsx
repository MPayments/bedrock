"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { FileText, Download, Loader2, Languages, Building2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { API_BASE_URL } from "@/lib/constants";
import { translateFieldsToEnglish } from "@/lib/translate-fields";

function groupFieldsByCategory(
  fields: TemplateField[],
): Record<string, TemplateField[]> {
  const grouped: Record<string, TemplateField[]> = {};
  for (const field of fields) {
    const cat = field.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(field);
  }
  return grouped;
}

interface Template {
  name: string;
  label: string;
}

interface TemplateField {
  name: string;
  label: string;
  category: string;
}

interface Organization {
  id: number;
  name: string;
}

export default function DocumentsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    number | null
  >(null);

  const [format, setFormat] = useState<"docx" | "pdf">("docx");
  const [generating, setGenerating] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Record<string, string>>({
    defaultValues: {},
  });

  useEffect(() => {
    async function loadOrganizations() {
      try {
        const res = await fetch(`${API_BASE_URL}/organizations`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Ошибка загрузки организаций");
        const raw = await res.json();
        const data: Organization[] = Array.isArray(raw) ? raw : raw.data ?? [];
        setOrganizations(data);
      } catch (err) {
        console.error("Error loading organizations:", err);
        setError("Не удалось загрузить организации");
      } finally {
        setLoadingOrganizations(false);
      }
    }
    loadOrganizations();
  }, []);

  const loadTemplates = useCallback(
    async (orgId: number) => {
      setLoadingTemplates(true);
      setTemplates([]);
      setSelectedTemplate(null);
      setFields([]);
      form.reset({});
      try {
        const res = await fetch(
          `${API_BASE_URL}/documents/templates?organizationId=${orgId}`,
          { credentials: "include" },
        );
        if (!res.ok) throw new Error("Ошибка загрузки шаблонов");
        const data: Template[] = await res.json();
        setTemplates(data);
      } catch (err) {
        console.error("Error loading templates:", err);
        setError("Не удалось загрузить список шаблонов");
      } finally {
        setLoadingTemplates(false);
      }
    },
    [form],
  );

  const handleSelectOrganization = useCallback(
    (orgId: string) => {
      const id = parseInt(orgId);
      setSelectedOrganizationId(id);
      setError(null);
      loadTemplates(id);
    },
    [loadTemplates],
  );

  const handleSelectTemplate = useCallback(
    async (template: Template) => {
      setSelectedTemplate(template);
      setFields([]);
      setError(null);
      setLoadingFields(true);
      form.reset({});

      try {
        const orgParam = selectedOrganizationId
          ? `?organizationId=${selectedOrganizationId}`
          : "";
        const res = await fetch(
          `${API_BASE_URL}/documents/templates/${encodeURIComponent(template.name)}/fields${orgParam}`,
          { credentials: "include" },
        );
        if (!res.ok) throw new Error("Ошибка чтения полей шаблона");
        const data: TemplateField[] = await res.json();
        setFields(data);

        const defaults: Record<string, string> = {};
        data.forEach((f) => {
          defaults[f.name] = "";
        });
        form.reset(defaults);
      } catch (err) {
        console.error("Error loading fields:", err);
        setError("Не удалось загрузить поля шаблона");
      } finally {
        setLoadingFields(false);
      }
    },
    [form, selectedOrganizationId],
  );

  const hasEnFields = fields.some((f) => f.name.endsWith("_en"));

  const handleTranslateToEnglish = async () => {
    setTranslating(true);
    setError(null);

    try {
      const values = form.getValues();
      const enFieldNames = new Set(
        fields.filter((f) => f.name.endsWith("_en")).map((f) => f.name),
      );

      const ruFields: Record<string, string> = {};
      for (const enName of enFieldNames) {
        const baseName = enName.slice(0, -3);
        const ruValue = values[baseName];
        if (ruValue && ruValue.trim()) {
          ruFields[baseName] = ruValue;
        }
      }

      if (Object.keys(ruFields).length === 0) {
        setError("Заполните русские поля перед переводом");
        return;
      }

      const translated = await translateFieldsToEnglish(ruFields);

      for (const [baseName, enValue] of Object.entries(translated)) {
        const enFieldName = `${baseName}_en`;
        if (enFieldNames.has(enFieldName) && enValue) {
          form.setValue(enFieldName, enValue, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      }
    } catch (err) {
      console.error("Translation error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка перевода полей",
      );
    } finally {
      setTranslating(false);
    }
  };

  const onSubmit = async (data: Record<string, string>) => {
    if (!selectedTemplate || !selectedOrganizationId) return;

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/documents/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateName: selectedTemplate.name,
          data,
          format,
          organizationId: selectedOrganizationId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Ошибка генерации документа");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      let filename = `document.${format}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = decodeURIComponent(match[1]);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Generate error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка генерации документа",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex gap-6 min-h-[calc(100vh-160px)]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 space-y-4">
        <Card className="sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Организация
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOrganizations ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Загрузка...
              </div>
            ) : (
              <Select
                value={
                  selectedOrganizationId
                    ? String(selectedOrganizationId)
                    : undefined
                }
                onValueChange={(value) => {
                  if (value) {
                    handleSelectOrganization(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите организацию" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {selectedOrganizationId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Шаблоны
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Загрузка...
                </div>
              ) : templates.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Шаблоны не найдены
                </div>
              ) : (
                <nav className="flex flex-col">
                  {templates.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => handleSelectTemplate(t)}
                      className={`text-left px-4 py-3 text-sm transition-colors hover:bg-accent ${
                        selectedTemplate?.name === t.name
                          ? "bg-accent font-medium"
                          : ""
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>
              )}
            </CardContent>
          </Card>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {!selectedOrganizationId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg">Выберите организацию</p>
              <p className="text-sm mt-1">
                Выберите организацию для загрузки шаблонов
              </p>
            </div>
          </div>
        ) : !selectedTemplate ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg">Выберите шаблон документа</p>
              <p className="text-sm mt-1">
                Выберите шаблон в списке слева для заполнения
              </p>
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                {selectedTemplate.label}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Заполните поля для генерации документа
              </p>
            </CardHeader>
            <CardContent>
              {loadingFields ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Загрузка полей...
                </div>
              ) : fields.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  В шаблоне не найдены плейсхолдеры
                </div>
              ) : (
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  {error && (
                    <div className="mb-6 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <div className="space-y-6">
                    {Object.entries(groupFieldsByCategory(fields)).map(
                      ([category, categoryFields]) => (
                        <div key={category}>
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                            {category}
                          </h3>
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {categoryFields.map((field) => (
                              <div key={field.name} className="space-y-2">
                                <Label htmlFor={field.name}>
                                  {field.label}
                                </Label>
                                <Input
                                  id={field.name}
                                  {...form.register(field.name)}
                                  placeholder={field.label}
                                />
                              </div>
                            ))}
                          </div>
                          <Separator className="mt-5" />
                        </div>
                      ),
                    )}
                  </div>

                  <Separator className="my-6" />

                  <div className="flex items-center gap-4">
                    <div className="w-40">
                      <Label className="mb-2 block">Формат</Label>
                      <Select
                        value={format}
                        onValueChange={(v) =>
                          setFormat(v as "docx" | "pdf")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="docx">DOCX</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1" />

                    {hasEnFields && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTranslateToEnglish}
                        disabled={translating || generating}
                      >
                        {translating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Перевод...
                          </>
                        ) : (
                          <>
                            <Languages className="mr-2 h-4 w-4" />
                            Перевести на EN
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      type="submit"
                      disabled={generating || !selectedOrganizationId}
                      size="lg"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Генерация...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Скачать документ
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
