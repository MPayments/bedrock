"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  Archive,
  Check,
  Plus,
  RotateCcw,
  Save,
  Send,
} from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";
import { Alert, AlertDescription, AlertTitle } from "@bedrock/sdk-ui/components/alert";
import { Badge } from "@bedrock/sdk-ui/components/badge";

import type {
  DealRouteTemplateCostComponentInput,
  DealRouteTemplateLegInput,
  DealRouteTemplateParticipantInput,
} from "@bedrock/deals/contracts";
import {
  getFinanceDealTypeLabel,
  type FinanceDealType,
} from "@/features/treasury/deals/labels";
import {
  getRouteTemplateBindingHint,
  getRouteTemplateBindingLabel,
  getRouteTemplateDisplayTitle,
  getRouteTemplateStatusLabel,
  getRouteTemplateStatusVariant,
  type FinanceRouteTemplateStatus,
} from "@/features/treasury/route-templates/labels";
import type { FinanceRouteTemplateWorkspace } from "@/features/treasury/route-templates/lib/queries";
import { NativeSelect } from "@/features/treasury/ui/native-select";
import { ParticipantLookupCombobox } from "@/features/treasury/ui/participant-lookup-combobox";
import { executeMutation } from "@/lib/resources/http";
import { formatDate } from "@/lib/format";

import { RouteTemplateWorkspaceLayout } from "./workspace-layout";

type RouteTemplateWorkspaceProps = {
  data: FinanceRouteTemplateWorkspace;
};

type CurrencyOption = FinanceRouteTemplateWorkspace["currencies"][number];

type LocalParticipant = DealRouteTemplateParticipantInput & {
  localId: string;
  partyLabel: string | null;
};

type LocalLeg = DealRouteTemplateLegInput & {
  executionCounterpartyLabel: string | null;
  localId: string;
};

type LocalCostComponent = DealRouteTemplateCostComponentInput & {
  localId: string;
};

type PartyKindOption = {
  kind: DealRouteTemplateParticipantInput["partyKind"];
  label: string;
};

const ROUTE_LEG_KIND_LABELS: Record<string, string> = {
  adjustment: "Корректировка",
  collection: "Сбор",
  fx_conversion: "FX-конвертация",
  intercompany_funding: "Межкомпанейское фондирование",
  intracompany_transfer: "Внутренний перевод",
  payout: "Выплата",
  return: "Возврат",
};

const ROUTE_COMPONENT_CLASSIFICATION_LABELS: Record<string, string> = {
  adjustment: "Корректировка",
  expense: "Расход",
  pass_through: "Перевыставление",
  revenue: "Доход",
};

const ROUTE_COMPONENT_FORMULA_LABELS: Record<string, string> = {
  bps: "bps",
  fixed: "Фикс",
  manual: "Ручная сумма",
  per_million: "На миллион",
};

const ROUTE_COMPONENT_BASIS_LABELS: Record<string, string> = {
  deal_source_amount: "Сумма сделки (source)",
  deal_target_amount: "Сумма сделки (target)",
  gross_revenue: "Gross revenue",
  leg_from_amount: "Leg from amount",
  leg_to_amount: "Leg to amount",
};

const DEAL_TYPE_OPTIONS: FinanceDealType[] = [
  "payment",
  "currency_exchange",
  "currency_transit",
  "exporter_settlement",
];

const BINDING_OPTIONS: DealRouteTemplateParticipantInput["bindingKind"][] = [
  "fixed_party",
  "deal_customer",
  "deal_applicant",
  "deal_payer",
  "deal_beneficiary",
];

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function resolvePartyKindForBinding(
  bindingKind: DealRouteTemplateParticipantInput["bindingKind"],
  currentKind: DealRouteTemplateParticipantInput["partyKind"],
): DealRouteTemplateParticipantInput["partyKind"] {
  switch (bindingKind) {
    case "deal_customer":
      return "customer";
    case "deal_applicant":
    case "deal_payer":
    case "deal_beneficiary":
      return "counterparty";
    default:
      return currentKind;
  }
}

function buildPartyKindOptions(
  lookupContext: FinanceRouteTemplateWorkspace["lookupContext"],
): PartyKindOption[] {
  return lookupContext.participantKinds
    .filter(
      (item): item is typeof item & {
        kind: DealRouteTemplateParticipantInput["partyKind"];
      } =>
        item.kind === "customer" ||
        item.kind === "counterparty" ||
        item.kind === "organization",
    )
    .map((item) => ({
      kind: item.kind,
      label: item.label,
    }));
}

