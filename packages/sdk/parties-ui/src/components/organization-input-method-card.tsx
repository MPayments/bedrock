"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Edit3,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@bedrock/sdk-ui/components/input-group";
import { cn } from "@bedrock/sdk-ui/lib/utils";

import type {
  PartyAddressInput,
  PartyContactInput,
  PartyIdentifierInput,
  PartyProfileBundleInput,
  PartyRepresentativeInput,
} from "../lib/contracts";
import {
  type OrganizationCardParseResult,
  type OrganizationInnLookupResult,
} from "../lib/organization-prefill";
import type { OrganizationGeneralFormValues } from "./organization-general-editor";

export type OrganizationPrefillPatch = {
  general: Partial<OrganizationGeneralFormValues>;
  profile: Partial<PartyProfileBundleInput>;
  ignoredBanking?: boolean;
};

export type OrganizationInputMethod = "manual" | "inn" | "card";

export type OrganizationInputMethodCardProps = {
  organizationKind: "legal_entity" | "individual";
  disabled?: boolean;
  lookupOrganizationByInn: (
    inn: string,
  ) => Promise<OrganizationInnLookupResult>;
  mode: OrganizationInputMethod;
  onModeChange: (mode: OrganizationInputMethod) => void;
  onPrefill: (patch: OrganizationPrefillPatch) => void;
  parseOrganizationCardPdf: (
    file: File,
  ) => Promise<OrganizationCardParseResult>;
};

type ModeOption = {
  description: string;
  disabled?: boolean;
  icon: typeof Edit3;
  ruOnly?: boolean;
  title: string;
  value: OrganizationInputMethod;
};

