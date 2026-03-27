import { Badge } from "@bedrock/sdk-ui/components/badge";
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

import { presentTreasuryPositions } from "../lib/presentation";
import type { TreasuryPositionListItem } from "../lib/queries";
import { SettlePositionDialog } from "./settle-position-dialog";

export function TreasuryPositionsList({
  assetLabels,
  counterpartyLabels,
  customerLabels,
  organizationLabels,
  positions,
}: {
  assetLabels: Record<string, string>;
  counterpartyLabels: Record<string, string>;
  customerLabels: Record<string, string>;
  organizationLabels: Record<string, string>;
  positions: TreasuryPositionListItem[];
}) {
  const items = presentTreasuryPositions({
    labels: {
      assetLabels,
      counterpartyLabels,
      customerLabels,
      organizationLabels,
    },
    positions,
  });

  return (
    <div className="space-y-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Что означает позиция</CardTitle>
          <CardDescription>
            Позиция появляется после исполнения, когда treasury должен отдельно
            закрыть внутреннее требование, обязательство перед клиентом или
            внутригрупповой расчет.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-3">
          <div className="rounded-xl border px-4 py-3">
            <div className="text-sm font-medium">Почему они появляются</div>
            <div className="text-muted-foreground mt-1 text-sm leading-6">
              Исполнение денег и окончательный внутренний расчет не всегда
              происходят одновременно. Позиция держит этот остаток до закрытия.
            </div>
          </div>
          <div className="rounded-xl border px-4 py-3">
            <div className="text-sm font-medium">Что значит «Погасить»</div>
            <div className="text-muted-foreground mt-1 text-sm leading-6">
              Погашение закрывает внутренний остаток. Это отдельный шаг после
              того, как экономический смысл позиции уже закрыт операционно.
            </div>
          </div>
          <div className="rounded-xl border px-4 py-3">
            <div className="text-sm font-medium">Когда не погашать</div>
            <div className="text-muted-foreground mt-1 text-sm leading-6">
              Если расчет с клиентом или компанией группы еще не завершен,
              позиция должна оставаться открытой до фактического закрытия.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Открытые и закрываемые позиции</CardTitle>
          <CardDescription>
            В каждой строке показано, кому принадлежит позиция, к кому она
            относится и какой остаток еще нужно погасить.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Тип</TableHead>
                <TableHead>Владелец</TableHead>
                <TableHead>Кому относится</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Погашено</TableHead>
                <TableHead>Остаток</TableHead>
                <TableHead>Создана</TableHead>
                <TableHead className="text-right">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((position) => (
                <TableRow key={position.id}>
                  <TableCell className="min-w-[220px]">
                    <div className="space-y-1">
                      <Badge variant="outline">{position.kindLabel}</Badge>
                      <div className="text-muted-foreground text-xs leading-5">
                        {position.meaning}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{position.ownerLabel}</TableCell>
                  <TableCell className="text-sm">
                    <div>{position.relatedPartyLabel}</div>
                    <div className="text-muted-foreground text-xs">
                      {position.beneficialOwnerTypeLabel}
                    </div>
                  </TableCell>
                  <TableCell>{position.amountLabel}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {position.settledLabel}
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
                          meaning: position.meaning,
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
    </div>
  );
}
