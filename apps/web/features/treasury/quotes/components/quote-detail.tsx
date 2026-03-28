import * as React from "react";
import Link from "next/link";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import type { FxQuoteDetailsResult } from "@/features/treasury/quotes/lib/queries";
import {
  getFxQuoteStatusVariant,
  presentFxQuoteDetail,
} from "@/features/treasury/quotes/lib/presentation";
import type {
  LinkedFxDocumentArtifactView,
} from "@/features/treasury/quotes/lib/detail-presentation";
import type { FxQuoteStageView } from "@/features/treasury/quotes/lib/stage";

type FxQuoteDetailProps = {
  details: FxQuoteDetailsResult;
  stage: FxQuoteStageView;
  linkedFxDocument?: LinkedFxDocumentArtifactView | null;
};

type DefinitionItem = {
  label: string;
  tone?: "default" | "mono";
  value: string;
};

function DefinitionGrid({ items }: { items: DefinitionItem[] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div className="min-w-0 space-y-1" key={item.label}>
          <dt className="text-muted-foreground text-sm">{item.label}</dt>
          <dd
            className={
              item.tone === "mono"
                ? "font-mono text-sm break-all"
                : "text-sm font-medium break-words"
            }
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FxQuoteDetail({
  details,
  stage,
  linkedFxDocument = null,
}: FxQuoteDetailProps) {
  const view = presentFxQuoteDetail(details);

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <span>{stage.title}</span>
                <Badge variant={stage.badgeVariant}>{stage.badgeLabel}</Badge>
              </CardTitle>
              <CardDescription>{stage.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Что делать дальше</div>
            <div className="text-sm font-medium">{stage.nextAction}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Контекст сценария</div>
            <div className="text-sm font-medium break-words">{stage.contextLabel}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <span>Параметры котировки</span>
                <Badge variant={getFxQuoteStatusVariant(details.quote.status)}>
                  {view.summary.find((item) => item.label === "Статус")?.value}
                </Badge>
              </CardTitle>
              <CardDescription>
                Treasury quote как зафиксированный расчет маршрута, курса и
                финансовых линий.
              </CardDescription>
            </div>
            {view.artifact ? (
              <Button
                nativeButton={false}
                render={<Link href={view.artifact.href} />}
                size="sm"
                variant="outline"
              >
                Открыть FX документ
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <DefinitionGrid items={view.summary} />
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Маршрут конверсии</CardTitle>
          <CardDescription>
            Откуда и через какие legs treasury строит итоговую котировку.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-muted-foreground border-b text-left">
              <tr>
                <th className="py-2 pr-4 font-medium">Шаг</th>
                <th className="py-2 pr-4 font-medium">Маршрут</th>
                <th className="py-2 pr-4 font-medium">Отдать</th>
                <th className="py-2 pr-4 font-medium">Получить</th>
                <th className="py-2 pr-4 font-medium">Курс</th>
                <th className="py-2 pr-4 font-medium">Источник</th>
                <th className="py-2 font-medium">As of</th>
              </tr>
            </thead>
            <tbody>
              {view.legs.map((leg) => (
                <tr className="border-b last:border-b-0" key={leg.id}>
                  <td className="py-3 pr-4 font-medium">{leg.stepLabel}</td>
                  <td className="py-3 pr-4">{leg.pairLabel}</td>
                  <td className="py-3 pr-4">{leg.fromAmountLabel}</td>
                  <td className="py-3 pr-4">{leg.toAmountLabel}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{leg.rateLabel}</td>
                  <td className="py-3 pr-4">
                    <div className="space-y-1">
                      <div>{leg.sourceLabel}</div>
                      <div className="text-muted-foreground font-mono text-[11px] break-all">
                        {leg.sourceRefLabel}
                      </div>
                    </div>
                  </td>
                  <td className="py-3">{leg.asOfLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Fee components</CardTitle>
            <CardDescription>
              Компоненты комиссии, вошедшие в quoted result.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {view.feeComponents.length === 0 ? (
              <div className="text-muted-foreground text-sm">Комиссии не рассчитаны.</div>
            ) : (
              <div className="space-y-4">
                {view.feeComponents.map((component) => (
                  <div className="space-y-2 rounded-lg border p-4" key={component.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="font-medium">{component.kindLabel}</div>
                      <div>{component.amountLabel}</div>
                    </div>
                    <DefinitionGrid
                      items={[
                        {
                          label: "Источник",
                          value: component.sourceLabel,
                        },
                        {
                          label: "Учет",
                          value: component.accountingTreatmentLabel,
                        },
                        {
                          label: "Погашение",
                          value: component.settlementModeLabel,
                        },
                        {
                          label: "Комментарий",
                          value: component.memoLabel,
                        },
                      ]}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Финансовые линии</CardTitle>
            <CardDescription>
              Что quote уже подготовил для финансового результата и расчетов.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {view.financialLines.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                Финансовые линии не сформированы.
              </div>
            ) : (
              <div className="space-y-4">
                {view.financialLines.map((line) => (
                  <div className="space-y-2 rounded-lg border p-4" key={line.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="font-medium">{line.bucketLabel}</div>
                      <div>{line.amountLabel}</div>
                    </div>
                    <DefinitionGrid
                      items={[
                        {
                          label: "Источник",
                          value: line.sourceLabel,
                        },
                        {
                          label: "Погашение",
                          value: line.settlementModeLabel,
                        },
                        {
                          label: "Комментарий",
                          value: line.memoLabel,
                        },
                      ]}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {linkedFxDocument ? (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>Связанный FX документ</CardTitle>
            <CardDescription>
              Поддерживающий артефакт. Его статус и реквизиты показаны здесь
              как вторичный контекст, но quote остается первичным treasury
              объектом.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium">{linkedFxDocument.docNo}</div>
                  <div className="text-muted-foreground text-sm">
                    {linkedFxDocument.title}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {linkedFxDocument.statusBadges.map((badge) => (
                    <Badge key={badge.label} variant={badge.variant}>
                      {badge.label}: {badge.value}
                    </Badge>
                  ))}
                </div>
              </div>

              <DefinitionGrid items={linkedFxDocument.summary} />

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  nativeButton={false}
                  render={<Link href={linkedFxDocument.href} />}
                  size="sm"
                  variant="outline"
                >
                  Открыть документ
                </Button>
                {linkedFxDocument.postingOperationId ? (
                  <Button
                    nativeButton={false}
                    render={
                      <Link
                        href={`/documents/journal/${linkedFxDocument.postingOperationId}`}
                      />
                    }
                    size="sm"
                    variant="outline"
                  >
                    Открыть журнал
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
