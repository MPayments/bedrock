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
  Calculator,
  Check,
  Plus,
  RotateCcw,
  Save,
  Workflow,
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
  DealRouteCostComponentInput,
  DealRouteLegInput,
  DealRouteParticipantInput,
} from "@bedrock/deals/contracts";
import { NativeSelect } from "@/features/treasury/ui/native-select";
import { ParticipantLookupCombobox } from "@/features/treasury/ui/participant-lookup-combobox";
import type { FinanceRouteComposerData } from "@/features/treasury/deals/lib/queries";
import {
  getFinanceDealDisplayTitle,
  getFinanceDealStatusLabel,
  getFinanceDealTypeLabel,
} from "@/features/treasury/deals/labels";
import { FinanceDealWorkspaceLayout } from "@/features/treasury/deals/components/workspace-layout";
import { executeMutation } from "@/lib/resources/http";
import { formatMinorAmountWithCurrency } from "@/lib/format";

type RouteComposerWorkspaceProps = {
  data: FinanceRouteComposerData;
};

type CurrencyOption = FinanceRouteComposerData["currencies"][number];
type ProfitabilityBucket = NonNullable<
  FinanceRouteComposerData["workspace"]["profitabilitySnapshot"]
>["feeRevenue"];

type LocalParticipant = DealRouteParticipantInput & {
  localId: string;
  partyLabel: string | null;
};

type LocalLeg = DealRouteLegInput & {
  localId: string;
  executionCounterpartyLabel: string | null;
};

type LocalCostComponent = DealRouteCostComponentInput & {
  localId: string;
};

