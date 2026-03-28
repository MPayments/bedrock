import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";

import type {
  CounterpartyEndpointListItem,
  TreasuryAccountListItem,
  TreasuryEndpointListItem,
  TreasuryOperationTimeline,
} from "../lib/queries";
import { presentTreasuryOperationDetail } from "../lib/presentation";
import { SettlePositionDialog } from "./settle-position-dialog";
import { TreasuryOperationActions } from "./operation-actions";

type TreasuryOperationDetailProps = {
  accounts: TreasuryAccountListItem[];
  assetLabels: Record<string, string>;
  counterpartyEndpoints: CounterpartyEndpointListItem[];
  counterpartyLabels: Record<string, string>;
  customerLabels: Record<string, string>;
  operationTimeline: TreasuryOperationTimeline;
  organizationLabels: Record<string, string>;
  showHeaderCopy?: boolean;
  treasuryEndpoints: TreasuryEndpointListItem[];
};

function FactItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
        {label}
      </div>
      <div className="text-sm leading-6">{value}</div>
    </div>
  );
}

function EmptySection({
  text,
  title,
}: {
  text: string;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-dashed px-4 py-6">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-muted-foreground mt-1 text-sm leading-6">{text}</div>
    </div>
  );
}

export function TreasuryOperationDetail({
  accounts,
  assetLabels,
  counterpartyEndpoints,
  counterpartyLabels,
  customerLabels,
  operationTimeline,
  organizationLabels,
  showHeaderCopy = true,
  treasuryEndpoints,
}: TreasuryOperationDetailProps) {
  const detail = presentTreasuryOperationDetail({
    accounts,
    counterpartyEndpoints,
    labels: {
      assetLabels,
      counterpartyLabels,
      customerLabels,
      organizationLabels,
    },
    operationTimeline,
    treasuryEndpoints,
  });

  const instructionOptions = detail.instructions.map((instruction) => ({
    description: `${instruction.destinationLabel} · ${instruction.statusLabel}`,
    id: instruction.id,
    label: `#${instruction.shortId} · ${instruction.amountLabel}`,
  }));

  return (
    <div className="space-y-6">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{detail.header.flowTitle}</Badge>
              <Badge variant={detail.header.statusVariant}>
                {detail.header.statusLabel}
              </Badge>
              <Badge variant="secondary">{detail.header.settlementModelLabel}</Badge>
            </div>
            {showHeaderCopy ? (
              <div className="space-y-1">
                <CardTitle className="text-2xl">{detail.header.title}</CardTitle>
                <CardDescription className="max-w-4xl text-base leading-7">
                  {detail.header.summary}
                </CardDescription>
                <div className="text-muted-foreground text-sm">
                  ID операции: {detail.header.operationShortId}
                  <span className="ml-2 text-xs">{detail.header.operationId}</span>
                </div>
              </div>
            ) : null}
          </div>
          <CardAction>
            <TreasuryOperationActions
              accounts={accounts}
              assetLabels={assetLabels}
              counterpartyEndpoints={counterpartyEndpoints}
              counterpartyLabels={counterpartyLabels}
              instructions={instructionOptions}
              operationStatus={operationTimeline.operation.instructionStatus}
              operationTimeline={operationTimeline}
              treasuryEndpoints={treasuryEndpoints}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {detail.warning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {detail.warning}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <div className="rounded-xl border px-4 py-4">
              <div className="text-sm font-medium">О чем эта операция</div>
              <div className="text-muted-foreground mt-1 text-sm leading-6">
                {detail.header.flowDescription}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {detail.overview.map((item) => (
                  <FactItem
                    key={`${detail.header.operationId}-${item.label}`}
                    label={item.label}
                    value={item.value}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl border px-4 py-4">
              <div className="text-sm font-medium">Роли и контроль</div>
              <div className="text-muted-foreground mt-1 text-sm leading-6">
                Кто несет экономический смысл операции, кто ее исполняет и какие
                контрольные точки уже пройдены.
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {detail.control.map((item) => (
                  <FactItem
                    key={`${detail.header.operationId}-${item.label}`}
                    label={item.label}
                    value={item.value}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Инструкции на исполнение</CardTitle>
          <CardDescription>
            Это конкретные поручения, через которые операция доходит до
            фактического движения денег.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {detail.instructions.length === 0 ? (
            <EmptySection
              title="Инструкций пока нет"
              text="После резервирования создайте инструкцию на исполнение. Именно по ней потом фиксируются события: отправлено, исполнено, возврат и другие."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Инструкция</TableHead>
                  <TableHead>Этап</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Счет-источник</TableHead>
                  <TableHead>Маршрут исполнения</TableHead>
                  <TableHead>Создана</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.instructions.map((instruction) => (
                  <TableRow key={instruction.id}>
                    <TableCell>
                      <div className="font-medium">#{instruction.shortId}</div>
                      <div className="text-muted-foreground text-xs">
                        {instruction.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={instruction.statusVariant}>
                        {instruction.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {instruction.amountLabel}
                    </TableCell>
                    <TableCell className="text-sm">
                      {instruction.sourceAccountLabel}
                    </TableCell>
                    <TableCell className="text-sm">
                      {instruction.destinationLabel}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {instruction.createdAtLabel}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>События исполнения</CardTitle>
          <CardDescription>
            Здесь фиксируется, что фактически произошло с инструкцией: отправили,
            исполнили, вернули, отклонили.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {detail.events.length === 0 ? (
            <EmptySection
              title="Событий пока нет"
              text="Когда по инструкции произойдет фактическое изменение статуса, зафиксируйте событие вручную. Без этого операция не продвинется по жизненному циклу."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Когда</TableHead>
                  <TableHead>Что произошло</TableHead>
                  <TableHead>Инструкция</TableHead>
                  <TableHead>Внешняя запись</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {event.happenedAtLabel}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{event.kindLabel}</div>
                      <div className="text-muted-foreground text-xs">
                        {event.id}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      #{event.instructionShortId}
                      <div className="text-muted-foreground text-xs">
                        {event.instructionId}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{event.externalRecordId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {detail.obligations.length > 0 ? (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Связанные обязательства</CardTitle>
            <CardDescription>
              Эти обязательства объясняют, зачем вообще возникло движение денег.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Обязательство</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Остаток</TableHead>
                  <TableHead>Стороны</TableHead>
                  <TableHead>Срок</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.obligations.map((obligation) => (
                  <TableRow key={obligation.id}>
                    <TableCell>
                      <div className="font-medium">#{obligation.shortId}</div>
                      <div className="text-muted-foreground text-xs">
                        {obligation.id}
                      </div>
                    </TableCell>
                    <TableCell>{obligation.kindLabel}</TableCell>
                    <TableCell>{obligation.amountLabel}</TableCell>
                    <TableCell className="font-medium">
                      {obligation.outstandingLabel}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>Должник: {obligation.debtorLabel}</div>
                      <div className="text-muted-foreground">
                        Кредитор: {obligation.creditorLabel}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {obligation.dueAtLabel}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {detail.positions.length > 0 ? (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Позиции после исполнения</CardTitle>
            <CardDescription>
              Эти позиции показывают, какой внутренний расчет остался после
              фактического прохождения денег.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Позиция</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Владелец</TableHead>
                  <TableHead>Кому относится</TableHead>
                  <TableHead>Остаток</TableHead>
                  <TableHead>Создана</TableHead>
                  <TableHead className="text-right">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.positions.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell>
                      <div className="font-medium">#{position.shortId}</div>
                      <div className="text-muted-foreground text-xs">
                        {position.id}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      <div className="space-y-1">
                        <Badge variant="outline">{position.kindLabel}</Badge>
                        <div className="text-muted-foreground text-xs leading-5">
                          {position.kindMeaning}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{position.ownerLabel}</TableCell>
                    <TableCell className="text-sm">
                      <div>{position.relatedPartyLabel}</div>
                      {position.beneficialOwnerTypeLabel ? (
                        <div className="text-muted-foreground text-xs">
                          {position.beneficialOwnerTypeLabel}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">
                      {position.remainingLabel}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {position.createdAtLabel}
                    </TableCell>
                    <TableCell className="text-right">
                      {position.canSettle ? (
                        <SettlePositionDialog
                          position={{
                            assetCode: position.assetCode,
                            id: position.id,
                            kindLabel: position.kindLabel,
                            meaning: position.kindMeaning,
                            ownerLabel: position.ownerLabel,
                            relatedPartyLabel: position.relatedPartyLabel,
                            remainingLabel: position.remainingLabel,
                            remainingMinor: position.remainingMinor,
                          }}
                          triggerSize="sm"
                          triggerVariant="outline"
                        >
                          Погасить позицию
                        </SettlePositionDialog>
                      ) : (
                        <span className="text-muted-foreground text-sm">Закрыта</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