function toLocalParticipants(
  template: FinanceRouteTemplateWorkspace["template"],
): LocalParticipant[] {
  if (!template) {
    return [];
  }

  return template.participants.map((participant) => ({
    bindingKind: participant.bindingKind,
    code: participant.code,
    displayNameTemplate: participant.displayNameTemplate,
    localId: participant.id,
    metadata: participant.metadata,
    partyId: participant.partyId,
    partyKind: participant.partyKind,
    partyLabel: participant.displayNameTemplate,
    requisiteId: participant.requisiteId,
    role: participant.role,
    sequence: participant.sequence,
  }));
}

function toLocalLegs(
  template: FinanceRouteTemplateWorkspace["template"],
): LocalLeg[] {
  if (!template) {
    return [];
  }

  return template.legs.map((leg) => ({
    code: leg.code,
    executionCounterpartyId: leg.executionCounterpartyId,
    executionCounterpartyLabel: null,
    expectedFromAmountMinor: leg.expectedFromAmountMinor,
    expectedRateDen: leg.expectedRateDen,
    expectedRateNum: leg.expectedRateNum,
    expectedToAmountMinor: leg.expectedToAmountMinor,
    fromCurrencyId: leg.fromCurrencyId,
    fromParticipantCode: leg.fromParticipantCode,
    idx: leg.idx,
    kind: leg.kind,
    localId: leg.id,
    notes: leg.notes,
    settlementModel: leg.settlementModel,
    toCurrencyId: leg.toCurrencyId,
    toParticipantCode: leg.toParticipantCode,
  }));
}

function toLocalCostComponents(
  template: FinanceRouteTemplateWorkspace["template"],
): LocalCostComponent[] {
  if (!template) {
    return [];
  }

  return template.costComponents.map((component) => ({
    basisType: component.basisType,
    bps: component.bps,
    classification: component.classification,
    code: component.code,
    currencyId: component.currencyId,
    family: component.family,
    fixedAmountMinor: component.fixedAmountMinor,
    formulaType: component.formulaType,
    includedInClientRate: component.includedInClientRate,
    legCode: component.legCode,
    localId: component.id,
    manualAmountMinor: component.manualAmountMinor,
    notes: component.notes,
    perMillion: component.perMillion,
    roundingMode: component.roundingMode,
    sequence: component.sequence,
  }));
}

function resequenceParticipants(items: LocalParticipant[]) {
  return items.map((item, index) => ({
    ...item,
    sequence: index + 1,
  }));
}

function resequenceLegs(items: LocalLeg[]) {
  return items.map((item, index) => ({
    ...item,
    idx: index + 1,
  }));
}

function resequenceCostComponents(items: LocalCostComponent[]) {
  return items.map((item, index) => ({
    ...item,
    sequence: index + 1,
  }));
}

function createEmptyParticipant(sequence: number): LocalParticipant {
  return {
    bindingKind: "fixed_party",
    code: `p${sequence}`,
    displayNameTemplate: null,
    localId: createLocalId("template-participant"),
    metadata: {},
    partyId: null,
    partyKind: "organization",
    partyLabel: null,
    requisiteId: null,
    role: "participant",
    sequence,
  };
}

function createEmptyLeg(
  idx: number,
  participants: LocalParticipant[],
  currencies: CurrencyOption[],
): LocalLeg {
  const firstParticipant = participants[0]?.code ?? "";
  const secondParticipant = participants[1]?.code ?? firstParticipant;
  const firstCurrencyId =
    currencies[0]?.id ?? "00000000-0000-4000-8000-000000000000";

  return {
    code: `leg${idx}`,
    executionCounterpartyId: null,
    executionCounterpartyLabel: null,
    expectedFromAmountMinor: null,
    expectedRateDen: null,
    expectedRateNum: null,
    expectedToAmountMinor: null,
    fromCurrencyId: firstCurrencyId,
    fromParticipantCode: firstParticipant,
    idx,
    kind: "collection",
    localId: createLocalId("template-leg"),
    notes: null,
    settlementModel: "manual",
    toCurrencyId: firstCurrencyId,
    toParticipantCode: secondParticipant,
  };
}

function createEmptyCostComponent(
  sequence: number,
  legs: LocalLeg[],
  currencies: CurrencyOption[],
): LocalCostComponent {
  return {
    basisType: "deal_source_amount",
    bps: null,
    classification: "expense",
    code: `cost${sequence}`,
    currencyId:
      currencies[0]?.id ?? "00000000-0000-4000-8000-000000000000",
    family: "provider_fee",
    fixedAmountMinor: null,
    formulaType: "fixed",
    includedInClientRate: false,
    legCode: legs[0]?.code ?? null,
    localId: createLocalId("template-cost"),
    manualAmountMinor: null,
    notes: null,
    perMillion: null,
    roundingMode: "half_up",
    sequence,
  };
}

