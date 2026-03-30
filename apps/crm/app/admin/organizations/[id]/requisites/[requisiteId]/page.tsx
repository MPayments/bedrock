"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Loader2,
  Save,
  Trash2,
  Wallet,
} from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import { API_BASE_URL } from "@/lib/constants";

interface Organization {
  id: string;
  shortName: string;
  fullName: string;
  country: string | null;
}

interface RequisiteProviderOption {
  id: string;
  kind: string;
  label: string;
}

interface CurrencyOption {
  id: string;
  code: string;
  label: string;
}

interface RequisiteFormState {
  providerId: string;
  currencyId: string;
  label: string;
  description: string;
  beneficiaryName: string;
  institutionName: string;
  institutionCountry: string;
  accountNo: string;
  corrAccount: string;
  iban: string;
  bic: string;
  swift: string;
  bankAddress: string;
  contact: string;
  notes: string;
  isDefault: boolean;
}

const EMPTY_FORM: RequisiteFormState = {
  providerId: "",
  currencyId: "",
  label: "",
  description: "",
  beneficiaryName: "",
  institutionName: "",
  institutionCountry: "",
  accountNo: "",
  corrAccount: "",
  iban: "",
  bic: "",
  swift: "",
  bankAddress: "",
  contact: "",
  notes: "",
  isDefault: false,
};

