"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  ArrowUpRight,
  Building2,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import { toMinorAmountString } from "@bedrock/shared/money";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@bedrock/sdk-ui/components/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@bedrock/sdk-ui/components/input-group";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@bedrock/sdk-ui/components/select";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import { cn } from "@bedrock/sdk-ui/lib/utils";

import { apiClient } from "@/lib/api-client";
import { formatMajorAmount } from "@/lib/format";
import { executeMutation } from "@/lib/resources/http";

import { getTreasuryAccountDisplayLabel } from "../lib/display";
import {
  getAllowedDestinationAccounts,
  getAllowedDestinationRuleSummary,
  getSourceAccountFieldLabel,
  getTreasuryFlowDescriptor,
  requiresDestinationAccount,
  type TreasuryOperationFlowKind,
} from "../lib/flows";
import type { TreasuryAccountListItem } from "../lib/queries";

type LegalBasis =
  | "loan"
  | "settlement"
  | "recharge"
  | "capital_contribution"
  | "dividend"
  | "other";

type OrganizationOption = {
  id: string;
  label: string;
};

type CreatedOperation = {
  id: string;
};

type TreasuryOperationCreateFormProps = {
  accounts: TreasuryAccountListItem[];
  assetLabels: Record<string, string>;
  formId?: string;
  organizationLabels: Record<string, string>;
  organizations: OrganizationOption[];
};

const UNSELECTED_VALUE = "__unselected__";

const LEGAL_BASIS_LABELS: Record<LegalBasis, string> = {
  loan: "Заем",
  settlement: "Взаиморасчеты",
  recharge: "Перевыставление",
  capital_contribution: "Вклад в капитал",
  dividend: "Дивиденды",
  other: "Другое",
};

const OPERATION_TYPE_ROWS: TreasuryOperationFlowKind[][] = [
  ["payout", "collection", "intracompany_transfer"],
  ["intercompany_funding", "sweep"],
  ["return", "adjustment"],
];

const FLOW_ICONS: Record<
  TreasuryOperationFlowKind,
  React.ComponentType<{ className?: string }>
> = {
  payout: ArrowUpRight,
  collection: ArrowDownLeft,
  intracompany_transfer: ArrowRightLeft,
  intercompany_funding: Building2,
  sweep: ArrowLeftRight,
  return: RotateCcw,
  adjustment: SlidersHorizontal,
};

function buildAccountLabel(input: {
  account: TreasuryAccountListItem;
  assetLabels: Record<string, string>;
  organizationLabels: Record<string, string>;
}) {
  const assetLabel =
    input.assetLabels[input.account.assetId] ?? input.account.assetId;
  const ownerLabel =
    input.organizationLabels[input.account.ownerEntityId] ??
    input.account.ownerEntityId;

  return `${getTreasuryAccountDisplayLabel(input.account)} · ${ownerLabel} · ${assetLabel}`;
}

function renderSelectText(input: {
  className?: string;
  placeholder: string;
  value: string | null;
}) {
  return (
    <span
      className={cn(
        "truncate text-left",
        input.value ? "text-foreground" : "text-muted-foreground",
        input.className,
      )}
    >
      {input.value ?? input.placeholder}
    </span>
  );
}

function resolveAmountValidationMessage(message: string) {
  if (message === "amount must be positive") {
    return "Введите корректную положительную сумму";
  }

  if (message === "amount must be a number, e.g. 1000.50") {
    return "Введите сумму в формате 1000,50";
  }

  if (message.startsWith("amount has too many fraction digits")) {
    return "Слишком много знаков после запятой для выбранной валюты";
  }

  return message;
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="max-w-[60%] text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-background/70 rounded-xl border px-3 py-2.5">
      <div className="text-muted-foreground mb-1 text-[11px] uppercase tracking-[0.08em]">
        {label}
      </div>
      <div className="min-h-5 text-sm font-medium">{value}</div>
    </div>
  );
}