function buildTemplatePayload(input: {
  code: string;
  costComponents: LocalCostComponent[];
  dealType: FinanceDealType;
  description: string;
  legs: LocalLeg[];
  name: string;
  participants: LocalParticipant[];
}) {
  return {
    code: input.code.trim(),
    costComponents: input.costComponents.map((item) => ({
      basisType: item.basisType,
      bps: normalizeNullableText(item.bps),
      classification: item.classification,
      code: item.code.trim(),
      currencyId: item.currencyId,
      family: item.family.trim(),
      fixedAmountMinor: normalizeNullableText(item.fixedAmountMinor),
      formulaType: item.formulaType,
      includedInClientRate: item.includedInClientRate,
      legCode: normalizeNullableText(item.legCode),
      manualAmountMinor: normalizeNullableText(item.manualAmountMinor),
      notes: normalizeNullableText(item.notes),
      perMillion: normalizeNullableText(item.perMillion),
      roundingMode: item.roundingMode.trim(),
      sequence: item.sequence,
    })),
    dealType: input.dealType,
    description: normalizeNullableText(input.description),
    legs: input.legs.map((item) => ({
      code: item.code.trim(),
      executionCounterpartyId: normalizeNullableText(
        item.executionCounterpartyId,
      ),
      expectedFromAmountMinor: normalizeNullableText(item.expectedFromAmountMinor),
      expectedRateDen: normalizeNullableText(item.expectedRateDen),
      expectedRateNum: normalizeNullableText(item.expectedRateNum),
      expectedToAmountMinor: normalizeNullableText(item.expectedToAmountMinor),
      fromCurrencyId: item.fromCurrencyId,
      fromParticipantCode: item.fromParticipantCode.trim(),
      idx: item.idx,
      kind: item.kind,
      notes: normalizeNullableText(item.notes),
      settlementModel: item.settlementModel.trim(),
      toCurrencyId: item.toCurrencyId,
      toParticipantCode: item.toParticipantCode.trim(),
    })),
    name: input.name.trim(),
    participants: input.participants.map((item) => ({
      bindingKind: item.bindingKind,
      code: item.code.trim(),
      displayNameTemplate: normalizeNullableText(
        item.displayNameTemplate ?? item.partyLabel,
      ),
      metadata: item.metadata,
      partyId:
        item.bindingKind === "fixed_party"
          ? normalizeNullableText(item.partyId)
          : null,
      partyKind: resolvePartyKindForBinding(item.bindingKind, item.partyKind),
      requisiteId: normalizeNullableText(item.requisiteId),
      role: item.role.trim(),
      sequence: item.sequence,
    })),
  } satisfies {
    code: string;
    costComponents: DealRouteTemplateCostComponentInput[];
    dealType: FinanceDealType;
    description: string | null;
    legs: DealRouteTemplateLegInput[];
    name: string;
    participants: DealRouteTemplateParticipantInput[];
  };
}