function normalizeNullable(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export default function OrganizationRequisiteDetailPage() {
  const params = useParams();
  const router = useRouter();

  const organizationId = params?.id as string;
  const requisiteId = params?.requisiteId as string;
  const isCreate = requisiteId === "new";

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [providerOptions, setProviderOptions] = useState<RequisiteProviderOption[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [form, setForm] = useState<RequisiteFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const organizationRequest = fetch(
          `${API_BASE_URL}/organizations/${organizationId}`,
          {
            credentials: "include",
          },
        );
        const providersRequest = fetch(`${API_BASE_URL}/requisites/providers/options`, {
          credentials: "include",
        });
        const currenciesRequest = fetch(`${API_BASE_URL}/currencies/options`, {
          credentials: "include",
        });
        const requisiteRequest = isCreate
          ? Promise.resolve<Response | null>(null)
          : fetch(`${API_BASE_URL}/requisites/${requisiteId}`, {
              credentials: "include",
            });

        const [organizationRes, providersRes, currenciesRes, requisiteRes] =
          await Promise.all([
            organizationRequest,
            providersRequest,
            currenciesRequest,
            requisiteRequest,
          ]);

        if (!organizationRes.ok) {
          throw new Error("Не удалось загрузить организацию");
        }
        if (!providersRes.ok) {
          throw new Error("Не удалось загрузить провайдеров реквизитов");
        }
        if (!currenciesRes.ok) {
          throw new Error("Не удалось загрузить валюты");
        }
        if (requisiteRes && !requisiteRes.ok) {
          throw new Error("Не удалось загрузить реквизит");
        }

        const organizationPayload: Organization = await organizationRes.json();
        const providersPayload = await providersRes.json();
        const currenciesPayload = await currenciesRes.json();

        const providers = (providersPayload.data ?? []).filter(
          (item: RequisiteProviderOption) => item.kind === "bank",
        );
        const currencies = currenciesPayload.data ?? [];

        setOrganization(organizationPayload);
        setProviderOptions(providers);
        setCurrencyOptions(currencies);

        if (requisiteRes) {
          const requisite = await requisiteRes.json();
          setForm({
            providerId: requisite.providerId,
            currencyId: requisite.currencyId,
            label: requisite.label ?? "",
            description: requisite.description ?? "",
            beneficiaryName: requisite.beneficiaryName ?? "",
            institutionName: requisite.institutionName ?? "",
            institutionCountry: requisite.institutionCountry ?? "",
            accountNo: requisite.accountNo ?? "",
            corrAccount: requisite.corrAccount ?? "",
            iban: requisite.iban ?? "",
            bic: requisite.bic ?? "",
            swift: requisite.swift ?? "",
            bankAddress: requisite.bankAddress ?? "",
            contact: requisite.contact ?? "",
            notes: requisite.notes ?? "",
            isDefault: Boolean(requisite.isDefault),
          });
        } else {
          setForm((current) => ({
            ...current,
            beneficiaryName:
              current.beneficiaryName ||
              organizationPayload.fullName ||
              organizationPayload.shortName,
            institutionCountry:
              current.institutionCountry || organizationPayload.country || "",
          }));
        }
      } catch (err) {
        console.error("Organization requisite fetch error:", err);
        setError(
          err instanceof Error ? err.message : "Не удалось загрузить реквизит",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [isCreate, organizationId, requisiteId]);

  const providerSelectOptions = useMemo(
    () =>
      providerOptions.map((provider) => (
        <option key={provider.id} value={provider.id}>
          {provider.label}
        </option>
      )),
    [providerOptions],
  );

  const currencySelectOptions = useMemo(
    () =>
      currencyOptions.map((currency) => (
        <option key={currency.id} value={currency.id}>
          {currency.label}
        </option>
      )),
    [currencyOptions],
  );

  function updateField<K extends keyof RequisiteFormState>(
    key: K,
    value: RequisiteFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!organizationId) return;
    if (!form.providerId || !form.currencyId || !form.label.trim()) {
      setError("Заполните обязательные поля: провайдер, валюта и название.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        ownerType: "organization" as const,
        ownerId: organizationId,
        providerId: form.providerId,
        currencyId: form.currencyId,
        kind: "bank" as const,
        label: form.label.trim(),
        description: normalizeNullable(form.description),
        beneficiaryName: normalizeNullable(form.beneficiaryName),
        institutionName: normalizeNullable(form.institutionName),
        institutionCountry: normalizeNullable(form.institutionCountry),
        accountNo: normalizeNullable(form.accountNo),
        corrAccount: normalizeNullable(form.corrAccount),
        iban: normalizeNullable(form.iban),
        bic: normalizeNullable(form.bic),
        swift: normalizeNullable(form.swift),
        bankAddress: normalizeNullable(form.bankAddress),
        contact: normalizeNullable(form.contact),
        notes: normalizeNullable(form.notes),
        isDefault: form.isDefault,
      };

      const response = await fetch(
        isCreate
          ? `${API_BASE_URL}/requisites`
          : `${API_BASE_URL}/requisites/${requisiteId}`,
        {
          method: isCreate ? "POST" : "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isCreate ? payload : { ...payload, ownerId: undefined, ownerType: undefined, kind: undefined }),
        },
      );

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Не удалось сохранить реквизит");
      }

      const saved = await response.json();
      router.push(`/admin/organizations/${organizationId}/requisites/${saved.id}`);
      router.refresh();
    } catch (err) {
      console.error("Save requisite error:", err);
      setError(
        err instanceof Error ? err.message : "Не удалось сохранить реквизит",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (isCreate) return;

    try {
      setArchiving(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/requisites/${requisiteId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Не удалось архивировать реквизит");
      }

      router.push(`/admin/organizations/${organizationId}/requisites`);
      router.refresh();
    } catch (err) {
      console.error("Archive requisite error:", err);
      setError(
        err instanceof Error ? err.message : "Не удалось архивировать реквизит",
      );
    } finally {
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isCreate ? "Новый реквизит" : "Редактирование реквизита"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {organization?.shortName ?? "Организация"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isCreate && (
            <Button
              variant="outline"
              onClick={handleArchive}
              disabled={archiving || saving}
            >
              {archiving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Архивировать
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Сохранить
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Банковский реквизит
          </CardTitle>
          <CardDescription>
            Этот реквизит будет использоваться в договорах, сделках и
            шаблонах документов организации.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="providerId">Провайдер</Label>
            <select
              id="providerId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.providerId}
              onChange={(event) => updateField("providerId", event.target.value)}
            >
              <option value="">Выберите провайдера</option>
              {providerSelectOptions}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currencyId">Валюта</Label>
            <select
              id="currencyId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.currencyId}
              onChange={(event) => updateField("currencyId", event.target.value)}
            >
              <option value="">Выберите валюту</option>
              {currencySelectOptions}
            </select>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="label">Название</Label>
            <Input
              id="label"
              value={form.label}
              onChange={(event) => updateField("label", event.target.value)}
              placeholder="Основной расчётный счёт"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="beneficiaryName">Получатель</Label>
            <Input
              id="beneficiaryName"
              value={form.beneficiaryName}
              onChange={(event) =>
                updateField("beneficiaryName", event.target.value)
              }
              placeholder="Наименование получателя"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="institutionName">Банк</Label>
            <Input
              id="institutionName"
              value={form.institutionName}
              onChange={(event) =>
                updateField("institutionName", event.target.value)
              }
              placeholder="Название банка"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="institutionCountry">Страна банка</Label>
            <Input
              id="institutionCountry"
              value={form.institutionCountry}
              onChange={(event) =>
                updateField("institutionCountry", event.target.value)
              }
              placeholder="TR"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNo">Номер счёта / IBAN</Label>
            <Input
              id="accountNo"
              value={form.accountNo}
              onChange={(event) => updateField("accountNo", event.target.value)}
              placeholder="40702810..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="corrAccount">Корреспондентский счёт</Label>
            <Input
              id="corrAccount"
              value={form.corrAccount}
              onChange={(event) =>
                updateField("corrAccount", event.target.value)
              }
              placeholder="30101810..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              value={form.iban}
              onChange={(event) => updateField("iban", event.target.value)}
              placeholder="TR..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bic">BIC</Label>
            <Input
              id="bic"
              value={form.bic}
              onChange={(event) => updateField("bic", event.target.value)}
              placeholder="044525411"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="swift">SWIFT</Label>
            <Input
              id="swift"
              value={form.swift}
              onChange={(event) => updateField("swift", event.target.value)}
              placeholder="VTBRRUMM"
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="bankAddress">Адрес банка</Label>
            <Textarea
              id="bankAddress"
              value={form.bankAddress}
              onChange={(event) =>
                updateField("bankAddress", event.target.value)
              }
              placeholder="Юридический адрес банка"
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="Внутреннее описание реквизита"
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="contact">Контакт</Label>
            <Textarea
              id="contact"
              value={form.contact}
              onChange={(event) => updateField("contact", event.target.value)}
              placeholder="Контактные данные по реквизиту"
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="notes">Заметки</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Заметки для команды"
            />
          </div>

          <label className="flex items-center gap-3 rounded-md border p-3 lg:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => updateField("isDefault", event.target.checked)}
            />
            <span className="text-sm">Использовать как реквизит по умолчанию</span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