type PartyKindOption = {
  description: string;
  kind: DealRouteParticipantInput["partyKind"];
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

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toLocalParticipants(
  route: FinanceRouteComposerData["route"],
): LocalParticipant[] {
  if (!route) {
    return [];
  }

  return route.participants.map((participant) => ({
    code: participant.code,
    displayNameSnapshot: participant.displayNameSnapshot,
    localId: participant.id,
    metadata: participant.metadata,
    partyId: participant.partyId,
    partyKind: participant.partyKind,
    partyLabel: participant.displayNameSnapshot,
    requisiteId: participant.requisiteId,
    role: participant.role,
    sequence: participant.sequence,
  }));
}

function toLocalLegs(route: FinanceRouteComposerData["route"]): LocalLeg[] {
  if (!route) {
    return [];
  }

  return route.legs.map((leg) => ({
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
  route: FinanceRouteComposerData["route"],
): LocalCostComponent[] {
  if (!route) {
    return [];
  }

  return route.costComponents.map((component) => ({
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
    code: `p${sequence}`,
    displayNameSnapshot: null,
    localId: createLocalId("participant"),
    metadata: {},
    partyId: "00000000-0000-4000-8000-000000000000",
    partyKind: "counterparty",
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
  const firstCurrencyId = currencies[0]?.id ?? "00000000-0000-4000-8000-000000000000";

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
    localId: createLocalId("leg"),
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
    currencyId: currencies[0]?.id ?? "00000000-0000-4000-8000-000000000000",
    family: "provider_fee",
    fixedAmountMinor: null,
    formulaType: "fixed",
    includedInClientRate: false,
    legCode: legs[0]?.code ?? null,
    localId: createLocalId("cost"),
    manualAmountMinor: null,
    notes: null,
    perMillion: null,
    roundingMode: "half_up",
    sequence,
  };
}

function buildRoutePayload(input: {
  costComponents: LocalCostComponent[];
  legs: LocalLeg[];
  participants: LocalParticipant[];
}) {
  return {
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
    participants: input.participants.map((item) => ({
      code: item.code.trim(),
      displayNameSnapshot: normalizeNullableText(
        item.displayNameSnapshot ?? item.partyLabel,
      ),
      metadata: item.metadata,
      partyId: item.partyId,
      partyKind: item.partyKind,
      requisiteId: normalizeNullableText(item.requisiteId),
      role: item.role.trim(),
      sequence: item.sequence,
    })),
  } satisfies {
    costComponents: DealRouteCostComponentInput[];
    legs: DealRouteLegInput[];
    participants: DealRouteParticipantInput[];
  };
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function formatProfitabilityBucket(
  items: ProfitabilityBucket | null | undefined,
) {
  if (!items || items.length === 0) {
    return "—";
  }

  return items
    .map((item) => formatMinorAmountWithCurrency(item.amountMinor, item.currencyCode))
    .join(" · ");
}

function buildPartyKindOptions(
  lookupContext: FinanceRouteComposerData["lookupContext"],
): PartyKindOption[] {
  return lookupContext.participantKinds
    .filter(
      (item): item is typeof item & {
        kind: DealRouteParticipantInput["partyKind"];
      } =>
        item.kind === "customer" ||
        item.kind === "counterparty" ||
        item.kind === "organization",
    )
    .map((item) => ({
      description: item.description,
      kind: item.kind,
      label: item.label,
    }));
}

function ValidationBanner({
  issues,
}: {
  issues: NonNullable<FinanceRouteComposerData["route"]>["validationIssues"];
}) {
  if (issues.length === 0) {
    return (
      <Alert>
        <Check />
        <AlertTitle>Маршрут валиден</AlertTitle>
        <AlertDescription>
          Текущая версия не содержит route validation issues.
        </AlertDescription>
      </Alert>
    );
  }

  const hasErrors = issues.some((issue) => issue.severity === "error");

  return (
    <Alert variant={hasErrors ? "destructive" : "warning"}>
      <AlertCircle />
      <AlertTitle>
        {hasErrors ? "Маршрут требует исправления" : "Есть предупреждения"}
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-1">
          {issues.map((issue) => (
            <p key={`${issue.code}:${issue.path ?? "root"}`}>
              {issue.code}: {issue.message}
              {issue.path ? ` (${issue.path})` : ""}
            </p>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function RouteSummarySidebar({
  data,
  isDirty,
}: {
  data: FinanceRouteComposerData;
  isDirty: boolean;
}) {
  const snapshot = data.workspace.profitabilitySnapshot;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Сводка маршрута</CardTitle>
          <CardDescription>
            Финансовая сводка берется из последнего calculation/profitability snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Тип сделки</span>
            <span className="font-medium">
              {getFinanceDealTypeLabel(data.workspace.summary.type)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Статус сделки</span>
            <span className="font-medium">
              {getFinanceDealStatusLabel(data.workspace.summary.status)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Версия маршрута</span>
            <span className="font-medium">
              {data.route ? `v${data.route.version}` : "Черновик не создан"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Несохраненные изменения</span>
            <span className="font-medium">{isDirty ? "Да" : "Нет"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Расчет</span>
            <span className="font-medium">
              {snapshot ? snapshot.calculationId.slice(0, 8) : "Не создан"}
            </span>
          </div>
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Комиссионный доход</span>
              <span className="font-medium">
                {formatProfitabilityBucket(snapshot?.feeRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Доход от спреда</span>
              <span className="font-medium">
                {formatProfitabilityBucket(snapshot?.spreadRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Расход провайдера</span>
              <span className="font-medium">
                {formatProfitabilityBucket(snapshot?.providerFeeExpense)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Итого revenue</span>
              <span className="font-medium">
                {formatProfitabilityBucket(snapshot?.totalRevenue)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {snapshot ? null : (
        <Alert variant="warning">
          <AlertCircle />
          <AlertTitle>Нет расчетной экономики</AlertTitle>
          <AlertDescription>
            После сохранения маршрута создайте calculation from route, чтобы увидеть
            ожидаемые revenue/cost buckets без вычислений в UI.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function RouteComposerWorkspace({ data }: RouteComposerWorkspaceProps) {
  const router = useRouter();
  const partyKindOptions = useMemo(
    () => buildPartyKindOptions(data.lookupContext),
    [data.lookupContext],
  );
  const initialParticipants = useMemo(
    () => toLocalParticipants(data.route),
    [data.route],
  );
  const initialLegs = useMemo(() => toLocalLegs(data.route), [data.route]);
  const initialCostComponents = useMemo(
    () => toLocalCostComponents(data.route),
    [data.route],
  );
  const [participants, setParticipants] = useState(initialParticipants);
  const [legs, setLegs] = useState(initialLegs);
  const [costComponents, setCostComponents] = useState(initialCostComponents);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    data.templates[0]?.id ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isCreatingCalculation, setIsCreatingCalculation] = useState(false);
  const title = getFinanceDealDisplayTitle({
    applicantDisplayName: data.workspace.summary.applicantDisplayName,
    id: data.workspace.summary.id,
    type: data.workspace.summary.type,
  });

  const initialSignature = useMemo(
    () =>
      JSON.stringify(
        buildRoutePayload({
          costComponents: initialCostComponents,
          legs: initialLegs,
          participants: initialParticipants,
        }),
      ),
    [initialCostComponents, initialLegs, initialParticipants],
  );
  const currentSignature = useMemo(
    () =>
      JSON.stringify(
        buildRoutePayload({
          costComponents,
          legs,
          participants,
        }),
      ),
    [costComponents, legs, participants],
  );
  const isDirty = currentSignature !== initialSignature;
  const templateOptions = data.templates.filter(
    (item) => item.dealType === data.workspace.summary.type,
  );

  useEffect(() => {
    setParticipants(initialParticipants);
    setLegs(initialLegs);
    setCostComponents(initialCostComponents);
  }, [initialCostComponents, initialLegs, initialParticipants]);

  useEffect(() => {
    if (!selectedTemplateId && templateOptions[0]?.id) {
      setSelectedTemplateId(templateOptions[0].id);
    }
  }, [selectedTemplateId, templateOptions]);

  async function refresh() {
    router.refresh();
  }

  async function handleCreateDraft() {
    setIsCreatingDraft(true);

    const result = await executeMutation({
      fallbackMessage: "Не удалось создать черновик маршрута",
      request: () =>
        fetch(`/v1/deals/${encodeURIComponent(data.workspace.summary.id)}/route/draft`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
    });

    setIsCreatingDraft(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Черновик маршрута создан");
    await refresh();
  }

  async function handleSave() {
    setIsSaving(true);

    const payload = buildRoutePayload({
      costComponents,
      legs,
      participants,
    });

    const save = async () =>
      fetch(`/v1/deals/${encodeURIComponent(data.workspace.summary.id)}/route`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

    const result = data.route
      ? await executeMutation({
          fallbackMessage: "Не удалось сохранить маршрут",
          request: save,
        })
      : await executeMutation({
          fallbackMessage: "Не удалось создать черновик маршрута",
          request: () =>
            fetch(
              `/v1/deals/${encodeURIComponent(data.workspace.summary.id)}/route/draft`,
              {
                method: "POST",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
              },
            ),
        });

    if (!result.ok) {
      setIsSaving(false);
      toast.error(result.message);
      return;
    }

    if (!data.route) {
      const secondResult = await executeMutation({
        fallbackMessage: "Не удалось сохранить маршрут",
        request: save,
      });

      setIsSaving(false);

      if (!secondResult.ok) {
        toast.error(secondResult.message);
        return;
      }
    } else {
      setIsSaving(false);
    }

    toast.success("Маршрут сохранен");
    await refresh();
  }

  async function handleApplyTemplate() {
    if (!selectedTemplateId) {
      toast.error("Выберите шаблон маршрута");
      return;
    }

    if (isDirty && !window.confirm("Локальные несохраненные изменения будут потеряны. Продолжить?")) {
      return;
    }

    setIsApplyingTemplate(true);

    const result = await executeMutation({
      fallbackMessage: "Не удалось применить шаблон маршрута",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(data.workspace.summary.id)}/route/apply-template`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              templateId: selectedTemplateId,
            }),
          },
        ),
    });

    setIsApplyingTemplate(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Шаблон маршрута применен");
    await refresh();
  }

  async function handleCreateCalculation() {
    setIsCreatingCalculation(true);

    const result = await executeMutation({
      fallbackMessage: "Не удалось создать расчет по маршруту",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(data.workspace.summary.id)}/calculations/from-route`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createIdempotencyKey(),
            },
            body: JSON.stringify({}),
          },
        ),
    });

    setIsCreatingCalculation(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Расчет по маршруту создан");
    await refresh();
  }

  const validationIssues = data.route?.validationIssues ?? [];

  return (
    <FinanceDealWorkspaceLayout
      backHref={`/treasury/deals/${data.workspace.summary.id}`}
      title={title}
      actions={
        <>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/treasury/deals/${data.workspace.summary.id}`} />}
          >
            <Workflow className="mr-2 h-4 w-4" />
            Рабочий стол
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/route-templates" />}
          >
            Шаблоны
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href={`/treasury/deals/${data.workspace.summary.id}/calculation`} />
            }
          >
            <Calculator className="mr-2 h-4 w-4" />
            Расчет
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setParticipants(initialParticipants);
              setLegs(initialLegs);
              setCostComponents(initialCostComponents);
            }}
            disabled={!isDirty || isSaving}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Сбросить
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Сохранение..." : "Сохранить маршрут"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {data.route ? (
          <ValidationBanner issues={validationIssues} />
        ) : (
          <Alert variant="warning">
            <AlertCircle />
            <AlertTitle>Маршрут еще не создан</AlertTitle>
            <AlertDescription>
              Можно создать пустой draft, собрать маршрут вручную или применить опубликованный template.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Контекст сделки</CardTitle>
                <CardDescription>
                  Deal root остается коммерческим источником истины, а этот экран
                  управляет treasury route snapshot.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {getFinanceDealTypeLabel(data.workspace.summary.type)}
                </Badge>
                <Badge variant="outline">
                  {getFinanceDealStatusLabel(data.workspace.summary.status)}
                </Badge>
                <Badge variant="outline">
                  Клиент: {data.workspace.summary.applicantDisplayName ?? "—"}
                </Badge>
                <Badge variant="outline">
                  Agreement: {data.deal.agreementId.slice(0, 8)}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Шаблон маршрута</CardTitle>
                <CardDescription>
                  Публикуемые templates остаются основным способом быстро собрать
                  сложный multi-leg route без graph editor.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 md:flex-row">
                <div className="min-w-0 flex-1">
                  <NativeSelect
                    value={selectedTemplateId}
                    onChange={setSelectedTemplateId}
                  >
                    <option value="">Выберите шаблон</option>
                    {templateOptions.map((template) => (
                    <option key={template.id} value={template.id}>
                        {template.name}
                    </option>
                  ))}
                  </NativeSelect>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCreateDraft}
                    disabled={isCreatingDraft}
                  >
                    {isCreatingDraft ? "Создание..." : "Создать пустой draft"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleApplyTemplate}
                    disabled={isApplyingTemplate || !selectedTemplateId}
                  >
                    {isApplyingTemplate ? "Применение..." : "Применить template"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCreateCalculation}
                    disabled={isCreatingCalculation}
                  >
                    <Calculator className="mr-2 h-4 w-4" />
                    {isCreatingCalculation ? "Создание..." : "Создать calculation"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Участники маршрута</CardTitle>
                <CardDescription>
                  Выбирайте customer / organization / counterparty по typed lookup из
                  finance route composer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Seq</TableHead>
                        <TableHead className="min-w-32">Code</TableHead>
                        <TableHead className="min-w-40">Role</TableHead>
                        <TableHead className="min-w-40">Kind</TableHead>
                        <TableHead className="min-w-72">Party</TableHead>
                        <TableHead className="min-w-40">Requisite</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-muted-foreground h-20 text-center">
                            Участники еще не добавлены.
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {participants.map((participant, index) => {
                        const kindLabel =
                          partyKindOptions.find((item) => item.kind === participant.partyKind)
                            ?.label ?? participant.partyKind;

                        return (
                          <TableRow key={participant.localId} className="align-top">
                            <TableCell>{participant.sequence}</TableCell>
                            <TableCell>
                              <Input
                                value={participant.code}
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
                                value={participant.partyKind}
                                onChange={(value) => {
                                  const next = [...participants];
                                  next[index] = {
                                    ...participant,
                                    partyId: "00000000-0000-4000-8000-000000000000",
                                    partyKind:
                                      value as DealRouteParticipantInput["partyKind"],
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
                              <p className="text-muted-foreground mt-1 text-xs">
                                {kindLabel}
                              </p>
                            </TableCell>
                            <TableCell>
                              <ParticipantLookupCombobox
                                kind={participant.partyKind}
                                placeholder="Выберите участника"
                                valueLabel={participant.partyLabel}
                                onSelect={(item) => {
                                  const next = [...participants];
                                  next[index] = {
                                    ...participant,
                                    displayNameSnapshot: item?.displayName ?? null,
                                    partyId:
                                      item?.id ??
                                      "00000000-0000-4000-8000-000000000000",
                                    partyLabel: item?.displayName ?? null,
                                  };
                                  setParticipants(next);
                                }}
                              />
                              <p className="text-muted-foreground mt-1 truncate text-xs">
                                {participant.partyLabel ?? "ID: не выбран"}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={participant.requisiteId ?? ""}
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
                                onClick={() =>
                                  setParticipants(
                                    resequenceParticipants(
                                      participants.filter((item) => item.localId !== participant.localId),
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Этапы маршрута</CardTitle>
                <CardDescription>
                  Legs описывают порядок движения денег и FX across participants.
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
                            Этапы еще не добавлены.
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {legs.map((leg, index) => (
                        <TableRow key={leg.localId} className="align-top">
                          <TableCell>{leg.idx}</TableCell>
                          <TableCell>
                            <Input
                              value={leg.code}
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
                              onChange={(value) => {
                                const next = [...legs];
                                next[index] = {
                                  ...leg,
                                  kind: value as DealRouteLegInput["kind"],
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
                            <p className="text-muted-foreground mt-1 truncate text-xs">
                              {leg.executionCounterpartyId
                                ? `${leg.executionCounterpartyLabel ?? "ID"} · ${leg.executionCounterpartyId.slice(0, 8)}`
                                : "Не выбран"}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Компоненты экономики</CardTitle>
                <CardDescription>
                  Здесь задается full route economics breakdown: revenue, expense и pass-through lines.
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
                              onChange={(value) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  classification:
                                    value as DealRouteCostComponentInput["classification"],
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
                              onChange={(value) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  formulaType:
                                    value as DealRouteCostComponentInput["formulaType"],
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
                              onChange={(value) => {
                                const next = [...costComponents];
                                next[index] = {
                                  ...component,
                                  basisType:
                                    value as DealRouteCostComponentInput["basisType"],
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
              </CardContent>
            </Card>
          </div>

          <RouteSummarySidebar data={data} isDirty={isDirty} />
        </div>
      </div>
    </FinanceDealWorkspaceLayout>
  );
}