export function OrganizationInputMethodCard({
  organizationKind,
  disabled,
  lookupOrganizationByInn,
  mode,
  onModeChange,
  onPrefill,
  parseOrganizationCardPdf,
}: OrganizationInputMethodCardProps) {
  const isLegal = organizationKind === "legal_entity";

  const options: ModeOption[] = [
    {
      value: "manual",
      icon: Edit3,
      title: "Вручную",
      description: "Заполните поля ниже сами.",
    },
    {
      value: "inn",
      icon: Search,
      title: "По ИНН",
      description: "Поиск в справочнике юрлиц по ИНН.",
      disabled: !isLegal,
      ruOnly: true,
    },
    {
      value: "card",
      icon: Sparkles,
      title: "Из PDF-карточки",
      description: "AI распознает реквизиты и контакты.",
      disabled: !isLegal,
    },
  ];

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="space-y-1">
          <CardTitle className="text-base">Способ заполнения</CardTitle>
          <p className="text-sm text-muted-foreground">
            Выберите удобный путь — выбор не блокирует ручное редактирование
            полей ниже.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          {options.map((option) => {
            const Icon = option.icon;
            const active = mode === option.value;
            const optionDisabled = disabled || option.disabled;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (optionDisabled) {
                    return;
                  }
                  onModeChange(option.value);
                }}
                disabled={optionDisabled}
                aria-pressed={active}
                className={cn(
                  "relative flex items-start gap-3 rounded-md border bg-background p-3 text-left transition-colors",
                  active
                    ? "border-foreground ring-1 ring-foreground"
                    : "hover:border-foreground/40 hover:bg-muted/50",
                  optionDisabled && "cursor-not-allowed opacity-60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                    active
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{option.title}</span>
                    {option.ruOnly ? (
                      <Badge variant="outline" className="text-[10px]">
                        RU only
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {option.disabled && !isLegal
                      ? "Только для юрлиц"
                      : option.description}
                  </p>
                </div>
                {active ? (
                  <Check
                    className="absolute top-2 right-2 size-4 text-foreground"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {mode === "inn" && isLegal ? (
          <InnLookupPanel
            disabled={disabled}
            lookupOrganizationByInn={lookupOrganizationByInn}
            onPrefill={onPrefill}
          />
        ) : null}
        {mode === "card" && isLegal ? (
          <CardParsePanel
            disabled={disabled}
            onPrefill={onPrefill}
            parseOrganizationCardPdf={parseOrganizationCardPdf}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

type PrefillPanelProps = {
  disabled?: boolean;
  onPrefill: (patch: OrganizationPrefillPatch) => void;
};

type InnLookupPanelProps = PrefillPanelProps & {
  lookupOrganizationByInn: (
    inn: string,
  ) => Promise<OrganizationInnLookupResult>;
};

function InnLookupPanel({
  disabled,
  lookupOrganizationByInn,
  onPrefill,
}: InnLookupPanelProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const data = await lookupOrganizationByInn(value);
      onPrefill(buildPatchFromInn(data));
      setSuccess(true);
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Ошибка поиска организации по ИНН",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">Поиск по ИНН</div>
        <p className="text-xs text-muted-foreground">
          Найдём карточку в ЕГРЮЛ/ЕГРИП и автоматически заполним реквизиты,
          адрес и данные подписанта.
        </p>
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search className="size-4 shrink-0 opacity-60" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="10 или 12 цифр"
            value={value}
            onChange={(event) => {
              setValue(event.target.value.replace(/\D/g, ""));
              setSuccess(false);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleLookup();
              }
            }}
            disabled={disabled || loading}
            maxLength={12}
            inputMode="numeric"
          />
        </InputGroup>
        <Button
          type="button"
          onClick={() => void handleLookup()}
          disabled={disabled || loading || !value.trim()}
          className="md:w-auto"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          {loading ? "Ищем..." : "Найти в реестре"}
        </Button>
      </div>
      {success ? (
        <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          Данные организации подгружены в форму ниже
        </div>
      ) : null}
      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

type CardParsePanelProps = PrefillPanelProps & {
  parseOrganizationCardPdf: (
    file: File,
  ) => Promise<OrganizationCardParseResult>;
};

function CardParsePanel({
  disabled,
  onPrefill,
  parseOrganizationCardPdf,
}: CardParsePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ignoredBanking, setIgnoredBanking] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const interactive = !disabled && !loading;

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setLoading(true);
    setError(null);
    setIgnoredBanking(false);
    setFileName(file.name);
    setSuccess(false);

    try {
      const data = await parseOrganizationCardPdf(file);
      const patch = buildPatchFromCard(data);
      onPrefill(patch);
      setIgnoredBanking(Boolean(patch.ignoredBanking));
      setSuccess(true);
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : "Ошибка распознавания файла",
      );
      setFileName(null);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function reset() {
    setFileName(null);
    setSuccess(false);
    setError(null);
    setIgnoredBanking(false);
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
        disabled={!interactive}
      />
      {success && fileName ? (
        <div className="space-y-2 rounded-lg border bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-sm font-medium">Карточка распознана</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{fileName}</span>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={reset}
              disabled={!interactive}
            >
              Заменить
            </Button>
          </div>
          {ignoredBanking ? (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              В файле найдены банковские реквизиты. Они не переносятся в
              карточку организации — добавьте вручную во вкладке «Реквизиты».
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (interactive) {
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            if (!interactive) {
              return;
            }
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => {
            if (!interactive) {
              return;
            }
            event.preventDefault();
            setIsDragOver(false);
            void handleFile(event.dataTransfer.files?.[0]);
          }}
          disabled={!interactive}
          className={cn(
            "group flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted/20 p-6 text-center transition-colors",
            isDragOver
              ? "border-foreground bg-muted/40"
              : "border-border hover:border-foreground/60 hover:bg-muted/30",
            !interactive && "cursor-not-allowed opacity-60",
          )}
        >
          {loading ? (
            <>
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <div className="space-y-1">
                <div className="text-sm font-medium">Распознаём документ…</div>
                {fileName ? (
                  <div className="text-xs text-muted-foreground truncate">
                    {fileName}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <span className="flex size-10 items-center justify-center rounded-full bg-background">
                <Upload className="size-5 text-foreground" />
              </span>
              <div className="space-y-0.5">
                <div className="text-sm font-medium">
                  Перетащите PDF-карточку или нажмите, чтобы выбрать файл
                </div>
                <div className="text-xs text-muted-foreground">
                  AI извлечёт название, ИНН, адрес и данные подписанта (до 10 МБ)
                </div>
              </div>
            </>
          )}
        </button>
      )}
      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

function buildPatchFromInn(
  data: OrganizationInnLookupResult,
): OrganizationPrefillPatch {
  return {
    general: buildGeneralPatch(data),
    profile: buildProfilePatch(data),
  };
}

function buildPatchFromCard(
  data: OrganizationCardParseResult,
): OrganizationPrefillPatch {
  const hasBanking = Boolean(
    data.account ||
      data.bankAddress ||
      data.bankCountry ||
      data.bankName ||
      data.bic ||
      data.swift,
  );

  const profilePatch = buildProfilePatch(data);
  const contacts = buildContacts(data);
  if (contacts.length > 0) {
    profilePatch.contacts = contacts;
  }

  return {
    general: buildGeneralPatch(data),
    profile: profilePatch,
    ignoredBanking: hasBanking,
  };
}

function buildGeneralPatch(
  data: OrganizationInnLookupResult,
): Partial<OrganizationGeneralFormValues> {
  const patch: Partial<OrganizationGeneralFormValues> = {
    country: "RU",
  };

  if (data.orgName) {
    patch.shortName = data.orgName;
    patch.fullName = data.orgName;
  }

  return patch;
}

function buildProfilePatch(
  data: OrganizationInnLookupResult,
): Partial<PartyProfileBundleInput> {
  const patch: Partial<PartyProfileBundleInput> = {};

  const identifiers: PartyIdentifierInput[] = [];
  const pushIdentifier = (
    scheme: PartyIdentifierInput["scheme"],
    value: string | undefined,
  ) => {
    if (value) {
      identifiers.push({ scheme, value });
    }
  };

  pushIdentifier("inn", data.inn);
  pushIdentifier("kpp", data.kpp);
  pushIdentifier("ogrn", data.ogrn);
  pushIdentifier("okpo", data.okpo);
  pushIdentifier("oktmo", data.oktmo);

  if (identifiers.length > 0) {
    patch.identifiers = identifiers;
  }

  const addressPatch = buildAddress(data);
  if (addressPatch) {
    patch.address = addressPatch;
  }

  if (data.directorName || data.position || data.directorBasis) {
    patch.representatives = [buildDirector(data)];
  }

  return patch;
}

function buildContacts(
  data: OrganizationCardParseResult,
): PartyContactInput[] {
  const contacts: PartyContactInput[] = [];
  if (data.email) {
    contacts.push({ type: "email", value: data.email, isPrimary: true });
  }
  if (data.phone) {
    contacts.push({
      type: "phone",
      value: data.phone,
      isPrimary: contacts.length === 0,
    });
  }
  return contacts;
}

function buildAddress(
  data: OrganizationInnLookupResult,
): PartyAddressInput | null {
  const fullAddress = data.address?.trim() || null;
  const postalCode = data.postalCode?.trim() || null;
  const city = data.city?.trim() || null;
  const streetAddress = data.streetAddress?.trim() || null;
  const addressDetails = data.addressDetails?.trim() || null;

  if (
    !fullAddress &&
    !postalCode &&
    !city &&
    !streetAddress &&
    !addressDetails
  ) {
    return null;
  }

  return {
    countryCode: "RU",
    postalCode,
    city,
    cityI18n: city ? { ru: city, en: null } : null,
    streetAddress,
    streetAddressI18n: streetAddress ? { ru: streetAddress, en: null } : null,
    addressDetails,
    addressDetailsI18n: addressDetails
      ? { ru: addressDetails, en: null }
      : null,
    fullAddress,
    fullAddressI18n: fullAddress ? { ru: fullAddress, en: null } : null,
  };
}

function buildDirector(
  data: OrganizationInnLookupResult,
): PartyRepresentativeInput {
  return {
    role: "director",
    fullName: data.directorName ?? "",
    fullNameI18n: data.directorName
      ? { ru: data.directorName, en: null }
      : null,
    title: data.position ?? null,
    titleI18n: data.position ? { ru: data.position, en: null } : null,
    basisDocument: data.directorBasis ?? null,
    basisDocumentI18n: data.directorBasis
      ? { ru: data.directorBasis, en: null }
      : null,
    isPrimary: true,
  };
}