function RouteTemplateSummarySidebar({
  costComponents,
  dealType,
  isDirty,
  legs,
  participants,
  status,
  updatedAt,
}: {
  costComponents: LocalCostComponent[];
  dealType: FinanceDealType;
  isDirty: boolean;
  legs: LocalLeg[];
  participants: LocalParticipant[];
  status: FinanceRouteTemplateStatus | "new";
  updatedAt: string | null;
}) {
  const classificationCounts = useMemo(() => {
    return costComponents.reduce<Record<string, number>>((acc, item) => {
      acc[item.classification] = (acc[item.classification] ?? 0) + 1;
      return acc;
    }, {});
  }, [costComponents]);

  const formulaCounts = useMemo(() => {
    return costComponents.reduce<Record<string, number>>((acc, item) => {
      acc[item.formulaType] = (acc[item.formulaType] ?? 0) + 1;
      return acc;
    }, {});
  }, [costComponents]);

  const includedInClientRate = costComponents.filter(
    (component) => component.includedInClientRate,
  ).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Сводка шаблона</CardTitle>
          <CardDescription>
            Здесь только preview economics defaults. Денежная оценка появится уже на
            deal route и calculation snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Тип сделки</span>
            <span className="font-medium">{getFinanceDealTypeLabel(dealType)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Статус</span>
            <span className="font-medium">
              {status === "new" ? "Новый черновик" : getRouteTemplateStatusLabel(status)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Участники</span>
            <span className="font-medium">{participants.length}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Legs</span>
            <span className="font-medium">{legs.length}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Cost components</span>
            <span className="font-medium">{costComponents.length}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Включено в client rate</span>
            <span className="font-medium">{includedInClientRate}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Несохраненные изменения</span>
            <span className="font-medium">{isDirty ? "Да" : "Нет"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Последнее обновление</span>
            <span className="font-medium">
              {updatedAt ? formatDate(updatedAt) : "Еще не сохранен"}
            </span>
          </div>
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Classifications
            </p>
            {Object.entries(ROUTE_COMPONENT_CLASSIFICATION_LABELS).map(([value, label]) => (
              <div key={value} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{classificationCounts[value] ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Formula types
            </p>
            {Object.entries(ROUTE_COMPONENT_FORMULA_LABELS).map(([value, label]) => (
              <div key={value} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{formulaCounts[value] ?? 0}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RouteTemplateWorkspace({
  data,
}: RouteTemplateWorkspaceProps) {
  const router = useRouter();
  const template = data.template;
  const partyKindOptions = useMemo(
    () => buildPartyKindOptions(data.lookupContext),
    [data.lookupContext],
  );

  const initialParticipants = useMemo(
    () => toLocalParticipants(template),
    [template],
  );
  const initialLegs = useMemo(() => toLocalLegs(template), [template]);
  const initialCostComponents = useMemo(
    () => toLocalCostComponents(template),
    [template],
  );

  const [name, setName] = useState(template?.name ?? "");
  const [code, setCode] = useState(template?.code ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [dealType, setDealType] = useState<FinanceDealType>(
    template?.dealType ?? "payment",
  );
  const [participants, setParticipants] = useState(initialParticipants);
  const [legs, setLegs] = useState(initialLegs);
  const [costComponents, setCostComponents] = useState(initialCostComponents);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    setName(template?.name ?? "");
    setCode(template?.code ?? "");
    setDescription(template?.description ?? "");
    setDealType(template?.dealType ?? "payment");
    setParticipants(initialParticipants);
    setLegs(initialLegs);
    setCostComponents(initialCostComponents);
  }, [initialCostComponents, initialLegs, initialParticipants, template]);

  const initialSignature = useMemo(
    () =>
      JSON.stringify(
        buildTemplatePayload({
          code: template?.code ?? "",
          costComponents: initialCostComponents,
          dealType: template?.dealType ?? "payment",
          description: template?.description ?? "",
          legs: initialLegs,
          name: template?.name ?? "",
          participants: initialParticipants,
        }),
      ),
    [initialCostComponents, initialLegs, initialParticipants, template],
  );

  const currentSignature = useMemo(
    () =>
      JSON.stringify(
        buildTemplatePayload({
          code,
          costComponents,
          dealType,
          description,
          legs,
          name,
          participants,
        }),
      ),
    [code, costComponents, dealType, description, legs, name, participants],
  );

  const isDirty = currentSignature !== initialSignature;
  const status = template?.status ?? "new";
  const isReadOnly = template ? template.status !== "draft" : false;
  const title = template
    ? getRouteTemplateDisplayTitle({
        dealType: template.dealType,
        name: template.name,
      })
    : "Новый шаблон маршрута";

  async function refresh() {
    router.refresh();
  }

  async function handleSave() {
    setIsSaving(true);

    const payload = buildTemplatePayload({
      code,
      costComponents,
      dealType,
      description,
      legs,
      name,
      participants,
    });

    const result = template
      ? await executeMutation({
          fallbackMessage: "Не удалось сохранить шаблон маршрута",
          request: () =>
            fetch(`/v1/route-composer/templates/${encodeURIComponent(template.id)}`, {
              method: "PUT",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            }),
        })
      : await executeMutation({
          fallbackMessage: "Не удалось создать шаблон маршрута",
          request: () =>
            fetch("/v1/route-composer/templates", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            }),
        });

    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(template ? "Шаблон маршрута сохранен" : "Шаблон маршрута создан");

    const routeTemplateId =
      typeof result.data === "object" &&
      result.data &&
      "id" in result.data &&
      typeof result.data.id === "string"
        ? result.data.id
        : template?.id;

    if (!template && routeTemplateId) {
      router.replace(`/route-templates/${routeTemplateId}`);
    }

    await refresh();
  }

  async function handlePublish() {
    if (!template) {
      toast.error("Сначала сохраните шаблон маршрута");
      return;
    }

    setIsPublishing(true);

    const result = await executeMutation({
      fallbackMessage: "Не удалось опубликовать шаблон маршрута",
      request: () =>
        fetch(
          `/v1/route-composer/templates/${encodeURIComponent(template.id)}/publish`,
          {
            method: "POST",
            credentials: "include",
          },
        ),
    });

    setIsPublishing(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Шаблон маршрута опубликован");
    await refresh();
  }

  async function handleArchive() {
    if (!template) {
      return;
    }

    if (!window.confirm("Архивировать шаблон маршрута?")) {
      return;
    }

    setIsArchiving(true);

    const result = await executeMutation({
      fallbackMessage: "Не удалось архивировать шаблон маршрута",
      request: () =>
        fetch(
          `/v1/route-composer/templates/${encodeURIComponent(template.id)}/archive`,
          {
            method: "POST",
            credentials: "include",
          },
        ),
    });

    setIsArchiving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Шаблон маршрута архивирован");
    await refresh();
  }

  return (
    <RouteTemplateWorkspaceLayout
      backHref="/route-templates"
      title={title}
      actions={
        <>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/route-templates" />}
          >
            К списку
          </Button>
          {!isReadOnly ? (
            <Button
              variant="outline"
              onClick={() => {
                setName(template?.name ?? "");
                setCode(template?.code ?? "");
                setDescription(template?.description ?? "");
                setDealType(template?.dealType ?? "payment");
                setParticipants(initialParticipants);
                setLegs(initialLegs);
                setCostComponents(initialCostComponents);
              }}
              disabled={!isDirty || isSaving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Сбросить
            </Button>
          ) : null}
          {template && template.status !== "archived" ? (
            <Button
              variant="outline"
              onClick={handleArchive}
              disabled={isArchiving}
            >
              <Archive className="mr-2 h-4 w-4" />
              {isArchiving ? "Архивация..." : "Архивировать"}
            </Button>
          ) : null}
          {template?.status === "draft" ? (
            <Button
              variant="outline"
              onClick={handlePublish}
              disabled={isPublishing}
            >
              <Send className="mr-2 h-4 w-4" />
              {isPublishing ? "Публикация..." : "Опубликовать"}
            </Button>
          ) : null}
          {!isReadOnly ? (
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Сохранение..." : template ? "Сохранить" : "Создать"}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-6">
        {!template ? (
          <Alert>
            <Check />
            <AlertTitle>Новый draft template</AlertTitle>
            <AlertDescription>
              Соберите canonical participants, legs и cost defaults. После сохранения
              template можно публиковать и применять к сделкам.
            </AlertDescription>
          </Alert>
        ) : template.status === "draft" ? (
          <Alert>
            <Check />
            <AlertTitle>Шаблон редактируем</AlertTitle>
            <AlertDescription>
              Draft template можно свободно менять, потом опубликовать и использовать
              в route composer.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="warning">
            <AlertCircle />
            <AlertTitle>Шаблон доступен только для чтения</AlertTitle>
            <AlertDescription>
              {template.status === "published"
                ? "Published templates больше не редактируются. При необходимости архивируйте их и создайте новый draft."
                : "Archived templates сохраняются как reference snapshot и не поддерживают дальнейшее редактирование."}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Основные параметры</CardTitle>
                <CardDescription>
                  Template задает reusable route skeleton и economics defaults без
                  привязки к конкретной сделке.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Название</span>
                  <Input
                    value={name}
                    disabled={isReadOnly}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Code</span>
                  <Input
                    value={code}
                    disabled={isReadOnly}
                    onChange={(event) => setCode(event.target.value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Тип сделки</span>
                  <NativeSelect
                    value={dealType}
                    disabled={isReadOnly}
                    onChange={(value) => setDealType(value as FinanceDealType)}
                  >
                    {DEAL_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {getFinanceDealTypeLabel(option)}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Lifecycle</span>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={
                        template
                          ? getRouteTemplateStatusVariant(template.status)
                          : "secondary"
                      }
                    >
                      {template
                        ? getRouteTemplateStatusLabel(template.status)
                        : "Новый черновик"}
                    </Badge>
                    {template ? (
                      <Badge variant="outline">
                        Обновлен {formatDate(template.updatedAt)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium">Описание</span>
                  <Textarea
                    value={description}
                    disabled={isReadOnly}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                  />
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Участники шаблона</CardTitle>
                <CardDescription>
                  Для fixed_party выбирается конкретная сущность. Deal-bound binding’и
                  подтянутся из самой сделки при применении template.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Seq</TableHead>
                        <TableHead className="min-w-28">Code</TableHead>
                        <TableHead className="min-w-36">Role</TableHead>
                        <TableHead className="min-w-52">Binding</TableHead>
                        <TableHead className="min-w-36">Kind</TableHead>
                        <TableHead className="min-w-72">Party</TableHead>
                        <TableHead className="min-w-52">Display label</TableHead>
                        <TableHead className="min-w-40">Requisite</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-muted-foreground h-20 text-center">
                            Участники шаблона еще не добавлены.
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {participants.map((participant, index) => {
                        const isFixedParty = participant.bindingKind === "fixed_party";
                        const enforcedPartyKind = resolvePartyKindForBinding(
                          participant.bindingKind,
                          participant.partyKind,
                        );

                        return (
                          <TableRow key={participant.localId} className="align-top">
                            <TableCell>{participant.sequence}</TableCell>
                            <TableCell>
                              <Input
                                value={participant.code}
                                disabled={isReadOnly}
                                onChange={(event) => {
                                  const next = [...participants];
                                  next[index] = {
                                    ...participant,
                                    code: event.target.value,
                                  };
                                  setParticipants(next);
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={participant.role}
                                disabled={isReadOnly}
                                onChange={(event) => {
                                  const next = [...participants];
                                  next[index] = {
                                    ...participant,
                                    role: event.target.value,
                                  };
                                  setParticipants(next);
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <NativeSelect
                                value={participant.bindingKind}
                                disabled={isReadOnly}
                                onChange={(value) => {
                                  const bindingKind =
                                    value as DealRouteTemplateParticipantInput["bindingKind"];
                                  const next = [...participants];
                                  next[index] = {
                                    ...participant,
                                    bindingKind,
                                    partyId:
                                      bindingKind === "fixed_party"
                                        ? participant.partyId
                                        : null,
                                    partyKind: resolvePartyKindForBinding(
                                      bindingKind,
                                      participant.partyKind,
                                    ),
                                    partyLabel:
                                      bindingKind === "fixed_party"
                                        ? participant.partyLabel
                                        : null,
                                  };
                                  setParticipants(next);
                                }}
                              >
                                {BINDING_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {getRouteTemplateBindingLabel(option)}
                                  </option>
                                ))}
                              </NativeSelect>
                              <p className="text-muted-foreground mt-1 text-xs">
                                {getRouteTemplateBindingHint(participant.bindingKind)}
                              </p>
                            </TableCell>
                            <TableCell>
                              <NativeSelect
                                value={enforcedPartyKind}
                                disabled={isReadOnly || !isFixedParty}
                                onChange={(value) => {
                                  const next = [...participants];
                                  next[index] = {
                                    ...participant,
                                    partyId: null,
                                    partyKind:
                                      value as DealRouteTemplateParticipantInput["partyKind"],
                                    partyLabel: null,
                                  };
                                  setParticipants(next);
                                }}
                              >
                                {partyKindOptions.map((option) => (
                                  <option key={option.kind} value={option.kind}>
                                    {option.label}
                                  </option>
                                ))}
                              </NativeSelect>
                            </TableCell>
                            <TableCell>
                              {isFixedParty ? (
                                <>
                                  <ParticipantLookupCombobox
                                    disabled={isReadOnly}
                                    kind={enforcedPartyKind}
                                    placeholder="Выберите участника"
                                    valueLabel={participant.partyLabel}
                                    onSelect={(item) => {
                                      const next = [...participants];
                                      next[index] = {
                                        ...participant,
                                        displayNameTemplate:
                                          participant.displayNameTemplate ??
                                          item?.displayName ??
                                          null,
                                        partyId: item?.id ?? null,
                                        partyKind: enforcedPartyKind,
                                        partyLabel: item?.displayName ?? null,
                                      };
                                      setParticipants(next);
                                    }}
                                  />
                                  <p className="text-muted-foreground mt-1 truncate text-xs">
                                    {participant.partyLabel ?? "ID: не выбран"}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Будет разрешено из deal input во время применения
                                  шаблона.
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                value={participant.displayNameTemplate ?? ""}
                                disabled={isReadOnly}
                                onChange={(event) => {
                                  const next = [...participants];
                                  next[index] = {
                                    ...participant,
                                    displayNameTemplate: event.target.value || null,
                                  };
                                  setParticipants(next);
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={participant.requisiteId ?? ""}
                                disabled={isReadOnly}
                                placeholder="UUID"
                                onChange={(event) => {
                                  const next = [...participants];
                                  next[index] = {
                                    ...participant,
                                    requisiteId: event.target.value || null,
                                  };
                                  setParticipants(next);
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                disabled={isReadOnly}
                                onClick={() =>
                                  setParticipants(
                                    resequenceParticipants(
                                      participants.filter(
                                        (item) => item.localId !== participant.localId,
                                      ),
                                    ),
                                  )
                                }
                              >
                                Удалить
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {!isReadOnly ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setParticipants(
                        resequenceParticipants([
                          ...participants,
                          createEmptyParticipant(participants.length + 1),
                        ]),
                      )
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить участника
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Этапы маршрута</CardTitle>
                <CardDescription>
                  Legs определяют последовательность treasury execution и corridor
                  between participants.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Idx</TableHead>
                        <TableHead className="min-w-28">Code</TableHead>
                        <TableHead className="min-w-40">Kind</TableHead>
                        <TableHead className="min-w-40">From</TableHead>
                        <TableHead className="min-w-40">To</TableHead>
                        <TableHead className="min-w-32">From CCY</TableHead>
                        <TableHead className="min-w-32">To CCY</TableHead>
                        <TableHead className="min-w-32">From amount</TableHead>
                        <TableHead className="min-w-32">To amount</TableHead>
                        <TableHead className="min-w-28">Rate num</TableHead>
                        <TableHead className="min-w-28">Rate den</TableHead>
                        <TableHead className="min-w-40">Settlement model</TableHead>
                        <TableHead className="min-w-64">Executor</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {legs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={14} className="text-muted-foreground h-20 text-center">
                            Этапы шаблона еще не добавлены.
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {legs.map((leg, index) => (
                        <TableRow key={leg.localId} className="align-top">
                          <TableCell>{leg.idx}</TableCell>
                          <TableCell>
                            <Input
                              value={leg.code}
                              disabled={isReadOnly}
                              onChange={(event) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  code: event.target.value,
                                };
                                setLegs(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={leg.kind}
                              disabled={isReadOnly}
                              onChange={(value) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  kind: value as DealRouteTemplateLegInput["kind"],
                                };
                                setLegs(next);
                              }}
                            >
                              {Object.entries(ROUTE_LEG_KIND_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={leg.fromParticipantCode}
                              disabled={isReadOnly}
                              onChange={(value) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  fromParticipantCode: value,
                                };
                                setLegs(next);
                              }}
                            >
                              <option value="">Выберите</option>
                              {participants.map((participant) => (
                                <option key={participant.localId} value={participant.code}>
                                  {participant.code}
                                </option>
                              ))}
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={leg.toParticipantCode}
                              disabled={isReadOnly}
                              onChange={(value) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  toParticipantCode: value,
                                };
                                setLegs(next);
                              }}
                            >
                              <option value="">Выберите</option>
                              {participants.map((participant) => (
                                <option key={participant.localId} value={participant.code}>
                                  {participant.code}
                                </option>
                              ))}
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={leg.fromCurrencyId}
                              disabled={isReadOnly}
                              onChange={(value) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  fromCurrencyId: value,
                                };
                                setLegs(next);
                              }}
                            >
                              {data.currencies.map((currency) => (
                                <option key={currency.id} value={currency.id}>
                                  {currency.code}
                                </option>
                              ))}
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={leg.toCurrencyId}
                              disabled={isReadOnly}
                              onChange={(value) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  toCurrencyId: value,
                                };
                                setLegs(next);
                              }}
                            >
                              {data.currencies.map((currency) => (
                                <option key={currency.id} value={currency.id}>
                                  {currency.code}
                                </option>
                              ))}
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={leg.expectedFromAmountMinor ?? ""}
                              disabled={isReadOnly}
                              placeholder="minor"
                              onChange={(event) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  expectedFromAmountMinor: event.target.value || null,
                                };
                                setLegs(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={leg.expectedToAmountMinor ?? ""}
                              disabled={isReadOnly}
                              placeholder="minor"
                              onChange={(event) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  expectedToAmountMinor: event.target.value || null,
                                };
                                setLegs(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={leg.expectedRateNum ?? ""}
                              disabled={isReadOnly}
                              onChange={(event) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  expectedRateNum: event.target.value || null,
                                };
                                setLegs(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={leg.expectedRateDen ?? ""}
                              disabled={isReadOnly}
                              onChange={(event) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  expectedRateDen: event.target.value || null,
                                };
                                setLegs(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={leg.settlementModel}
                              disabled={isReadOnly}
                              onChange={(event) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  settlementModel: event.target.value,
                                };
                                setLegs(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <ParticipantLookupCombobox
                              disabled={isReadOnly}
                              kind="counterparty"
                              placeholder="Optional executor"
                              valueLabel={leg.executionCounterpartyLabel}
                              onSelect={(item) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  executionCounterpartyId: item?.id ?? null,
                                  executionCounterpartyLabel: item?.displayName ?? null,
                                };
                                setLegs(next);
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              disabled={isReadOnly}
                              onClick={() =>
                                setLegs(
                                  resequenceLegs(
                                    legs.filter((item) => item.localId !== leg.localId),
                                  ),
                                )
                              }
                            >
                              Удалить
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {!isReadOnly ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setLegs(
                        resequenceLegs([
                          ...legs,
                          createEmptyLeg(legs.length + 1, participants, data.currencies),
                        ]),
                      )
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить этап
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Компоненты экономики</CardTitle>
                <CardDescription>
                  Template хранит revenue/expense/pass-through defaults, которые
                  потом разворачиваются в calculation line provenance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Seq</TableHead>
                        <TableHead className="min-w-28">Code</TableHead>
                        <TableHead className="min-w-32">Family</TableHead>
                        <TableHead className="min-w-32">Class</TableHead>
                        <TableHead className="min-w-32">Formula</TableHead>
                        <TableHead className="min-w-40">Basis</TableHead>
                        <TableHead className="min-w-28">Currency</TableHead>
                        <TableHead className="min-w-32">Leg</TableHead>
                        <TableHead className="min-w-28">Fixed</TableHead>
                        <TableHead className="min-w-24">Bps</TableHead>
                        <TableHead className="min-w-24">Per MM</TableHead>
                        <TableHead className="min-w-28">Manual</TableHead>
                        <TableHead className="min-w-20">Rate</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costComponents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={14} className="text-muted-foreground h-20 text-center">
                            Компоненты экономики еще не добавлены.
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {costComponents.map((component, index) => (
                        <TableRow key={component.localId} className="align-top">
                          <TableCell>{component.sequence}</TableCell>
                          <TableCell>
                            <Input
                              value={component.code}
                              disabled={isReadOnly}
                              onChange={(event) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  code: event.target.value,
                                };
                                setCostComponents(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={component.family}
                              disabled={isReadOnly}
                              onChange={(event) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  family: event.target.value,
                                };
                                setCostComponents(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={component.classification}
                              disabled={isReadOnly}
                              onChange={(value) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  classification:
                                    value as DealRouteTemplateCostComponentInput["classification"],
                                };
                                setCostComponents(next);
                              }}
                            >
                              {Object.entries(ROUTE_COMPONENT_CLASSIFICATION_LABELS).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={component.formulaType}
                              disabled={isReadOnly}
                              onChange={(value) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  formulaType:
                                    value as DealRouteTemplateCostComponentInput["formulaType"],
                                };
                                setCostComponents(next);
                              }}
                            >
                              {Object.entries(ROUTE_COMPONENT_FORMULA_LABELS).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={component.basisType}
                              disabled={isReadOnly}
                              onChange={(value) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  basisType:
                                    value as DealRouteTemplateCostComponentInput["basisType"],
                                };
                                setCostComponents(next);
                              }}
                            >
                              {Object.entries(ROUTE_COMPONENT_BASIS_LABELS).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={component.currencyId}
                              disabled={isReadOnly}
                              onChange={(value) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  currencyId: value,
                                };
                                setCostComponents(next);
                              }}
                            >
                              {data.currencies.map((currency) => (
                                <option key={currency.id} value={currency.id}>
                                  {currency.code}
                                </option>
                              ))}
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={component.legCode ?? ""}
                              disabled={isReadOnly}
                              onChange={(value) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  legCode: value || null,
                                };
                                setCostComponents(next);
                              }}
                            >
                              <option value="">Без leg</option>
                              {legs.map((leg) => (
                                <option key={leg.localId} value={leg.code}>
                                  {leg.code}
                                </option>
                              ))}
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={component.fixedAmountMinor ?? ""}
                              disabled={isReadOnly}
                              onChange={(event) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  fixedAmountMinor: event.target.value || null,
                                };
                                setCostComponents(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={component.bps ?? ""}
                              disabled={isReadOnly}
                              onChange={(event) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  bps: event.target.value || null,
                                };
                                setCostComponents(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={component.perMillion ?? ""}
                              disabled={isReadOnly}
                              onChange={(event) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  perMillion: event.target.value || null,
                                };
                                setCostComponents(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={component.manualAmountMinor ?? ""}
                              disabled={isReadOnly}
                              onChange={(event) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  manualAmountMinor: event.target.value || null,
                                };
                                setCostComponents(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center pt-2">
                              <Checkbox
                                checked={component.includedInClientRate}
                                disabled={isReadOnly}
                                onCheckedChange={(checked) => {
                                  const next = [...costComponents];
                                  next[index] = {
                                    ...component,
                                    includedInClientRate: checked === true,
                                  };
                                  setCostComponents(next);
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              disabled={isReadOnly}
                              onClick={() =>
                                setCostComponents(
                                  resequenceCostComponents(
                                    costComponents.filter(
                                      (item) => item.localId !== component.localId,
                                    ),
                                  ),
                                )
                              }
                            >
                              Удалить
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {!isReadOnly ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setCostComponents(
                        resequenceCostComponents([
                          ...costComponents,
                          createEmptyCostComponent(
                            costComponents.length + 1,
                            legs,
                            data.currencies,
                          ),
                        ]),
                      )
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить компонент
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <RouteTemplateSummarySidebar
            costComponents={costComponents}
            dealType={dealType}
            isDirty={isDirty}
            legs={legs}
            participants={participants}
            status={status}
            updatedAt={template?.updatedAt ?? null}
          />
        </div>
      </div>
    </RouteTemplateWorkspaceLayout>
  );
}