function OperationTypeButton({
  active,
  onClick,
  kind,
}: {
  active: boolean;
  onClick: () => void;
  kind: TreasuryOperationFlowKind;
}) {
  const descriptor = getTreasuryFlowDescriptor(kind);
  const Icon = FLOW_ICONS[kind];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-3 text-left transition-colors",
        active
          ? "border-foreground/20 bg-foreground text-background"
          : "border-border bg-muted/30 hover:border-foreground/15 hover:bg-muted/60",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
            active ? "bg-background/15" : "bg-background",
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-semibold">{descriptor.title}</div>
          <div
            className={cn(
              "text-xs leading-4",
              active ? "text-background/75" : "text-muted-foreground",
            )}
          >
            {descriptor.shortDescription}
          </div>
        </div>
      </div>
    </button>
  );
}

function TreasuryOperationScenarioSection({
  kind,
  onSelect,
}: {
  kind: TreasuryOperationFlowKind;
  onSelect: (kind: TreasuryOperationFlowKind) => void;
}) {
  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>Сценарий операции</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        {OPERATION_TYPE_ROWS.map((row) => (
          <div
            key={row.join("-")}
            className={cn(
              "grid gap-2",
              row.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2",
            )}
          >
            {row.map((kindValue) => (
              <OperationTypeButton
                key={kindValue}
                active={kind === kindValue}
                onClick={() => onSelect(kindValue)}
                kind={kindValue}
              />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TreasuryOperationRouteSection(input: {
  accountLabelById: Record<string, string>;
  accounts: TreasuryAccountListItem[];
  amountMajor: string;
  currentAssetLabel: string | null;
  destinationAccount: TreasuryAccountListItem | null;
  destinationAccountId: string | null;
  destinationOptions: TreasuryAccountListItem[];
  kind: TreasuryOperationFlowKind;
  legalBasis: LegalBasis;
  onAmountChange: (value: string) => void;
  onDestinationAccountChange: (value: string | null) => void;
  onLegalBasisChange: (value: LegalBasis) => void;
  onSourceAccountChange: (value: string | null) => void;
  sourceAccount: TreasuryAccountListItem | null;
  sourceAccountId: string | null;
  submitting: boolean;
}) {
  const amountPreview =
    input.amountMajor.trim().length > 0
      ? formatMajorAmount(input.amountMajor.replace(",", "."))
      : null;

  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>Маршрут денег</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div
          className={cn(
            "grid gap-4",
            requiresDestinationAccount(input.kind)
              ? "2xl:grid-cols-[1.2fr_1.2fr_0.8fr]"
              : "xl:grid-cols-[1.8fr_0.8fr]",
          )}
        >
          <div className="space-y-2">
            <Label>{getSourceAccountFieldLabel(input.kind)}</Label>
            <Select
              value={input.sourceAccountId ?? UNSELECTED_VALUE}
              onValueChange={(value) =>
                input.onSourceAccountChange(
                  value === UNSELECTED_VALUE ? null : value,
                )
              }
            >
              <SelectTrigger className="w-full" disabled={input.submitting}>
                {renderSelectText({
                  placeholder: "Выберите счет казначейства",
                  value: input.sourceAccount
                    ? (input.accountLabelById[input.sourceAccount.id] ??
                      input.sourceAccount.id)
                    : null,
                })}
              </SelectTrigger>
              <SelectContent>
                <SelectItem disabled value={UNSELECTED_VALUE}>
                  Выберите счет казначейства
                </SelectItem>
                {input.accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {input.accountLabelById[account.id] ?? account.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresDestinationAccount(input.kind) ? (
            <div className="space-y-2">
              <Label>Счет назначения</Label>
              <Select
                value={input.destinationAccountId ?? UNSELECTED_VALUE}
                onValueChange={(value) =>
                  input.onDestinationAccountChange(
                    value === UNSELECTED_VALUE ? null : value,
                  )
                }
              >
                <SelectTrigger className="w-full" disabled={input.submitting}>
                  {renderSelectText({
                    placeholder: "Выберите счет назначения",
                    value: input.destinationAccount
                      ? (input.accountLabelById[input.destinationAccount.id] ??
                        input.destinationAccount.id)
                      : null,
                  })}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem disabled value={UNSELECTED_VALUE}>
                    Выберите счет назначения
                  </SelectItem>
                  {input.destinationOptions.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {input.accountLabelById[account.id] ?? account.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {input.sourceAccount ? (
                <div className="text-muted-foreground text-xs leading-5">
                  {getAllowedDestinationRuleSummary(input.kind)} Доступны только
                  счета в валюте{" "}
                  <span className="text-foreground font-medium">
                    {input.currentAssetLabel ?? input.sourceAccount.assetId}
                  </span>
                  . Если нужен обмен валюты, используйте отдельный FX-документ.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Сумма</Label>
            <InputGroup>
              <InputGroupInput
                value={input.amountMajor}
                onChange={(event) => input.onAmountChange(event.target.value)}
                disabled={input.submitting}
                inputMode="decimal"
                placeholder="1000,00"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>
                  {input.currentAssetLabel ?? "—"}
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Основные единицы</span>
              <span>
                {amountPreview
                  ? `${amountPreview}${input.currentAssetLabel ? ` ${input.currentAssetLabel}` : ""}`
                  : (input.currentAssetLabel ?? "—")}
              </span>
            </div>
          </div>
        </div>

        {input.kind === "intercompany_funding" ? (
          <div className="space-y-2">
            <Label>Юридическое основание</Label>
            <Select
              value={input.legalBasis}
              onValueChange={(value) =>
                input.onLegalBasisChange(value as LegalBasis)
              }
            >
              <SelectTrigger className="w-full" disabled={input.submitting}>
                {renderSelectText({
                  placeholder: "Выберите основание",
                  value: LEGAL_BASIS_LABELS[input.legalBasis],
                })}
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LEGAL_BASIS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TreasuryOperationCommentSection({
  kind,
  memo,
  onMemoChange,
  submitting,
}: {
  kind: TreasuryOperationFlowKind;
  memo: string;
  onMemoChange: (value: string) => void;
  submitting: boolean;
}) {
  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>Комментарий для следующего оператора</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2">
          <Label htmlFor="treasury-operation-memo">Комментарий</Label>
          <Textarea
            id="treasury-operation-memo"
            value={memo}
            onChange={(event) => onMemoChange(event.target.value)}
            disabled={submitting}
            rows={kind === "intercompany_funding" ? 3 : 4}
            placeholder="Коротко: зачем создается операция и что должен понять следующий оператор"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function TreasuryOperationSummaryPanel(input: {
  amountMajor: string;
  currentAssetLabel: string | null;
  destinationAccount: TreasuryAccountListItem | null;
  destinationLabel: string;
  kind: TreasuryOperationFlowKind;
  legalBasis: LegalBasis;
  selectedAccountsRequireFx: boolean;
  selectedFlowTitle: string;
  sourceAccount: TreasuryAccountListItem | null;
  sourceLabel: string;
}) {
  const amountPreview =
    input.amountMajor.trim().length > 0
      ? formatMajorAmount(input.amountMajor.replace(",", "."))
      : null;
  const selectedFlow = getTreasuryFlowDescriptor(input.kind);

  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>Сводка и правила</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <SummaryCard
            label="Сценарий"
            value={
              <div className="space-y-1">
                <div>{input.selectedFlowTitle}</div>
                {input.kind === "intercompany_funding" ? (
                  <div className="text-muted-foreground text-xs">
                    {LEGAL_BASIS_LABELS[input.legalBasis]}
                  </div>
                ) : null}
              </div>
            }
          />
          <SummaryCard
            label={selectedFlow.sourceLabel}
            value={input.sourceAccount ? input.sourceLabel : "Не выбран"}
          />
          <SummaryCard
            label={selectedFlow.destinationLabel}
            value={
              requiresDestinationAccount(input.kind)
                ? input.destinationAccount
                  ? input.destinationLabel
                  : "Нужно выбрать"
                : "Не требуется"
            }
          />
          <SummaryCard
            label="Сумма"
            value={
              amountPreview
                ? `${amountPreview}${input.currentAssetLabel ? ` ${input.currentAssetLabel}` : ""}`
                : "Не задана"
            }
          />
          <SummaryCard
            label="FX"
            value={
              input.selectedAccountsRequireFx ? (
                <span className="text-destructive">Нужен FX-документ</span>
              ) : (
                "Конверсии нет"
              )
            }
          />
        </div>

        <div className="rounded-xl border bg-background/70 px-3 py-3">
          <div className="text-sm font-medium">Правила маршрута</div>
          <div className="text-muted-foreground mt-2 space-y-2 text-sm leading-6">
            <p>{selectedFlow.sourceRule}</p>
            <p>{selectedFlow.destinationRule}</p>
            <p>{selectedFlow.amountRule}</p>
          </div>
        </div>

        <div className="rounded-xl border border-dashed px-3 py-3">
          <div className="text-sm font-medium">Если нужна смена валюты</div>
          <div className="text-muted-foreground mt-1 text-sm leading-6">
            Обычная казначейская операция не меняет актив. Для любого обмена валюты
            используйте отдельный FX-документ.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TreasuryOperationRolesPanel(input: {
  derivedEconomicOwnerEntityId: string | null;
  derivedExecutingEntityId: string | null;
  economicOwnerEntityId: string | null;
  effectiveEconomicOwnerEntityId: string | null;
  effectiveExecutingEntityId: string | null;
  executingEntityId: string | null;
  kind: TreasuryOperationFlowKind;
  onEconomicOwnerChange: (value: string | null) => void;
  onExecutingEntityChange: (value: string | null) => void;
  onOwnershipOverridesOpenChange: (value: boolean) => void;
  organizationLabelById: Record<string, string>;
  organizations: OrganizationOption[];
  ownershipOverridesOpen: boolean;
  sourceAccount: TreasuryAccountListItem | null;
}) {
  const selectedFlow = getTreasuryFlowDescriptor(input.kind);

  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Роли и контроль</CardTitle>
            <CardDescription>
              Кто платит, кто исполняет и кто несет экономический смысл. Эти
              роли считаются из маршрута операции, но их можно переопределить.
            </CardDescription>
          </div>
          <Badge variant="outline">
            {input.sourceAccount
              ? (input.organizationLabelById[
                  input.sourceAccount.ownerEntityId
                ] ?? input.sourceAccount.ownerEntityId)
              : "Держатель счета не выбран"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <dl className="space-y-3">
          <SummaryRow
            label="Экономический владелец"
            value={
              input.effectiveEconomicOwnerEntityId
                ? (input.organizationLabelById[
                    input.effectiveEconomicOwnerEntityId
                  ] ?? input.effectiveEconomicOwnerEntityId)
                : "Не определен"
            }
          />
          <SummaryRow
            label="Исполняющая организация"
            value={
              input.effectiveExecutingEntityId
                ? (input.organizationLabelById[
                    input.effectiveExecutingEntityId
                  ] ?? input.effectiveExecutingEntityId)
                : "Не определена"
            }
          />
        </dl>

        <Separator />

        <div className="space-y-2 rounded-xl border bg-background/70 px-3 py-3">
          <div className="text-sm font-medium">Что будет дальше</div>
          <div className="text-muted-foreground text-sm leading-6">
            {selectedFlow.nextStepHint}
          </div>
          <div className="text-muted-foreground text-xs leading-5">
            Обязательные входы: {selectedFlow.requiredInputs.join(", ")}.
          </div>
        </div>

        <Separator />

        <Collapsible
          open={input.ownershipOverridesOpen}
          onOpenChange={input.onOwnershipOverridesOpenChange}
        >
          <CollapsibleTrigger
            render={(props, state) => (
              <Button
                {...props}
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-between px-0 hover:bg-transparent"
              >
                <span>Ручное переопределение ролей</span>
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    state.open ? "rotate-180" : "rotate-0",
                  )}
                />
              </Button>
            )}
          >
            Переопределение ролей
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="text-muted-foreground text-sm">
              Нужен только если автоматический расчет ролей не подходит.
            </div>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>Экономический владелец</Label>
                <Select
                  value={
                    input.economicOwnerEntityId ??
                    input.derivedEconomicOwnerEntityId ??
                    UNSELECTED_VALUE
                  }
                  onValueChange={(value) =>
                    input.onEconomicOwnerChange(
                      value === UNSELECTED_VALUE ? null : value,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    {renderSelectText({
                      placeholder: "Выберите организацию",
                      value:
                        input.organizationLabelById[
                          input.economicOwnerEntityId ??
                            input.derivedEconomicOwnerEntityId ??
                            ""
                        ] ?? null,
                    })}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem disabled value={UNSELECTED_VALUE}>
                      Выберите организацию
                    </SelectItem>
                    {input.organizations.map((organization) => (
                      <SelectItem key={organization.id} value={organization.id}>
                        {organization.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Исполняющая организация</Label>
                <Select
                  value={
                    input.executingEntityId ??
                    input.derivedExecutingEntityId ??
                    UNSELECTED_VALUE
                  }
                  onValueChange={(value) =>
                    input.onExecutingEntityChange(
                      value === UNSELECTED_VALUE ? null : value,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    {renderSelectText({
                      placeholder: "Выберите организацию",
                      value:
                        input.organizationLabelById[
                          input.executingEntityId ??
                            input.derivedExecutingEntityId ??
                            ""
                        ] ?? null,
                    })}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem disabled value={UNSELECTED_VALUE}>
                      Выберите организацию
                    </SelectItem>
                    {input.organizations.map((organization) => (
                      <SelectItem key={organization.id} value={organization.id}>
                        {organization.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export function TreasuryOperationCreateForm({
  accounts,
  assetLabels,
  formId = "treasury-operation-create-form",
  organizationLabels,
  organizations,
}: TreasuryOperationCreateFormProps) {
  const router = useRouter();
  const [submitting, startTransition] = React.useTransition();

  const [amountMajor, setAmountMajor] = React.useState("");
  const [destinationAccountId, setDestinationAccountId] = React.useState<
    string | null
  >(null);
  const [economicOwnerEntityId, setEconomicOwnerEntityId] = React.useState<
    string | null
  >(null);
  const [executingEntityId, setExecutingEntityId] = React.useState<
    string | null
  >(null);
  const [kind, setKind] = React.useState<TreasuryOperationFlowKind>("payout");
  const [legalBasis, setLegalBasis] = React.useState<LegalBasis>("settlement");
  const [memo, setMemo] = React.useState("");
  const [ownershipOverridesOpen, setOwnershipOverridesOpen] =
    React.useState(false);
  const [sourceAccountId, setSourceAccountId] = React.useState<string | null>(
    accounts[0]?.id ?? null,
  );

  const sourceAccount = React.useMemo(
    () => accounts.find((account) => account.id === sourceAccountId) ?? null,
    [accounts, sourceAccountId],
  );
  const destinationAccount = React.useMemo(
    () =>
      accounts.find((account) => account.id === destinationAccountId) ?? null,
    [accounts, destinationAccountId],
  );

  const accountLabelById = React.useMemo(
    () =>
      Object.fromEntries(
        accounts.map((account) => [
          account.id,
          buildAccountLabel({
            account,
            assetLabels,
            organizationLabels,
          }),
        ]),
      ),
    [accounts, assetLabels, organizationLabels],
  );
  const organizationLabelById = React.useMemo(
    () =>
      Object.fromEntries(
        organizations.map((organization) => [
          organization.id,
          organization.label,
        ]),
      ),
    [organizations],
  );
  const selectedFlow = getTreasuryFlowDescriptor(kind);

  const destinationOptions = React.useMemo(
    () =>
      getAllowedDestinationAccounts({
        accounts,
        kind,
        sourceAccount,
        sourceAccountId,
      }),
    [accounts, kind, sourceAccount, sourceAccountId],
  );

  const derivedEconomicOwnerEntityId = React.useMemo(() => {
    if (!sourceAccount) {
      return null;
    }

    if (
      kind === "intercompany_funding" &&
      destinationAccount &&
      destinationAccount.ownerEntityId !== sourceAccount.ownerEntityId
    ) {
      return destinationAccount.ownerEntityId;
    }

    return sourceAccount.ownerEntityId;
  }, [destinationAccount, kind, sourceAccount]);

  const derivedExecutingEntityId = sourceAccount?.ownerEntityId ?? null;
  const effectiveEconomicOwnerEntityId = ownershipOverridesOpen
    ? economicOwnerEntityId
    : derivedEconomicOwnerEntityId;
  const effectiveExecutingEntityId = ownershipOverridesOpen
    ? executingEntityId
    : derivedExecutingEntityId;
  const currentAssetLabel = sourceAccount
    ? (assetLabels[sourceAccount.assetId] ?? sourceAccount.assetId)
    : null;
  const selectedAccountsRequireFx =
    sourceAccount !== null &&
    destinationAccount !== null &&
    sourceAccount.assetId !== destinationAccount.assetId;

  React.useEffect(() => {
    if (!requiresDestinationAccount(kind)) {
      setDestinationAccountId(null);
    }
  }, [kind]);

  React.useEffect(() => {
    if (!ownershipOverridesOpen) {
      return;
    }

    if (!economicOwnerEntityId && derivedEconomicOwnerEntityId) {
      setEconomicOwnerEntityId(derivedEconomicOwnerEntityId);
    }

    if (!executingEntityId && derivedExecutingEntityId) {
      setExecutingEntityId(derivedExecutingEntityId);
    }
  }, [
    derivedEconomicOwnerEntityId,
    derivedExecutingEntityId,
    economicOwnerEntityId,
    executingEntityId,
    ownershipOverridesOpen,
  ]);

  React.useEffect(() => {
    if (!sourceAccount) {
      return;
    }

    if (
      destinationAccountId &&
      !destinationOptions.some((account) => account.id === destinationAccountId)
    ) {
      setDestinationAccountId(null);
    }
  }, [destinationAccountId, destinationOptions, sourceAccount]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sourceAccountId || !sourceAccount) {
      toast.error("Выберите счет казначейства");
      return;
    }

    if (!effectiveEconomicOwnerEntityId || !effectiveExecutingEntityId) {
      toast.error("Не удалось определить роли участников операции");
      return;
    }

    const currencyCode = currentAssetLabel ?? null;
    let amountMinor: string;
    try {
      amountMinor = toMinorAmountString(amountMajor, currencyCode, {
        requirePositive: true,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.length > 0
          ? resolveAmountValidationMessage(error.message)
          : "Введите корректную положительную сумму";
      toast.error(message);
      return;
    }

    if (requiresDestinationAccount(kind) && !destinationAccountId) {
      toast.error("Выберите счет назначения");
      return;
    }

    if (
      sourceAccount &&
      destinationAccount &&
      sourceAccount.assetId !== destinationAccount.assetId
    ) {
      toast.error(
        "Для обмена между валютами используйте отдельный FX-документ, а не обычную казначейскую операцию.",
      );
      return;
    }

    startTransition(async () => {
      const basePayload = {
        amountMinor,
        cashHolderEntityId: sourceAccount.ownerEntityId,
        economicOwnerEntityId: effectiveEconomicOwnerEntityId,
        executingEntityId: effectiveExecutingEntityId,
        idempotencyKey: crypto.randomUUID(),
        memo: memo.trim() || null,
        sourceAccountId,
      };

      const result = await executeMutation<CreatedOperation>({
        request: () => {
          if (kind === "intercompany_funding") {
            return apiClient.v1.treasury.operations.$post({
              json: {
                ...basePayload,
                assetId: sourceAccount.assetId,
                destinationAccountId: destinationAccountId!,
                legalBasis,
                operationKind: kind,
              },
            });
          }

          if (kind === "intracompany_transfer" || kind === "sweep") {
            return apiClient.v1.treasury.operations.$post({
              json: {
                ...basePayload,
                assetId: sourceAccount.assetId,
                destinationAccountId: destinationAccountId!,
                operationKind: kind,
              },
            });
          }

          return apiClient.v1.treasury.operations.$post({
            json: {
              ...basePayload,
              assetId: sourceAccount.assetId,
              operationKind: kind,
            },
          });
        },
        fallbackMessage: "Не удалось создать операцию казначейства",
        parseData: async (response) =>
          (await response.json()) as CreatedOperation,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Операция казначейства создана");
      router.push(`/treasury/operations/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]"
    >
      <div className="space-y-4">
        <TreasuryOperationScenarioSection kind={kind} onSelect={setKind} />
        <TreasuryOperationRouteSection
          accountLabelById={accountLabelById}
          accounts={accounts}
          amountMajor={amountMajor}
          currentAssetLabel={currentAssetLabel}
          destinationAccount={destinationAccount}
          destinationAccountId={destinationAccountId}
          destinationOptions={destinationOptions}
          kind={kind}
          legalBasis={legalBasis}
          onAmountChange={setAmountMajor}
          onDestinationAccountChange={setDestinationAccountId}
          onLegalBasisChange={setLegalBasis}
          onSourceAccountChange={setSourceAccountId}
          sourceAccount={sourceAccount}
          sourceAccountId={sourceAccountId}
          submitting={submitting}
        />
        <TreasuryOperationCommentSection
          kind={kind}
          memo={memo}
          onMemoChange={setMemo}
          submitting={submitting}
        />
      </div>

      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <TreasuryOperationSummaryPanel
          amountMajor={amountMajor}
          currentAssetLabel={currentAssetLabel}
          destinationAccount={destinationAccount}
          destinationLabel={
            destinationAccount
              ? (accountLabelById[destinationAccount.id] ??
                destinationAccount.id)
              : "Не выбран"
          }
          kind={kind}
          legalBasis={legalBasis}
          selectedAccountsRequireFx={selectedAccountsRequireFx}
          selectedFlowTitle={selectedFlow.title}
          sourceAccount={sourceAccount}
          sourceLabel={
            sourceAccount
              ? (accountLabelById[sourceAccount.id] ?? sourceAccount.id)
              : "Не выбран"
          }
        />
        <TreasuryOperationRolesPanel
          derivedEconomicOwnerEntityId={derivedEconomicOwnerEntityId}
          derivedExecutingEntityId={derivedExecutingEntityId}
          economicOwnerEntityId={economicOwnerEntityId}
          effectiveEconomicOwnerEntityId={effectiveEconomicOwnerEntityId}
          effectiveExecutingEntityId={effectiveExecutingEntityId}
          executingEntityId={executingEntityId}
          kind={kind}
          onEconomicOwnerChange={setEconomicOwnerEntityId}
          onExecutingEntityChange={setExecutingEntityId}
          onOwnershipOverridesOpenChange={setOwnershipOverridesOpen}
          organizationLabelById={organizationLabelById}
          organizations={organizations}
          ownershipOverridesOpen={ownershipOverridesOpen}
          sourceAccount={sourceAccount}
        />
      </div>
    </form>
  );
}
