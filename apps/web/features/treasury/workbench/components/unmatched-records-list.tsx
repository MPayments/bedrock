import {
  Card,
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

import { presentTreasuryExceptions } from "../lib/presentation";
import type {
  ExecutionInstructionListItem,
  TreasuryOperationListItem,
  UnmatchedExternalRecordListItem,
} from "../lib/queries";
import { MatchExternalRecordDialog } from "./match-external-record-dialog";

export function TreasuryUnmatchedRecordsList({
  assetLabels,
  instructions,
  operations,
  records,
}: {
  assetLabels: Record<string, string>;
  instructions: ExecutionInstructionListItem[];
  operations: TreasuryOperationListItem[];
  records: UnmatchedExternalRecordListItem[];
}) {
  const items = presentTreasuryExceptions({ records });
  const recordById = new Map(
    records.map((record) => [record.externalRecordId, record]),
  );

  return (
    <div className="space-y-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Что такое исключение</CardTitle>
          <CardDescription>
            Исключение означает, что внешняя запись уже пришла в сверку, но
            оператор еще не связал ее с инструкцией и фактическим событием
            исполнения.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-3">
          <div className="rounded-xl border px-4 py-3">
            <div className="text-sm font-medium">Что здесь ищем</div>
            <div className="text-muted-foreground mt-1 text-sm leading-6">
              Записи, по которым система уже понимает, что фактический сигнал
              пришел, но не знает, к какой treasury-операции он относится.
            </div>
          </div>
          <div className="rounded-xl border px-4 py-3">
            <div className="text-sm font-medium">Как закрыть</div>
            <div className="text-muted-foreground mt-1 text-sm leading-6">
              Откройте сопоставление из строки, выберите операцию и инструкцию,
              затем сразу зафиксируйте правильное событие исполнения.
            </div>
          </div>
          <div className="rounded-xl border px-4 py-3">
            <div className="text-sm font-medium">Чего избегать</div>
            <div className="text-muted-foreground mt-1 text-sm leading-6">
              Не создавайте новую операцию только потому, что пришла внешняя
              запись. Сначала разберите, к какому уже существующему сценарию она
              относится.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Исключения исполнения</CardTitle>
          <CardDescription>
            В каждой строке показано, что именно пришло извне, почему запись не
            закрыта автоматически и какое действие обычно решает проблему.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-6">
              <div className="text-sm font-medium">Исключений сейчас нет</div>
              <div className="text-muted-foreground mt-1 text-sm leading-6">
                Внешние записи сверки сейчас уже сопоставлены с treasury-событиями
                или не требуют ручного действия.
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Когда пришло</TableHead>
                  <TableHead>Источник</TableHead>
                  <TableHead>Что пришло</TableHead>
                  <TableHead>Почему это исключение</TableHead>
                  <TableHead>Как закрыть</TableHead>
                  <TableHead className="text-right">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const record = recordById.get(item.externalRecordId);
                  if (!record) {
                    return null;
                  }

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.receivedAtLabel}
                      </TableCell>
                      <TableCell>{item.sourceLabel}</TableCell>
                      <TableCell className="text-sm">
                        <div>{item.recordKindLabel}</div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {item.externalRecordShortId}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{item.reasonLabel}</div>
                        {item.reasonMetaLabel ? (
                          <div className="text-muted-foreground mt-1 text-xs">
                            {item.reasonMetaLabel}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm leading-6">
                        {item.resolutionHint}
                      </TableCell>
                      <TableCell className="text-right">
                        <MatchExternalRecordDialog
                          assetLabels={assetLabels}
                          instructions={instructions}
                          operations={operations}
                          record={record}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
